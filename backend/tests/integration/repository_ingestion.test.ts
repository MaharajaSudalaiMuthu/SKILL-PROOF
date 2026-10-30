import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import mongoose from 'mongoose';
import nock from 'nock';
import { execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import os from 'os';
import { app } from '../../src/server.js';
import { UserModel } from '../../src/models/User.js';
import { ConsentModel } from '../../src/models/Consent.js';
import { Repository } from '../../src/models/Repository.js';
import { AnalysisJob } from '../../src/models/AnalysisJob.js';
import { FileAttribution } from '../../src/models/FileAttribution.js';
import { signSessionToken } from '../../src/utils/jwt.js';
import { encryptToken } from '../../src/utils/encryption.js';
import { config } from '../../src/config/index.js';
import { WORKSPACE_BASE_DIR } from '../../src/ingestion/gitCloner.js';

const execFileAsync = promisify(execFile);

describe('Repository Ingestion & Authorship Attribution (R2, R3 Integration)', () => {
  let userACookie: string;
  let userBCookie: string;
  let userAId: string;
  let userBId: string;

  let fixtureGitDir: string;
  let commitSha1: string;
  let commitSha2: string;
  let commitSha3: string;

  beforeAll(async () => {
    if (mongoose.connection.readyState === 0) {
      await mongoose.connect(config.env.MONGODB_URI);
    }

    // Clean test collections
    await UserModel.deleteMany({});
    await ConsentModel.deleteMany({});
    await Repository.deleteMany({});
    await AnalysisJob.deleteMany({});
    await FileAttribution.deleteMany({});

    // 1. Create User A
    const encryptedTokenA = encryptToken('gho_mock_token_for_user_a');
    const userA = await UserModel.create({
      githubUserId: 10001,
      githubLogin: 'test-user',
      name: 'Test User A',
      avatarUrl: 'https://avatars.githubusercontent.com/u/10001',
      encryptedAccessToken: encryptedTokenA.ciphertext,
      tokenIv: encryptedTokenA.iv,
      tokenAuthTag: encryptedTokenA.authTag,
    });
    userAId = userA._id.toString();
    const tokenA = await signSessionToken({ userId: userAId, githubLogin: 'test-user' });
    userACookie = `SKILLPROOF_SESSION=${tokenA}`;

    // Record consent for User A
    await ConsentModel.create({
      userId: userA._id,
      consentVersion: '1.0',
      ipHash: 'test-hash-a',
      agree: true,
      consentedAt: new Date(),
    });

    // 2. Create User B
    const encryptedTokenB = encryptToken('gho_mock_token_for_user_b');
    const userB = await UserModel.create({
      githubUserId: 20002,
      githubLogin: 'other-user',
      name: 'Other User B',
      avatarUrl: 'https://avatars.githubusercontent.com/u/20002',
      encryptedAccessToken: encryptedTokenB.ciphertext,
      tokenIv: encryptedTokenB.iv,
      tokenAuthTag: encryptedTokenB.authTag,
    });
    userBId = userB._id.toString();
    const tokenB = await signSessionToken({ userId: userBId, githubLogin: 'other-user' });
    userBCookie = `SKILLPROOF_SESSION=${tokenB}`;

    // Record consent for User B
    await ConsentModel.create({
      userId: userB._id,
      consentVersion: '1.0',
      ipHash: 'test-hash-b',
      agree: true,
      consentedAt: new Date(),
    });

    // 3. Create Scripted Local Multi-Author Git Fixture
    fixtureGitDir = path.join(os.tmpdir(), `skillproof-test-fixture-${Date.now()}`);
    await fs.promises.mkdir(fixtureGitDir, { recursive: true });

    // Initialize git repo
    await execFileAsync('git', ['init', '-b', 'main'], { cwd: fixtureGitDir });
    await execFileAsync('git', ['config', 'user.name', 'Test User A'], { cwd: fixtureGitDir });
    await execFileAsync('git', ['config', 'user.email', 'test-user@example.com'], { cwd: fixtureGitDir });
    await execFileAsync('git', ['config', 'commit.gpgsign', 'false'], { cwd: fixtureGitDir });

    const srcDir = path.join(fixtureGitDir, 'src/main/java/com/example');
    await fs.promises.mkdir(srcDir, { recursive: true });
    const javaFile = path.join(srcDir, 'UserService.java');

    // Commit 1 (User A): 10 lines
    const content1 = `package com.example;

public class UserService {
    public String findById(String id) {
        return "user-" + id;
    }
}
`;
    await fs.promises.writeFile(javaFile, content1, 'utf8');
    await execFileAsync('git', ['add', '.'], { cwd: fixtureGitDir });
    await execFileAsync('git', ['commit', '-m', 'Commit 1 by User A'], { cwd: fixtureGitDir });
    const { stdout: sha1Out } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: fixtureGitDir });
    commitSha1 = sha1Out.trim();

    // Commit 2 (User B / collaborator): add 6 lines
    const content2 = content1.replace(
      '}\n',
      `    public void deleteById(String id) {
        // delete
    }
}\n`
    );
    await fs.promises.writeFile(javaFile, content2, 'utf8');
    await execFileAsync('git', ['config', 'user.name', 'Collaborator'], { cwd: fixtureGitDir });
    await execFileAsync('git', ['config', 'user.email', 'collab@example.com'], { cwd: fixtureGitDir });
    await execFileAsync('git', ['add', '.'], { cwd: fixtureGitDir });
    await execFileAsync('git', ['commit', '-m', 'Commit 2 by Collaborator'], { cwd: fixtureGitDir });
    const { stdout: sha2Out } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: fixtureGitDir });
    commitSha2 = sha2Out.trim();

    // Commit 3 (Unlinked author): add 6 lines
    const content3 = content2.replace(
      '}\n',
      `    public boolean exists(String id) {
        return true;
    }
}\n`
    );
    await fs.promises.writeFile(javaFile, content3, 'utf8');
    await execFileAsync('git', ['config', 'user.name', 'Unknown Dev'], { cwd: fixtureGitDir });
    await execFileAsync('git', ['config', 'user.email', 'unknown@external.org'], { cwd: fixtureGitDir });
    await execFileAsync('git', ['add', '.'], { cwd: fixtureGitDir });
    await execFileAsync('git', ['commit', '-m', 'Commit 3 by Unlinked'], { cwd: fixtureGitDir });
    const { stdout: sha3Out } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: fixtureGitDir });
    commitSha3 = sha3Out.trim();
  });

  afterAll(async () => {
    nock.cleanAll();
    // Cleanup fixture git repo
    if (fixtureGitDir && fs.existsSync(fixtureGitDir)) {
      await fs.promises.rm(fixtureGitDir, { recursive: true, force: true });
    }
    // Clean database records
    await UserModel.deleteMany({});
    await ConsentModel.deleteMany({});
    await Repository.deleteMany({});
    await AnalysisJob.deleteMany({});
    await FileAttribution.deleteMany({});
  });

  it('R2: should list public repositories from GitHub API via GET /api/repositories/github', async () => {
    nock(config.skillproof.github.apiBaseUrl)
      .get('/user/repos?type=owner&visibility=public&per_page=100')
      .reply(200, [
        {
          id: 991122,
          name: 'spring-demo',
          full_name: 'test-user/spring-demo',
          owner: { login: 'test-user' },
          html_url: 'https://github.com/test-user/spring-demo',
          clone_url: 'https://github.com/test-user/spring-demo.git',
          default_branch: 'main',
          fork: false,
          description: 'A test Spring Boot demo project',
          updated_at: '2026-10-20T10:00:00Z',
        },
      ]);

    const res = await request(app)
      .get('/api/repositories/github')
      .set('Cookie', [userACookie]);

    expect(res.status).toBe(200);
    expect(res.body.repositories).toHaveLength(1);
    expect(res.body.repositories[0].fullName).toBe('test-user/spring-demo');
    expect(res.body.repositories[0].ownerLogin).toBe('test-user');
  });

  it('R2: should select and persist repository via POST /api/repositories/select', async () => {
    const res = await request(app)
      .post('/api/repositories/select')
      .set('Cookie', [userACookie])
      .set('X-SkillProof-Request', 'true')
      .send({
        githubRepoId: 991122,
        fullName: 'test-user/spring-demo',
        cloneUrl: fixtureGitDir, // local fixture clone URL for test mode
        isFork: false,
        defaultBranch: 'main',
      });

    expect(res.status).toBe(200);
    expect(res.body.repository.fullName).toBe('test-user/spring-demo');

    // Verify GET /api/repositories lists the selected repo for User A
    const listRes = await request(app)
      .get('/api/repositories')
      .set('Cookie', [userACookie]);

    expect(listRes.status).toBe(200);
    expect(listRes.body.repositories).toHaveLength(1);
    expect(listRes.body.repositories[0].fullName).toBe('test-user/spring-demo');
  });

  it('R2 & R3: should queue analysis job, clone, run blame, resolve authors, and store attributions', async () => {
    const repo = await Repository.findOne({ userId: userAId, fullName: 'test-user/spring-demo' });
    expect(repo).toBeDefined();

    // Mock GitHub Commits API author resolutions
    // Commit 1: User A -> CONFIRMED
    nock(config.skillproof.github.apiBaseUrl)
      .get(`/repos/test-user/spring-demo/commits/${commitSha1}`)
      .reply(200, {
        sha: commitSha1,
        author: { login: 'test-user' },
      });

    // Commit 2: Collaborator -> OTHER
    nock(config.skillproof.github.apiBaseUrl)
      .get(`/repos/test-user/spring-demo/commits/${commitSha2}`)
      .reply(200, {
        sha: commitSha2,
        author: { login: 'collaborator' },
      });

    // Commit 3: Unlinked -> UNCERTAIN
    nock(config.skillproof.github.apiBaseUrl)
      .get(`/repos/test-user/spring-demo/commits/${commitSha3}`)
      .reply(200, {
        sha: commitSha3,
        author: null,
      });

    // Trigger analysis
    const analyzeRes = await request(app)
      .post(`/api/repositories/${repo!._id}/analyze`)
      .set('Cookie', [userACookie])
      .set('X-SkillProof-Request', 'true');

    expect(analyzeRes.status).toBe(202);
    expect(analyzeRes.body.jobId).toBeDefined();
    expect(analyzeRes.body.status).toBe('QUEUED');

    const jobId = analyzeRes.body.jobId;

    // Poll until analysis completes
    let attempts = 0;
    let completedJob: any = null;
    while (attempts < 30) {
      await new Promise((r) => setTimeout(r, 400));
      const pollRes = await request(app)
        .get(`/api/analysis/${jobId}`)
        .set('Cookie', [userACookie]);

      if (pollRes.body.status === 'SUCCEEDED' || pollRes.body.status === 'FAILED') {
        completedJob = pollRes.body;
        break;
      }
      attempts++;
    }

    expect(completedJob).not.toBeNull();
    if (completedJob.status === 'FAILED') {
      throw new Error(`JOB FAILED WITH ERROR: ${completedJob.errorMessage}`);
    }
    expect(completedJob.status).toBe('SUCCEEDED');
    expect(completedJob.progressPercent).toBe(100);
    expect(completedJob.filesAnalyzed).toBe(1);
    expect(completedJob.totalLines).toBeGreaterThan(0);
    expect(completedJob.confirmedLines).toBeGreaterThan(0);

    // Verify FileAttribution records
    const attrRes = await request(app)
      .get(`/api/repositories/${repo!._id}/attributions`)
      .set('Cookie', [userACookie]);

    expect(attrRes.status).toBe(200);
    expect(attrRes.body.attributions).toHaveLength(1);

    const attr = attrRes.body.attributions[0];
    expect(attr.filePath).toBe('src/main/java/com/example/UserService.java');
    expect(attr.ranges.length).toBeGreaterThanOrEqual(3);

    // Check status distribution in ranges
    const statuses = attr.ranges.map((r: any) => r.status);
    expect(statuses).toContain('CONFIRMED');
    expect(statuses).toContain('OTHER');
    expect(statuses).toContain('UNCERTAIN');

    // Confirm that User A's lines are marked CONFIRMED
    const confirmedRange = attr.ranges.find((r: any) => r.status === 'CONFIRMED');
    expect(confirmedRange.authorLogin).toBe('test-user');
    expect(confirmedRange.commitSha).toBe(commitSha1);

    // Confirm that collaborator lines are marked OTHER
    const otherRange = attr.ranges.find((r: any) => r.status === 'OTHER');
    expect(otherRange.authorLogin).toBe('collaborator');
    expect(otherRange.commitSha).toBe(commitSha2);

    // Confirm that unlinked lines are marked UNCERTAIN
    const uncertainRange = attr.ranges.find((r: any) => r.status === 'UNCERTAIN');
    expect(uncertainRange.authorLogin).toBeNull();
    expect(uncertainRange.commitSha).toBe(commitSha3);

    // Verify workspace directory cleanup
    const jobWorkspace = path.join(WORKSPACE_BASE_DIR, jobId);
    expect(fs.existsSync(jobWorkspace)).toBe(false);
  });

  it('User Isolation: User B cannot access User A repositories, jobs, or attributions', async () => {
    const repoA = await Repository.findOne({ userId: userAId });
    const jobA = await AnalysisJob.findOne({ userId: userAId });

    expect(repoA).toBeDefined();
    expect(jobA).toBeDefined();

    // User B listing repos should not see User A's repo
    const listRes = await request(app)
      .get('/api/repositories')
      .set('Cookie', [userBCookie]);
    expect(listRes.status).toBe(200);
    expect(listRes.body.repositories).toHaveLength(0);

    // User B attempting to trigger analysis on User A's repo
    const triggerRes = await request(app)
      .post(`/api/repositories/${repoA!._id}/analyze`)
      .set('Cookie', [userBCookie])
      .set('X-SkillProof-Request', 'true');
    expect(triggerRes.status).toBe(404);

    // User B attempting to poll User A's job
    const pollRes = await request(app)
      .get(`/api/analysis/${jobA!._id}`)
      .set('Cookie', [userBCookie]);
    expect(pollRes.status).toBe(404);

    // User B attempting to view User A's attributions
    const attrRes = await request(app)
      .get(`/api/repositories/${repoA!._id}/attributions`)
      .set('Cookie', [userBCookie]);
    expect(attrRes.status).toBe(404);
  });
});
