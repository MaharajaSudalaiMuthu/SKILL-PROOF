import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { checkUnmodifiedFork } from '../../src/antigaming/unmodifiedForkCheck.js';
import {
  normalizeJavaTokens,
  computeWinnowingFingerprints,
  computeContainment,
} from '../../src/antigaming/winnowing.js';
import { checkTutorialSimilarity } from '../../src/antigaming/tutorialSimilarityCheck.js';
import { ReferenceFingerprint } from '../../src/models/ReferenceFingerprint.js';
import { checkLargeInitialCommit } from '../../src/antigaming/largeInitialCommitCheck.js';
import { FileAttribution } from '../../src/models/FileAttribution.js';
import { config } from '../../src/config/index.js';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';

const execFileAsync = promisify(execFile);

describe('Anti-Gaming Unit Tests (R4, R13, R14)', () => {
  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.env.MONGODB_URI);
    }
    await ReferenceFingerprint.deleteMany({});
    await FileAttribution.deleteMany({});
  });

  afterAll(async () => {
    await ReferenceFingerprint.deleteMany({});
    await FileAttribution.deleteMany({});
  });

  describe('Unmodified Fork Detection (R4)', () => {
    it('returns null if repository is not a fork', () => {
      const result = checkUnmodifiedFork({
        repositoryId: 'repo-1',
        userId: 'user-1',
        isFork: false,
        totalJavaLines: 500,
        confirmedJavaLines: 10,
      });
      expect(result).toBeNull();
    });

    it('returns BLOCKING flag if fork has < 50 confirmed lines', () => {
      const result = checkUnmodifiedFork({
        repositoryId: 'repo-2',
        userId: 'user-1',
        isFork: true,
        totalJavaLines: 100,
        confirmedJavaLines: 30, // 30 < 50
      });
      expect(result).not.toBeNull();
      expect(result?.severity).toBe('BLOCKING');
      expect(result?.flagType).toBe('UNMODIFIED_FORK');
      expect(result?.explanation).toContain('below threshold of 50 lines');
    });

    it('returns BLOCKING flag if fork has < 20% confirmed ratio', () => {
      const result = checkUnmodifiedFork({
        repositoryId: 'repo-3',
        userId: 'user-1',
        isFork: true,
        totalJavaLines: 1000,
        confirmedJavaLines: 80, // 8% < 20% even though 80 > 50
      });
      expect(result).not.toBeNull();
      expect(result?.severity).toBe('BLOCKING');
      expect(result?.flagType).toBe('UNMODIFIED_FORK');
      expect(result?.explanation).toContain('8%');
    });

    it('returns null if fork has >= 50 confirmed lines and >= 20% ratio', () => {
      const result = checkUnmodifiedFork({
        repositoryId: 'repo-4',
        userId: 'user-1',
        isFork: true,
        totalJavaLines: 500,
        confirmedJavaLines: 250, // 50% >= 20% and 250 >= 50
      });
      expect(result).toBeNull();
    });
  });

  describe('Winnowing Algorithm (R13)', () => {
    it('normalizes Java tokens by stripping comments, string literals, and numbers', () => {
      const source = `
        // Line comment
        /* Block
           comment */
        String msg = "Hello World";
        int count = 42;
      `;
      const tokens = normalizeJavaTokens(source);
      expect(tokens).toContain('$STR');
      expect(tokens).toContain('$NUM');
      expect(tokens).not.toContain('Hello World');
      expect(tokens).not.toContain('Line comment');
    });

    it('computes identical fingerprints for structurally identical code with whitespace differences', () => {
      const code1 = `
        public class MyController {
          public String greet(String name) {
            return "Hello " + name;
          }
        }
      `;
      const code2 = `
        public    class   MyController   {
          public  String   greet ( String  name )   {
            return   "Hi "   +   name ;
          }
        }
      `;

      const fp1 = computeWinnowingFingerprints(code1);
      const fp2 = computeWinnowingFingerprints(code2);

      // Both should yield non-empty fingerprints and high containment
      expect(fp1.size).toBeGreaterThan(0);
      expect(fp2.size).toBeGreaterThan(0);
      const containment = computeContainment(fp1, fp2);
      expect(containment).toBe(1.0);
    });

    it('returns zero containment for completely distinct code', () => {
      const codeA = `
        public class MathService {
          public int add(int a, int b) {
            return a + b;
          }
          public int subtract(int a, int b) {
            return a - b;
          }
        }
      `;
      const codeB = `
        public class DatabaseManager {
          public void connectToCluster(String host, int port) {
            Socket socket = new Socket(host, port);
          }
        }
      `;

      const fpA = computeWinnowingFingerprints(codeA);
      const fpB = computeWinnowingFingerprints(codeB);

      const containment = computeContainment(fpA, fpB);
      expect(containment).toBeLessThan(0.3);
    });
  });

  describe('Tutorial Similarity Check (R13)', () => {
    it('flags repository as BLOCKING when similarity to reference corpus exceeds 60%', async () => {
      const refSource = `
        package org.springframework.samples.petclinic.owner;
        import org.springframework.stereotype.Controller;
        import org.springframework.web.bind.annotation.GetMapping;
        import org.springframework.web.bind.annotation.PostMapping;

        @Controller
        class OwnerController {
          private final OwnerRepository owners;

          public OwnerController(OwnerRepository clinicService) {
            this.owners = clinicService;
          }

          @GetMapping("/owners/new")
          public String initCreationForm(Map<String, Object> model) {
            Owner owner = new Owner();
            model.put("owner", owner);
            return "owners/createOrUpdateOwnerForm";
          }
        }
      `;

      const refFps = computeWinnowingFingerprints(refSource);
      for (const hash of refFps) {
        await ReferenceFingerprint.create({
          projectName: 'spring-petclinic',
          commitSha: 'a1b2c3d4e5f6',
          fingerprintHash: hash,
        });
      }

      // Candidate file that copied the exact reference controller
      const candidateFlag = await checkTutorialSimilarity({
        repositoryId: 'cand-repo-1',
        userId: 'cand-user-1',
        javaFileSources: [refSource],
      });

      expect(candidateFlag).not.toBeNull();
      expect(candidateFlag?.severity).toBe('BLOCKING');
      expect(candidateFlag?.flagType).toBe('TUTORIAL_SIMILARITY');
      expect(candidateFlag?.explanation).toContain("reference project 'spring-petclinic'");
      expect(candidateFlag?.metricValue).toBeGreaterThanOrEqual(0.60);
    });

    it('returns null when candidate repository has low similarity to reference corpus', async () => {
      const distinctSource = `
        package com.mycorp.customapp;
        import java.nio.channels.FileChannel;
        import java.nio.ByteBuffer;

        public class FastDiskWriter {
          public void writeDirect(byte[] bytes) {
            ByteBuffer buffer = ByteBuffer.wrap(bytes);
          }
        }
      `;

      const candidateFlag = await checkTutorialSimilarity({
        repositoryId: 'cand-repo-2',
        userId: 'cand-user-1',
        javaFileSources: [distinctSource],
      });

      expect(candidateFlag).toBeNull();
    });
  });

  describe('Large Initial Commit Detection (R14)', () => {
    let tempGitDir: string;
    let initialCommitSha: string;
    let secondCommitSha: string;

    beforeAll(async () => {
      tempGitDir = fs.mkdtempSync(path.join(os.tmpdir(), 'skillproof-initial-commit-test-'));
      await execFileAsync('git', ['init'], { cwd: tempGitDir });
      await execFileAsync('git', ['config', 'user.name', 'Dev User'], { cwd: tempGitDir });
      await execFileAsync('git', ['config', 'user.email', 'dev@example.com'], { cwd: tempGitDir });

      // Initial commit with 90 lines
      const bigFile = Array.from({ length: 90 }, (_, i) => `// Line ${i}`).join('\n');
      fs.writeFileSync(path.join(tempGitDir, 'BigFile.java'), bigFile);
      await execFileAsync('git', ['add', '.'], { cwd: tempGitDir });
      await execFileAsync('git', ['commit', '-m', 'Initial bulk dump'], { cwd: tempGitDir });
      const { stdout: stdout1 } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: tempGitDir });
      initialCommitSha = stdout1.trim();

      // Second commit with 10 lines
      const smallFile = Array.from({ length: 10 }, (_, i) => `// Small ${i}`).join('\n');
      fs.writeFileSync(path.join(tempGitDir, 'SmallFile.java'), smallFile);
      await execFileAsync('git', ['add', '.'], { cwd: tempGitDir });
      await execFileAsync('git', ['commit', '-m', 'Small tweak'], { cwd: tempGitDir });
      const { stdout: stdout2 } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: tempGitDir });
      secondCommitSha = stdout2.trim();
    });

    afterAll(async () => {
      fs.rmSync(tempGitDir, { recursive: true, force: true });
    });

    it('returns WARNING flag when root commit contributes >= 80% of lines', async () => {
      const repoId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      // Mock FileAttribution docs matching git commits
      await FileAttribution.create({
        analysisJobId: new mongoose.Types.ObjectId(),
        repositoryId: repoId,
        userId,
        filePath: 'BigFile.java',
        ranges: [{
          startLine: 1,
          endLine: 90,
          commitSha: initialCommitSha,
          commitDate: new Date(),
          authorLogin: 'dev-user',
          status: 'CONFIRMED',
        }],
        totalLines: 90,
        confirmedLines: 90,
        uncertainLines: 0,
        otherLines: 0,
      });

      await FileAttribution.create({
        analysisJobId: new mongoose.Types.ObjectId(),
        repositoryId: repoId,
        userId,
        filePath: 'SmallFile.java',
        ranges: [{
          startLine: 1,
          endLine: 10,
          commitSha: secondCommitSha,
          commitDate: new Date(),
          authorLogin: 'dev-user',
          status: 'CONFIRMED',
        }],
        totalLines: 10,
        confirmedLines: 10,
        uncertainLines: 0,
        otherLines: 0,
      });

      const flag = await checkLargeInitialCommit({
        repositoryId: repoId.toString(),
        userId: userId.toString(),
        workspacePath: tempGitDir,
        totalJavaLines: 100,
      });

      expect(flag).not.toBeNull();
      expect(flag?.severity).toBe('WARNING');
      expect(flag?.flagType).toBe('LARGE_INITIAL_COMMIT');
      expect(flag?.metricValue).toBe(0.9);
      expect(flag?.explanation).toContain('90%');
    });

    it('returns null when root commit contributes < 80% of lines', async () => {
      const repoId = new mongoose.Types.ObjectId();
      const userId = new mongoose.Types.ObjectId();

      await FileAttribution.create({
        analysisJobId: new mongoose.Types.ObjectId(),
        repositoryId: repoId,
        userId,
        filePath: 'BigFile.java',
        ranges: [{
          startLine: 1,
          endLine: 30,
          commitSha: initialCommitSha,
          commitDate: new Date(),
          authorLogin: 'dev-user',
          status: 'CONFIRMED',
        }],
        totalLines: 30,
        confirmedLines: 30,
        uncertainLines: 0,
        otherLines: 0,
      });

      const flag = await checkLargeInitialCommit({
        repositoryId: repoId.toString(),
        userId: userId.toString(),
        workspacePath: tempGitDir,
        totalJavaLines: 100, // 30 / 100 = 30% < 80%
      });

      expect(flag).toBeNull();
    });
  });
});
