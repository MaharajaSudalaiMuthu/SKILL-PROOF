import path from 'path';
import fs from 'fs';
import os from 'os';
import multer from 'multer';
import { Router, Response } from 'express';
import { requireAuth, requireCsrf, requireConsent, AuthenticatedRequest } from '../middleware/auth.js';
import { SelectRepoSchema, GitHubRepoItem, RepositorySummary } from '@skillproof/shared';
import { Repository } from '../models/Repository.js';
import { AnalysisJob } from '../models/AnalysisJob.js';
import { FileAttribution } from '../models/FileAttribution.js';
import { AntiGamingFlag } from '../models/AntiGamingFlag.js';
import { EvidenceRecord } from '../models/EvidenceRecord.js';
import { UserModel } from '../models/User.js';
import { enqueueAnalysisJob } from '../ingestion/jobQueue.js';
import { decryptToken } from '../utils/encryption.js';
import { config } from '../config/index.js';
import { logger } from '../middleware/pinoLogger.js';

export const repositoryRouter = Router();

const uploadDir = path.join(os.tmpdir(), 'skillproof-uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
const upload = multer({ dest: uploadDir, limits: { fileSize: 100 * 1024 * 1024 } });

/**
 * GET /api/repositories/github
 * Lists public repositories owned by the authenticated GitHub user.
 */
repositoryRouter.get('/github', requireAuth, requireConsent, async (req: AuthenticatedRequest, res: Response) => {
  const DEMO_REPOSITORIES: GitHubRepoItem[] = [
    {
      id: 1001,
      name: 'spring-petclinic',
      fullName: 'spring-projects/spring-petclinic',
      ownerLogin: 'spring-projects',
      htmlUrl: 'https://github.com/spring-projects/spring-petclinic',
      cloneUrl: 'https://github.com/spring-projects/spring-petclinic.git',
      defaultBranch: 'main',
      isFork: false,
      description: 'Sample Spring Boot application demonstrating Spring MVC, Spring Data JPA, and validation.',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 1002,
      name: 'gs-rest-service',
      fullName: 'spring-guides/gs-rest-service',
      ownerLogin: 'spring-guides',
      htmlUrl: 'https://github.com/spring-guides/gs-rest-service',
      cloneUrl: 'https://github.com/spring-guides/gs-rest-service.git',
      defaultBranch: 'main',
      isFork: false,
      description: 'Building a RESTful Web Service with Spring Boot.',
      updatedAt: new Date().toISOString(),
    },
    {
      id: 1003,
      name: 'gs-accessing-data-jpa',
      fullName: 'spring-guides/gs-accessing-data-jpa',
      ownerLogin: 'spring-guides',
      htmlUrl: 'https://github.com/spring-guides/gs-accessing-data-jpa',
      cloneUrl: 'https://github.com/spring-guides/gs-accessing-data-jpa.git',
      defaultBranch: 'main',
      isFork: false,
      description: 'Accessing Data with JPA repository query methods.',
      updatedAt: new Date().toISOString(),
    },
  ];

  const user = await UserModel.findById(req.userId);
  if (!user || !user.encryptedAccessToken || !user.tokenIv || !user.tokenAuthTag) {
    res.status(200).json({ repositories: DEMO_REPOSITORIES });
    return;
  }

  let token: string = '';
  try {
    token = decryptToken({
      ciphertext: user.encryptedAccessToken,
      iv: user.tokenIv,
      authTag: user.tokenAuthTag,
    });
  } catch (err) {
    logger.warn({ userId: user._id, err }, 'Failed to decrypt GitHub token, falling back to demo repositories');
    res.status(200).json({ repositories: DEMO_REPOSITORIES });
    return;
  }

  // If token is a dummy demo token or user is dev_expert, return the verified sample repositories directly
  if (token === 'ghp_demo_token_skillproof' || user.githubLogin === 'dev_expert') {
    res.status(200).json({ repositories: DEMO_REPOSITORIES });
    return;
  }

  try {
    const url = `${config.skillproof.github.apiBaseUrl}/user/repos?type=owner&visibility=public&per_page=100`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'SkillProof-Platform',
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'GitHub API returned non-200 while listing repos, serving demo repos');
      res.status(200).json({ repositories: DEMO_REPOSITORIES });
      return;
    }

    const reposData = (await response.json()) as Array<{
      id: number;
      name: string;
      full_name: string;
      owner: { login: string };
      html_url: string;
      clone_url: string;
      default_branch: string;
      fork: boolean;
      description: string | null;
      updated_at: string;
    }>;

    const items: GitHubRepoItem[] = reposData.map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      ownerLogin: r.owner.login,
      htmlUrl: r.html_url,
      cloneUrl: r.clone_url,
      defaultBranch: r.default_branch || 'main',
      isFork: r.fork,
      description: r.description,
      updatedAt: r.updated_at,
    }));

    // Include the canonical demo repos alongside the user's repos
    res.status(200).json({ repositories: [...items, ...DEMO_REPOSITORIES] });
  } catch (err: unknown) {
    logger.error({ err }, 'Error calling GitHub API for user repos, falling back to demo repos');
    res.status(200).json({ repositories: DEMO_REPOSITORIES });
  }
});

/**
 * GET /api/repositories
 * Lists all selected repositories for the current user.
 */
repositoryRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const repositories = await Repository.find({ userId: req.userId }).sort({ createdAt: -1 });

  const summaries: RepositorySummary[] = await Promise.all(
    repositories.map(async (repo) => {
      const latestJob = await AnalysisJob.findOne({ repositoryId: repo._id }).sort({ createdAt: -1 });
      return {
        id: repo._id.toString(),
        userId: repo.userId.toString(),
        githubRepoId: repo.githubRepoId,
        fullName: repo.fullName,
        cloneUrl: repo.cloneUrl,
        isFork: repo.isFork,
        defaultBranch: repo.defaultBranch,
        sourceType: repo.sourceType || 'GITHUB',
        isPrivate: repo.isPrivate || false,
        detectedLanguages: repo.detectedLanguages || [],
        detectedFrameworks: repo.detectedFrameworks || [],
        lastAnalyzedAt: latestJob?.completedAt ? latestJob.completedAt.toISOString() : null,
        lastJobStatus: latestJob?.status ?? null,
        createdAt: repo.createdAt.toISOString(),
      };
    })
  );

  res.status(200).json({ repositories: summaries });
});

/**
 * POST /api/repositories/upload-zip
 * Uploads a student project ZIP archive for analysis.
 */
repositoryRouter.post('/upload-zip', requireAuth, requireCsrf, upload.single('projectZip'), async (req: AuthenticatedRequest, res: Response) => {
  if (!req.file) {
    res.status(400).json({
      timestamp: new Date().toISOString(),
      status: 400,
      error: 'FILE_REQUIRED',
      message: 'Please provide a valid .zip project archive.',
      path: req.originalUrl,
    });
    return;
  }

  const cleanOriginal = req.file.originalname.replace(/[^a-zA-Z0-9_.-]/g, '_');
  const repoName = cleanOriginal.replace(/\.zip$/i, '') || 'student-project';
  const fullName = `upload/${repoName}`;
  const zipPath = req.file.path;
  const githubRepoId = Math.floor(Math.random() * 899999) + 100000;

  const repository = await Repository.create({
    userId: req.userId,
    githubRepoId,
    fullName,
    cloneUrl: `file://${zipPath}`,
    sourceType: 'ZIP_UPLOAD',
    zipFilePath: zipPath,
    isFork: false,
    defaultBranch: 'main',
  });

  res.status(201).json({
    message: 'Project ZIP uploaded and registered successfully.',
    repository: {
      id: repository._id.toString(),
      githubRepoId: repository.githubRepoId,
      fullName: repository.fullName,
      cloneUrl: repository.cloneUrl,
      sourceType: 'ZIP_UPLOAD',
      defaultBranch: 'main',
    },
  });
});

/**
 * POST /api/repositories/select
 * Selects an arbitrary public or private repository for analysis.
 */
repositoryRouter.post('/select', requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = SelectRepoSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      timestamp: new Date().toISOString(),
      status: 400,
      error: 'VALIDATION_ERROR',
      message: parsed.error.errors.map((e) => e.message).join(', '),
      path: req.originalUrl,
    });
    return;
  }

  const { githubRepoId, fullName, cloneUrl, isFork, defaultBranch, sourceType, isPrivate, accessToken } = parsed.data;
  const repoId = githubRepoId || (Math.floor(Math.random() * 899999) + 100000);

  // Upsert repository for this user
  const repository = await Repository.findOneAndUpdate(
    { userId: req.userId, fullName },
    {
      $set: {
        githubRepoId: repoId,
        fullName,
        cloneUrl,
        isFork: isFork || false,
        defaultBranch: defaultBranch || 'main',
        sourceType: sourceType || 'GITHUB',
        isPrivate: isPrivate || !!accessToken,
        accessToken: accessToken || undefined,
      },
    },
    { upsert: true, new: true }
  );

  res.status(200).json({
    message: 'Repository selected successfully.',
    repository: {
      id: repository._id.toString(),
      githubRepoId: repository.githubRepoId,
      fullName: repository.fullName,
      cloneUrl: repository.cloneUrl,
      isFork: repository.isFork,
      defaultBranch: repository.defaultBranch,
      sourceType: repository.sourceType,
      isPrivate: repository.isPrivate,
    },
  });
});

/**
 * POST /api/repositories/:id/analyze
 * Enqueues an asynchronous analysis job for a selected repository.
 */
repositoryRouter.post('/:id/analyze', requireAuth, requireCsrf, requireConsent, async (req: AuthenticatedRequest, res: Response) => {
  const repository = await Repository.findOne({ _id: req.params.id, userId: req.userId });
  if (!repository) {
    res.status(404).json({
      timestamp: new Date().toISOString(),
      status: 404,
      error: 'NOT_FOUND',
      message: 'Repository not found or access denied.',
      path: req.originalUrl,
    });
    return;
  }

  // Check if an analysis is already queued or running for this repository
  const existingJob = await AnalysisJob.findOne({
    repositoryId: repository._id,
    userId: req.userId,
    status: { $in: ['QUEUED', 'RUNNING'] },
  });

  if (existingJob) {
    res.status(200).json({
      message: 'Analysis job is already in progress.',
      jobId: existingJob._id.toString(),
      status: existingJob.status,
    });
    return;
  }

  // Create new analysis job
  const job = await AnalysisJob.create({
    repositoryId: repository._id,
    userId: req.userId,
    status: 'QUEUED',
    stage: 'QUEUED',
    progressPercent: 0,
  });

  // Enqueue in worker queue
  enqueueAnalysisJob(job._id.toString());

  res.status(202).json({
    message: 'Analysis job queued successfully.',
    jobId: job._id.toString(),
    status: 'QUEUED',
  });
});

/**
 * GET /api/repositories/:id/attributions
 * Retrieves line-level file attributions for an analyzed repository.
 */
repositoryRouter.get('/:id/attributions', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const repository = await Repository.findOne({ _id: req.params.id, userId: req.userId });
  if (!repository) {
    res.status(404).json({
      timestamp: new Date().toISOString(),
      status: 404,
      error: 'NOT_FOUND',
      message: 'Repository not found or access denied.',
      path: req.originalUrl,
    });
    return;
  }

  const attributions = await FileAttribution.find({
    repositoryId: repository._id,
    userId: req.userId,
  }).sort({ filePath: 1 });

  res.status(200).json({ attributions });
});

/**
 * GET /api/repositories/:id/flags
 * Retrieves anti-gaming flags generated for this repository.
 */
repositoryRouter.get('/:id/flags', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const repository = await Repository.findOne({ _id: req.params.id, userId: req.userId });
  if (!repository) {
    res.status(404).json({
      timestamp: new Date().toISOString(),
      status: 404,
      error: 'NOT_FOUND',
      message: 'Repository not found or access denied.',
      path: req.originalUrl,
    });
    return;
  }

  const flags = await AntiGamingFlag.find({
    repositoryId: repository._id,
    userId: req.userId,
  }).sort({ createdAt: -1 });

  res.status(200).json({ flags });
});

/**
 * GET /api/repositories/:id/evidence
 * Retrieves static capability evidence findings for this repository.
 */
repositoryRouter.get('/:id/evidence', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const repository = await Repository.findOne({ _id: req.params.id, userId: req.userId });
  if (!repository) {
    res.status(404).json({
      timestamp: new Date().toISOString(),
      status: 404,
      error: 'NOT_FOUND',
      message: 'Repository not found or access denied.',
      path: req.originalUrl,
    });
    return;
  }

  const evidence = await EvidenceRecord.find({
    repositoryId: repository._id,
    userId: req.userId,
    evidenceType: 'STATIC',
  }).sort({ skillSlug: 1, createdAt: -1 });

  res.status(200).json({ evidence });
});

/**
 * GET /api/analysis/:jobId
 * Polls progress and status of an analysis job.
 */
export const analysisRouter = Router();

analysisRouter.get('/:jobId', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const job = await AnalysisJob.findOne({ _id: req.params.jobId, userId: req.userId });
  if (!job) {
    res.status(404).json({
      timestamp: new Date().toISOString(),
      status: 404,
      error: 'NOT_FOUND',
      message: 'Analysis job not found or access denied.',
      path: req.originalUrl,
    });
    return;
  }

  const repo = await Repository.findById(job.repositoryId);

  res.status(200).json({
    id: job._id.toString(),
    repositoryId: job.repositoryId.toString(),
    repositoryFullName: repo?.fullName ?? 'Unknown Repository',
    userId: job.userId.toString(),
    status: job.status,
    progressPercent: job.progressPercent,
    stage: job.stage,
    errorMessage: job.errorMessage,
    filesAnalyzed: job.filesAnalyzed,
    totalLines: job.totalLines,
    confirmedLines: job.confirmedLines,
    startedAt: job.startedAt ? job.startedAt.toISOString() : null,
    completedAt: job.completedAt ? job.completedAt.toISOString() : null,
    createdAt: job.createdAt.toISOString(),
  });
});
