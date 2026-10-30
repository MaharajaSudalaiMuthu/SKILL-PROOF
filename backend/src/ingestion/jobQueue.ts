import fs from "fs";
import path from "path";
import { execFile } from "child_process";
import { promisify } from "util";
import PQueue from "p-queue";

const execFileAsync = promisify(execFile);
import { AnalysisJob } from "../models/AnalysisJob.js";
import { Repository } from "../models/Repository.js";
import { UserModel } from "../models/User.js";
import { FileAttribution, ILineRange } from "../models/FileAttribution.js";
import { EvidenceRecord } from "../models/EvidenceRecord.js";
import { AntiGamingFlag } from "../models/AntiGamingFlag.js";
import { cloneRepository, extractZipToWorkspace, cleanupWorkspace } from "./gitCloner.js";
import { blameFile } from "./gitBlame.js";
import { scanProjectWorkspace } from "./projectScanner.js";
import { inspectWorkspaceCode } from "../engine/codeInspector.js";
import { AuthorResolver } from "./authorResolver.js";
import { decryptToken } from "../utils/encryption.js";
import { parseJavaFile, ParsedJavaFile } from "../detectors/ast/javaAstHelper.js";
import { runAllDetectors } from "../detectors/detectorRunner.js";
import { checkUnmodifiedFork } from "../antigaming/unmodifiedForkCheck.js";
import { checkTutorialSimilarity } from "../antigaming/tutorialSimilarityCheck.js";
import { checkLargeInitialCommit } from "../antigaming/largeInitialCommitCheck.js";
import { recomputeUserSnapshots } from "../engine/snapshotService.js";
import { config } from "../config/index.js";
import { logger } from "../middleware/pinoLogger.js";

// Bounded in-process concurrency queue
const analysisQueue = new PQueue({ concurrency: 2 });
export const authorResolver = new AuthorResolver();

/**
 * On server startup, recovers any jobs that were abandoned mid-execution.
 */
export async function recoverOrphanedJobs(): Promise<void> {
  try {
    const result = await AnalysisJob.updateMany(
      { status: { $in: ["RUNNING", "QUEUED"] } },
      {
        $set: {
          status: "FAILED",
          errorMessage: "Server was restarted while job was queued or running. Please retry analysis.",
          completedAt: new Date(),
        },
      }
    );
    if (result.modifiedCount > 0) {
      logger.info({ modifiedCount: result.modifiedCount }, "Recovered orphaned analysis jobs.");
    }
  } catch (err) {
    logger.error({ err }, "Error recovering orphaned analysis jobs on startup.");
  }
}

/**
 * Adds an analysis job ID to the background queue.
 */
export function enqueueAnalysisJob(jobId: string): void {
  analysisQueue.add(() => processAnalysisJob(jobId));
}

/**
 * Executes full analysis lifecycle for a specific job:
 * clone / unzip -> scan files -> blame -> resolve authors -> store attributions
 * -> run anti-gaming -> parse AST & detect capabilities -> persist evidence -> cleanup
 */
export async function processAnalysisJob(jobId: string): Promise<void> {
  const job = await AnalysisJob.findById(jobId);
  if (!job) {
    logger.error({ jobId }, "Analysis job not found in database.");
    return;
  }

  const repo = await Repository.findById(job.repositoryId);
  if (!repo) {
    job.status = "FAILED";
    job.errorMessage = "Target repository no longer exists.";
    job.completedAt = new Date();
    await job.save();
    return;
  }

  const user = await UserModel.findById(job.userId);
  if (!user) {
    job.status = "FAILED";
    job.errorMessage = "Owning user no longer exists.";
    job.completedAt = new Date();
    await job.save();
    return;
  }

  let userGithubToken: string | null = null;
  if (user.encryptedAccessToken && user.tokenIv && user.tokenAuthTag) {
    try {
      userGithubToken = decryptToken({
        ciphertext: user.encryptedAccessToken,
        iv: user.tokenIv,
        authTag: user.tokenAuthTag,
      });
    } catch (err) {
      logger.warn({ userId: user._id, err }, "Failed to decrypt user GitHub token; proceeding unauthenticated.");
    }
  }

  let workspacePath: string | null = null;

  try {
    // 1. Set status to RUNNING
    job.status = "RUNNING";
    job.stage = repo.sourceType === "ZIP_UPLOAD" ? "EXTRACTING" : "CLONING";
    job.progressPercent = 10;
    job.startedAt = new Date();
    await job.save();

    // 2. Clone or extract repository into temporary isolated workspace
    if (repo.sourceType === "ZIP_UPLOAD" && repo.zipFilePath) {
      const extractResult = await extractZipToWorkspace(jobId, repo.zipFilePath);
      workspacePath = extractResult.workspacePath;
    } else {
      const cloneResult = await cloneRepository(jobId, repo.fullName, {
        cloneUrl: repo.cloneUrl,
        authToken: repo.accessToken || userGithubToken || undefined,
      });
      workspacePath = cloneResult.workspacePath;
    }

    // Automatically unpack any embedded .zip archives (e.g. files (1).zip) into workspacePath
    try {
      const topEntries = await fs.promises.readdir(workspacePath);
      for (const entry of topEntries) {
        if (entry.toLowerCase().endsWith(".zip")) {
          const zipFullPath = path.join(workspacePath, entry);
          logger.info({ entry, workspacePath }, "Unpacking embedded zip archive found in repository...");
          await execFileAsync("unzip", ["-o", "-q", zipFullPath, "-d", workspacePath]);
        }
      }
    } catch (unzipErr) {
      logger.warn({ unzipErr }, "Notice: could not unpack embedded zip archive");
    }

    // 3. Recursively scan the entire extracted workspace (excluding node_modules, .git, dist, etc.)
    job.stage = "SCANNING";
    job.progressPercent = 25;
    await job.save();

    const scanResult = await scanProjectWorkspace(workspacePath);

    // Save detected languages and frameworks on Repository document
    repo.detectedLanguages = scanResult.languages;
    repo.detectedFrameworks = scanResult.frameworks;
    await repo.save();

    const targetFiles = scanResult.sourceFiles.length > 0 ? scanResult.sourceFiles : scanResult.allFiles;

    // 4. Run git blame on target files (bounded to top 150 files for speed)
    job.stage = "BLAMING";
    job.progressPercent = 40;
    await job.save();

    const blameResults = [];
    const allUniqueShas = new Set<string>();

    for (const filePath of targetFiles.slice(0, 150)) {
      try {
        const fileBlame = await blameFile(workspacePath, filePath);
        blameResults.push(fileBlame);
        for (const sha of fileBlame.uniqueShas) {
          allUniqueShas.add(sha);
        }
      } catch {
        // Fallback attribution for untracked or non-git files
        try {
          const content = await fs.promises.readFile(path.join(workspacePath, filePath), "utf8");
          const lines = content.split("\n").length;
          blameResults.push({
            filePath,
            totalLines: lines,
            ranges: [
              {
                startLine: 1,
                endLine: lines,
                commitSha: "initial",
                commitDate: new Date(),
                lineCount: lines,
                nonBlankCount: lines,
              },
            ],
            uniqueShas: new Set(["initial"]),
          });
          allUniqueShas.add("initial");
        } catch {}
      }
    }

    // 5. Resolve commit SHAs to GitHub logins and attribution status
    job.stage = "RESOLVING_AUTHORS";
    job.progressPercent = 55;
    await job.save();

    const resolvedAuthors = await authorResolver.resolveCommits(
      repo.fullName,
      Array.from(allUniqueShas),
      userGithubToken,
      user.githubLogin
    );

    // 6. Persist fileAttributions in MongoDB
    await FileAttribution.deleteMany({ repositoryId: repo._id, userId: user._id });

    let aggregateTotalLines = 0;
    let aggregateConfirmedLines = 0;
    const attributionDocs = [];

    for (const blame of blameResults) {
      const mappedRanges: ILineRange[] = blame.ranges.map((r) => {
        const resolved = resolvedAuthors.get(r.commitSha) ?? { authorLogin: user.githubLogin || null, status: "CONFIRMED" as const };
        return {
          startLine: r.startLine,
          endLine: r.endLine,
          commitSha: r.commitSha,
          commitDate: r.commitDate,
          authorLogin: resolved.authorLogin,
          status: resolved.status,
        };
      });

      let confirmedLines = 0;
      let uncertainLines = 0;
      let otherLines = 0;

      for (const range of mappedRanges) {
        const count = range.endLine - range.startLine + 1;
        if (range.status === "CONFIRMED") {
          confirmedLines += count;
        } else if (range.status === "OTHER") {
          otherLines += count;
        } else {
          uncertainLines += count;
        }
      }

      aggregateTotalLines += blame.totalLines;
      aggregateConfirmedLines += confirmedLines;

      const attrDoc = await FileAttribution.create({
        analysisJobId: job._id,
        repositoryId: repo._id,
        userId: user._id,
        filePath: blame.filePath,
        ranges: mappedRanges,
        totalLines: blame.totalLines,
        confirmedLines,
        uncertainLines,
        otherLines,
      });
      attributionDocs.push(attrDoc);
    }

    // 7. Anti-Gaming Checks
    job.stage = "ANTI_GAMING";
    job.progressPercent = 70;
    await job.save();

    await AntiGamingFlag.deleteMany({ repositoryId: repo._id, userId: user._id });

    // Read Java source files if present
    const javaFiles = targetFiles.filter((f) => f.endsWith(".java"));
    const parsedFiles: ParsedJavaFile[] = [];
    const rawSources: string[] = [];

    for (const relPath of javaFiles) {
      const fullPath = path.join(workspacePath, relPath);
      try {
        const sourceText = await fs.promises.readFile(fullPath, "utf8");
        rawSources.push(sourceText);
        parsedFiles.push(parseJavaFile(relPath, sourceText));
      } catch (readErr) {
        logger.warn({ relPath, readErr }, "Could not read java file during AST check.");
      }
    }

    const flagRecords = [];

    if (javaFiles.length > 0) {
      const forkFlag = checkUnmodifiedFork({
        repositoryId: repo._id.toString(),
        userId: user._id.toString(),
        isFork: repo.isFork,
        totalJavaLines: aggregateTotalLines,
        confirmedJavaLines: aggregateConfirmedLines,
      });
      if (forkFlag) flagRecords.push(forkFlag);

      const tutorialFlag = await checkTutorialSimilarity({
        repositoryId: repo._id.toString(),
        userId: user._id.toString(),
        javaFileSources: rawSources,
      });
      if (tutorialFlag) flagRecords.push(tutorialFlag);
    }

    for (const flag of flagRecords) {
      await AntiGamingFlag.create({
        repositoryId: repo._id,
        userId: user._id,
        flagType: flag.flagType,
        severity: flag.severity,
        explanation: flag.explanation,
        metricValue: flag.metricValue,
      });
    }

    // 8. Multi-Language Code Inspection & Evidence Generation
    job.stage = "DETECTING";
    job.progressPercent = 85;
    await job.save();

    // Clean up previous static evidence for this repository
    await EvidenceRecord.deleteMany({ repositoryId: repo._id, userId: user._id, evidenceType: "STATIC" });

    // Run multi-language inspector
    const inspection = await inspectWorkspaceCode(workspacePath, scanResult);

    for (const finding of inspection.findings) {
      const categoryToSkill: Record<string, string> = {
        API_ROUTE: "rest-controller-design",
        DATA_MODEL: "jpa-hibernate-persistence",
        TEST_SUITE: "unit-tests-meaningful-assertions",
        ERROR_HANDLING: "structured-exception-handling",
        FUNCTION_LOGIC: "transaction-management",
        CLASS_DESIGN: "dependency-injection-inversion",
        DATA_STRUCTURE: "jpa-hibernate-persistence",
        ALGORITHM_LOGIC: "transaction-management",
        FLOW_CONTROL: "transaction-management",
        IO_OPERATION: "rest-controller-design",
        AI_ML_MODEL: "transaction-management",
        FRONTEND_UI: "rest-controller-design",
        SECURITY_AUTH: "spring-security-configuration",
        MODULE_IMPORT: "build-tool-dependency-graph",
        REACT_COMPONENT: "rest-controller-design",
        DEPENDENCY: "build-tool-dependency-graph",
        ARCHITECTURE: "spring-security-configuration",
      };
      const skillSlug = categoryToSkill[finding.category] || "rest-controller-design";
      const dedupeKey = `${user._id}:${skillSlug}:${repo._id}:${finding.filePath}:${finding.startLine}-${finding.endLine}:${finding.id}`;

      await EvidenceRecord.findOneAndUpdate(
        { dedupeKey },
        {
          $set: {
            userId: user._id,
            skillSlug,
            evidenceType: "STATIC",
            validityStatus: "VALID",
            attributionStatus: "CONFIRMED",
            repositoryId: repo._id,
            filePath: finding.filePath,
            startLine: finding.startLine,
            endLine: finding.endLine,
            commitSha: "source-verified",
            commitDate: new Date(),
            detectorName: `multi-lang-${finding.category.toLowerCase()}`,
            matchedPattern: finding.codeSnippet,
            rawDetails: {
              category: finding.category,
              primaryIdentifier: finding.primaryIdentifier,
              secondaryInfo: finding.secondaryInfo,
              correctAnswer: finding.correctAnswer,
              distractors: finding.distractors,
              explanation: finding.explanation,
              codeSnippet: finding.codeSnippet,
              title: finding.title,
              whatThisShows: finding.explanation,
              whatThisDoesNotProve: "Does not prove live deployment",
            },
            recencyWeight: 1.0,
          },
        },
        { upsert: true, new: true }
      );
    }

    // Also run existing Java AST detectors if Java files are present
    if (parsedFiles.length > 0) {
      try {
        const { findings } = runAllDetectors(parsedFiles);
        const now = Date.now();
        const halfLifeMonths = config.skillproof.recency.halfLifeMonths;
        const minConfirmedRatio = config.skillproof.attribution.minConfirmedRatio;

        for (const finding of findings) {
          const attr = attributionDocs.find((a) => a.filePath === finding.filePath);
          let findingAttributionStatus: "CONFIRMED" | "UNCERTAIN" | "OTHER" = "UNCERTAIN";
          let primaryCommitSha = "unknown";
          let primaryCommitDate = new Date();

          if (attr && attr.ranges.length > 0) {
            const overlappingRanges = attr.ranges.filter(
              (r) => r.startLine <= finding.endLine && r.endLine >= finding.startLine
            );
            let confirmedCount = 0;
            let totalCount = 0;
            for (const r of overlappingRanges) {
              const overlapStart = Math.max(r.startLine, finding.startLine);
              const overlapEnd = Math.min(r.endLine, finding.endLine);
              const count = Math.max(0, overlapEnd - overlapStart + 1);
              totalCount += count;
              if (r.status === "CONFIRMED") confirmedCount += count;
            }
            if (totalCount > 0 && confirmedCount / totalCount >= minConfirmedRatio) {
              findingAttributionStatus = "CONFIRMED";
            }
            if (overlappingRanges[0]) {
              primaryCommitSha = overlappingRanges[0].commitSha;
              primaryCommitDate = overlappingRanges[0].commitDate;
            }
          }

          const dedupeKey = `${user._id}:${finding.skillSlug}:${repo._id}:${finding.filePath}:${finding.startLine}-${finding.endLine}:${finding.detectorName}:${primaryCommitSha}`;

          await EvidenceRecord.findOneAndUpdate(
            { dedupeKey },
            {
              $set: {
                userId: user._id,
                skillSlug: finding.skillSlug,
                evidenceType: "STATIC",
                validityStatus: "VALID",
                attributionStatus: findingAttributionStatus,
                repositoryId: repo._id,
                filePath: finding.filePath,
                startLine: finding.startLine,
                endLine: finding.endLine,
                commitSha: primaryCommitSha,
                commitDate: primaryCommitDate,
                detectorName: finding.detectorName,
                matchedPattern: finding.matchedPattern,
                rawDetails: {
                  ...finding.keyAttributes,
                  whatThisShows: finding.whatThisShows,
                  whatThisDoesNotProve: finding.whatThisDoesNotProve,
                },
                recencyWeight: 1.0,
              },
            },
            { upsert: true, new: true }
          );
        }
      } catch (javaDetErr) {
        logger.warn({ javaDetErr }, "Java AST detector execution failed");
      }
    }

    // 9. Cleanup workspace directory
    if (workspacePath) {
      await cleanupWorkspace(workspacePath);
      workspacePath = null;
    }

    // 10. Recompute capability snapshots for user
    try {
      await recomputeUserSnapshots(user._id);
    } catch (recomputeErr) {
      logger.error({ err: recomputeErr, userId: user._id }, "Error recomputing snapshots on job completion.");
    }

    // 11. Mark Job as SUCCEEDED
    job.status = "SUCCEEDED";
    job.stage = "COMPLETED";
    job.progressPercent = 100;
    job.filesAnalyzed = targetFiles.length;
    job.totalLines = scanResult.totalLines || aggregateTotalLines;
    job.confirmedLines = aggregateConfirmedLines || job.totalLines;
    job.completedAt = new Date();
    await job.save();

    logger.info(
      {
        jobId,
        repo: repo.fullName,
        filesAnalyzed: job.filesAnalyzed,
        findingsCount: inspection.findings.length,
        primaryLanguage: scanResult.primaryLanguage,
      },
      "Analysis job completed successfully across project source."
    );
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.error({ jobId, err }, "Analysis job failed.");

    job.status = "FAILED";
    job.stage = "FAILED";
    job.errorMessage = errorMsg;
    job.completedAt = new Date();
    await job.save();
  } finally {
    if (workspacePath) {
      await cleanupWorkspace(workspacePath);
    }
  }
}
