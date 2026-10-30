import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
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
import { AntiGamingFlag } from '../../src/models/AntiGamingFlag.js';
import { EvidenceRecord } from '../../src/models/EvidenceRecord.js';
import { ReferenceFingerprint } from '../../src/models/ReferenceFingerprint.js';
import { signSessionToken } from '../../src/utils/jwt.js';
import { encryptToken } from '../../src/utils/encryption.js';
import { config } from '../../src/config/index.js';
import { authorResolver } from '../../src/ingestion/jobQueue.js';

const execFileAsync = promisify(execFile);

describe('Detectors, Evidence Persistence & Anti-Gaming Pipeline (Phase 4 Integration)', () => {
  beforeEach(() => {
    authorResolver.clearCache();
  });
  let userACookie: string;
  let userBCookie: string;
  let userAId: string;
  let userBId: string;

  let fixtureGitDir: string;
  let singleCommitGitDir: string;
  let commitSha1: string;
  let commitSha2: string;
  let singleCommitSha: string;

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
    await AntiGamingFlag.deleteMany({});
    await EvidenceRecord.deleteMany({});
    await ReferenceFingerprint.deleteMany({});

    // 1. Create User A
    const encTokenA = encryptToken('gho_token_user_a');
    const userA = await UserModel.create({
      githubUserId: 55001,
      githubLogin: 'test-dev',
      name: 'Test Developer',
      avatarUrl: 'https://avatars.githubusercontent.com/u/55001',
      encryptedAccessToken: encTokenA.ciphertext,
      tokenIv: encTokenA.iv,
      tokenAuthTag: encTokenA.authTag,
    });
    userAId = userA._id.toString();
    const tokenA = await signSessionToken({ userId: userAId, githubLogin: 'test-dev' });
    userACookie = `SKILLPROOF_SESSION=${tokenA}`;

    await ConsentModel.create({
      userId: userA._id,
      consentVersion: '1.0',
      ipHash: 'test-ip-a',
      agree: true,
      consentedAt: new Date(),
    });

    // 2. Create User B (for isolation testing)
    const encTokenB = encryptToken('gho_token_user_b');
    const userB = await UserModel.create({
      githubUserId: 55002,
      githubLogin: 'other-dev',
      name: 'Other Developer',
      avatarUrl: 'https://avatars.githubusercontent.com/u/55002',
      encryptedAccessToken: encTokenB.ciphertext,
      tokenIv: encTokenB.iv,
      tokenAuthTag: encTokenB.authTag,
    });
    userBId = userB._id.toString();
    const tokenB = await signSessionToken({ userId: userBId, githubLogin: 'other-dev' });
    userBCookie = `SKILLPROOF_SESSION=${tokenB}`;

    await ConsentModel.create({
      userId: userB._id,
      consentVersion: '1.0',
      ipHash: 'test-ip-b',
      agree: true,
      consentedAt: new Date(),
    });

    // 3. Create Full Multi-Commit Spring Boot Git Fixture
    fixtureGitDir = path.join(os.tmpdir(), `skillproof-p4-fixture-${Date.now()}`);
    await fs.promises.mkdir(fixtureGitDir, { recursive: true });

    await execFileAsync('git', ['init', '-b', 'main'], { cwd: fixtureGitDir });
    await execFileAsync('git', ['config', 'user.name', 'Test Developer'], { cwd: fixtureGitDir });
    await execFileAsync('git', ['config', 'user.email', 'test-dev@example.com'], { cwd: fixtureGitDir });
    await execFileAsync('git', ['config', 'commit.gpgsign', 'false'], { cwd: fixtureGitDir });

    const mainSrc = path.join(fixtureGitDir, 'src/main/java/com/example/demo');
    const testSrc = path.join(fixtureGitDir, 'src/test/java/com/example/demo');
    await fs.promises.mkdir(path.join(mainSrc, 'dto'), { recursive: true });
    await fs.promises.mkdir(path.join(mainSrc, 'model'), { recursive: true });
    await fs.promises.mkdir(path.join(mainSrc, 'repo'), { recursive: true });
    await fs.promises.mkdir(path.join(mainSrc, 'exception'), { recursive: true });
    await fs.promises.mkdir(path.join(mainSrc, 'service'), { recursive: true });
    await fs.promises.mkdir(path.join(mainSrc, 'controller'), { recursive: true });
    await fs.promises.mkdir(path.join(mainSrc, 'config'), { recursive: true });
    await fs.promises.mkdir(path.join(mainSrc, 'security'), { recursive: true });
    await fs.promises.mkdir(testSrc, { recursive: true });

    // File 1: DTO (input-validation)
    await fs.promises.writeFile(
      path.join(mainSrc, 'dto/CreateUserRequest.java'),
      `package com.example.demo.dto;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Min;

public class CreateUserRequest {
    @NotBlank
    private String username;

    @NotNull
    @Min(18)
    private Integer age;

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    public Integer getAge() { return age; }
    public void setAge(Integer age) { this.age = age; }
}
`
    );

    // File 2: Entity (jpa-hibernate-persistence)
    await fs.promises.writeFile(
      path.join(mainSrc, 'model/User.java'),
      `package com.example.demo.model;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;

@Entity
public class User {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    private String username;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
}
`
    );

    // File 3: Repository (jpa-hibernate-persistence)
    await fs.promises.writeFile(
      path.join(mainSrc, 'repo/UserRepository.java'),
      `package com.example.demo.repo;
import org.springframework.data.jpa.repository.JpaRepository;
import com.example.demo.model.User;

public interface UserRepository extends JpaRepository<User, Long> {
}
`
    );

    // File 4: Custom Exception (structured-exception-handling)
    await fs.promises.writeFile(
      path.join(mainSrc, 'exception/UserNotFoundException.java'),
      `package com.example.demo.exception;

public class UserNotFoundException extends RuntimeException {
    public UserNotFoundException(String message) {
        super(message);
    }
}
`
    );

    // File 5: Global Exception Handler (structured-exception-handling)
    await fs.promises.writeFile(
      path.join(mainSrc, 'exception/GlobalExceptionHandler.java'),
      `package com.example.demo.exception;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;

@RestControllerAdvice
public class GlobalExceptionHandler {
    @ExceptionHandler(UserNotFoundException.class)
    public ResponseEntity<String> handleNotFound(UserNotFoundException ex) {
        return new ResponseEntity<>(ex.getMessage(), HttpStatus.NOT_FOUND);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<String> handleBadRequest(IllegalArgumentException ex) {
        return new ResponseEntity<>(ex.getMessage(), HttpStatus.BAD_REQUEST);
    }
}
`
    );

    // First commit
    await execFileAsync('git', ['add', '.'], { cwd: fixtureGitDir });
    await execFileAsync('git', ['commit', '-m', 'Add models, repo, and exception handlers'], { cwd: fixtureGitDir });
    const { stdout: c1Out } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: fixtureGitDir });
    commitSha1 = c1Out.trim();

    // File 6: Service (transaction-management + throws UserNotFoundException)
    await fs.promises.writeFile(
      path.join(mainSrc, 'service/UserService.java'),
      `package com.example.demo.service;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.demo.model.User;
import com.example.demo.repo.UserRepository;
import com.example.demo.exception.UserNotFoundException;

@Service
@Transactional
public class UserService {
    private final UserRepository userRepository;

    public UserService(UserRepository userRepository) {
        this.userRepository = userRepository;
    }

    public User createUser(User user) {
        return userRepository.save(user);
    }

    public User getUser(Long id) {
        return userRepository.findById(id).orElseThrow(() -> new UserNotFoundException("User not found: " + id));
    }
}
`
    );

    // File 7: Controller (rest-controller-design + input-validation enforcement)
    await fs.promises.writeFile(
      path.join(mainSrc, 'controller/UserController.java'),
      `package com.example.demo.controller;
import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import jakarta.validation.Valid;
import com.example.demo.dto.CreateUserRequest;
import com.example.demo.model.User;
import com.example.demo.service.UserService;

@RestController
@RequestMapping("/api/users")
public class UserController {
    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/{id}")
    public ResponseEntity<User> getUser(@PathVariable Long id) {
        return ResponseEntity.ok(userService.getUser(id));
    }

    @PostMapping
    public ResponseEntity<User> createUser(@Valid @RequestBody CreateUserRequest request) {
        User user = new User();
        user.setUsername(request.getUsername());
        return ResponseEntity.ok(userService.createUser(user));
    }
}
`
    );

    // File 8: Spring Security Config (spring-security-configuration)
    await fs.promises.writeFile(
      path.join(mainSrc, 'config/SecurityConfig.java'),
      `package com.example.demo.config;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Bean;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;

@Configuration
@EnableWebSecurity
public class SecurityConfig {
    @Bean
    public SecurityFilterChain filterChain(HttpSecurity http) throws Exception {
        http.authorizeHttpRequests(auth -> auth
            .requestMatchers("/api/public/**").permitAll()
            .anyRequest().authenticated()
        );
        return http.build();
    }
}
`
    );

    // File 9: JWT Utility (jwt-issuance-validation)
    await fs.promises.writeFile(
      path.join(mainSrc, 'security/JwtService.java'),
      `package com.example.demo.security;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.SignatureAlgorithm;
import java.util.Date;

public class JwtService {
    private String secretKey = "mySecretKeyForSigningJwtTokens1234567890";

    public String generateToken(String username) {
        return Jwts.builder()
            .setSubject(username)
            .setIssuedAt(new Date())
            .setExpiration(new Date(System.currentTimeMillis() + 86400000))
            .signWith(SignatureAlgorithm.HS256, secretKey)
            .compact();
    }

    public String extractUsername(String token) {
        return Jwts.parser()
            .setSigningKey(secretKey)
            .parseClaimsJws(token)
            .getBody()
            .getSubject();
    }
}
`
    );

    // File 10: Unit Test (unit-tests-meaningful-assertions)
    await fs.promises.writeFile(
      path.join(testSrc, 'UserServiceTest.java'),
      `package com.example.demo;
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

public class UserServiceTest {
    @Test
    public void testUserCreation() {
        String name = "alice";
        assertEquals("alice", name);
    }

    @Test
    public void testUserAgeVerification() {
        int age = 25;
        assertTrue(age >= 18);
    }

    @Test
    public void testExceptionWhenNotFound() {
        assertThrows(RuntimeException.class, () -> {
            throw new RuntimeException("not found");
        });
    }
}
`
    );

    // Second commit
    await execFileAsync('git', ['add', '.'], { cwd: fixtureGitDir });
    await execFileAsync('git', ['commit', '-m', 'Add services, controllers, security, jwt, and tests'], {
      cwd: fixtureGitDir,
    });
    const { stdout: c2Out } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: fixtureGitDir });
    commitSha2 = c2Out.trim();

    // 4. Create Single-Commit Repo for Large Initial Commit check
    singleCommitGitDir = path.join(os.tmpdir(), `skillproof-p4-singlecommit-${Date.now()}`);
    await fs.promises.mkdir(singleCommitGitDir, { recursive: true });
    await execFileAsync('git', ['init', '-b', 'main'], { cwd: singleCommitGitDir });
    await execFileAsync('git', ['config', 'user.name', 'Test Developer'], { cwd: singleCommitGitDir });
    await execFileAsync('git', ['config', 'user.email', 'test-dev@example.com'], { cwd: singleCommitGitDir });
    await execFileAsync('git', ['config', 'commit.gpgsign', 'false'], { cwd: singleCommitGitDir });

    const bulkSrc = path.join(singleCommitGitDir, 'src/main/java/com/example');
    await fs.promises.mkdir(bulkSrc, { recursive: true });
    const bulkLines = Array.from({ length: 80 }, (_, i) => `// Line ${i}`).join('\n');
    await fs.promises.writeFile(
      path.join(bulkSrc, 'BulkApp.java'),
      `package com.example;\npublic class BulkApp {\n${bulkLines}\n}\n`
    );
    await execFileAsync('git', ['add', '.'], { cwd: singleCommitGitDir });
    await execFileAsync('git', ['commit', '-m', 'Initial huge dump commit'], { cwd: singleCommitGitDir });
    const { stdout: sOut } = await execFileAsync('git', ['rev-parse', 'HEAD'], { cwd: singleCommitGitDir });
    singleCommitSha = sOut.trim();
  });

  afterAll(async () => {
    nock.cleanAll();
    if (fixtureGitDir && fs.existsSync(fixtureGitDir)) {
      await fs.promises.rm(fixtureGitDir, { recursive: true, force: true });
    }
    if (singleCommitGitDir && fs.existsSync(singleCommitGitDir)) {
      await fs.promises.rm(singleCommitGitDir, { recursive: true, force: true });
    }
    await UserModel.deleteMany({});
    await ConsentModel.deleteMany({});
    await Repository.deleteMany({});
    await AnalysisJob.deleteMany({});
    await FileAttribution.deleteMany({});
    await AntiGamingFlag.deleteMany({});
    await EvidenceRecord.deleteMany({});
    await ReferenceFingerprint.deleteMany({});
  });

  it('R5, R6, R15: Runs full pipeline and generates VALID EvidenceRecords for all 8 Java capabilities', async () => {
    // Mock GitHub Commits API for commitSha1 and commitSha2 to resolve to User A (test-dev)
    nock(config.skillproof.github.apiBaseUrl)
      .get(`/repos/test-dev/full-spring-app/commits/${commitSha1}`)
      .reply(200, {
        sha: commitSha1,
        author: { login: 'test-dev' },
      });

    nock(config.skillproof.github.apiBaseUrl)
      .get(`/repos/test-dev/full-spring-app/commits/${commitSha2}`)
      .reply(200, {
        sha: commitSha2,
        author: { login: 'test-dev' },
      });

    // Create repository document in Mongo
    const repo = await Repository.create({
      userId: userAId,
      githubRepoId: 998877,
      name: 'full-spring-app',
      fullName: 'test-dev/full-spring-app',
      ownerLogin: 'test-dev',
      htmlUrl: 'https://github.com/test-dev/full-spring-app',
      cloneUrl: fixtureGitDir, // Test-override local fixture URL
      defaultBranch: 'main',
      isPrivate: false,
      isFork: false,
      selectedForAnalysis: true,
      lastAnalyzedAt: null,
    });

    // Trigger analysis
    const analyzeRes = await request(app)
      .post(`/api/repositories/${repo._id}/analyze`)
      .set('Cookie', [userACookie])
      .set('X-SkillProof-Request', 'true');

    expect(analyzeRes.status).toBe(202);
    const jobId = analyzeRes.body.jobId;

    // Poll until completed
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
      throw new Error(`Job failed: ${completedJob.errorMessage}`);
    }
    expect(completedJob.status).toBe('SUCCEEDED');
    expect(completedJob.progressPercent).toBe(100);

    // Verify Evidence Records in DB
    const evidenceDocs = await EvidenceRecord.find({ repositoryId: repo._id, userId: userAId });
    expect(evidenceDocs.length).toBeGreaterThanOrEqual(8);

    const generatedSkills = new Set(evidenceDocs.map((e) => e.skillSlug));
    const expectedSkills = [
      'rest-controller-design',
      'jpa-hibernate-persistence',
      'spring-security-configuration',
      'jwt-issuance-validation',
      'structured-exception-handling',
      'unit-tests-meaningful-assertions',
      'transaction-management',
      'input-validation',
    ];

    for (const skill of expectedSkills) {
      expect(generatedSkills.has(skill)).toBe(true);
    }

    // Verify attributes on evidence records
    for (const record of evidenceDocs) {
      expect(record.evidenceType).toBe('STATIC');
      expect(record.validityStatus).toBe('VALID');
      expect(record.recencyWeight).toBeGreaterThan(0);
      expect(record.recencyWeight).toBeLessThanOrEqual(1.0);
      expect(record.dedupeKey).toBeDefined();
      expect(record.startLine).toBeGreaterThanOrEqual(1);
      expect(record.endLine).toBeGreaterThanOrEqual(record.startLine!);
    }

    // Test API endpoint: GET /api/repositories/:id/evidence
    const evidenceRes = await request(app)
      .get(`/api/repositories/${repo._id}/evidence`)
      .set('Cookie', [userACookie]);

    expect(evidenceRes.status).toBe(200);
    expect(evidenceRes.body.evidence.length).toBeGreaterThanOrEqual(8);
    expect(evidenceRes.body.evidence[0]).toHaveProperty('skillSlug');
    expect(evidenceRes.body.evidence[0]).toHaveProperty('validityStatus');
    expect(evidenceRes.body.evidence[0]).toHaveProperty('recencyWeight');

    // Test API endpoint: GET /api/repositories/:id/flags (should have 0 blocking flags)
    const flagsRes = await request(app)
      .get(`/api/repositories/${repo._id}/flags`)
      .set('Cookie', [userACookie]);

    expect(flagsRes.status).toBe(200);
    expect(flagsRes.body.flags).toHaveLength(0);
  });

  it('R4: Flags UNMODIFIED_FORK and marks evidence records as EXCLUDED when fork has low authorship', async () => {
    // Create fork repository owned by test-dev where commits belong to someone else
    nock(config.skillproof.github.apiBaseUrl)
      .get(`/repos/test-dev/forked-repo/commits/${commitSha1}`)
      .reply(200, {
        sha: commitSha1,
        author: { login: 'upstream-original-author' },
      });

    nock(config.skillproof.github.apiBaseUrl)
      .get(`/repos/test-dev/forked-repo/commits/${commitSha2}`)
      .reply(200, {
        sha: commitSha2,
        author: { login: 'upstream-original-author' },
      });

    const forkRepo = await Repository.create({
      userId: userAId,
      githubRepoId: 998878,
      name: 'forked-repo',
      fullName: 'test-dev/forked-repo',
      ownerLogin: 'test-dev',
      htmlUrl: 'https://github.com/test-dev/forked-repo',
      cloneUrl: fixtureGitDir,
      defaultBranch: 'main',
      isPrivate: false,
      isFork: true, // Mark as fork!
      selectedForAnalysis: true,
      lastAnalyzedAt: null,
    });

    const analyzeRes = await request(app)
      .post(`/api/repositories/${forkRepo._id}/analyze`)
      .set('Cookie', [userACookie])
      .set('X-SkillProof-Request', 'true');

    expect(analyzeRes.status).toBe(202);
    const jobId = analyzeRes.body.jobId;

    let attempts = 0;
    while (attempts < 30) {
      await new Promise((r) => setTimeout(r, 400));
      const pollRes = await request(app)
        .get(`/api/analysis/${jobId}`)
        .set('Cookie', [userACookie]);

      if (pollRes.body.status === 'SUCCEEDED' || pollRes.body.status === 'FAILED') {
        break;
      }
      attempts++;
    }

    // Verify blocking flag in DB
    const flagDocs = await AntiGamingFlag.find({ repositoryId: forkRepo._id });
    expect(flagDocs.length).toBeGreaterThanOrEqual(1);
    const forkFlag = flagDocs.find((f) => f.flagType === 'UNMODIFIED_FORK');
    expect(forkFlag).toBeDefined();
    expect(forkFlag?.severity).toBe('BLOCKING');

    // Verify that evidence records are marked EXCLUDED due to BLOCKING flag
    const forkEvidence = await EvidenceRecord.find({ repositoryId: forkRepo._id });
    for (const rec of forkEvidence) {
      expect(rec.validityStatus).toBe('EXCLUDED');
    }

    // Check GET /api/repositories/:id/flags returns the blocking flag
    const flagsRes = await request(app)
      .get(`/api/repositories/${forkRepo._id}/flags`)
      .set('Cookie', [userACookie]);

    expect(flagsRes.status).toBe(200);
    expect(flagsRes.body.flags.some((f: any) => f.flagType === 'UNMODIFIED_FORK')).toBe(true);
  });

  it('R14: Flags LARGE_INITIAL_COMMIT with WARNING when root commit contributes >= 80% lines', async () => {
    nock(config.skillproof.github.apiBaseUrl)
      .get(`/repos/test-dev/single-commit-repo/commits/${singleCommitSha}`)
      .reply(200, {
        sha: singleCommitSha,
        author: { login: 'test-dev' },
      });

    const singleRepo = await Repository.create({
      userId: userAId,
      githubRepoId: 998879,
      name: 'single-commit-repo',
      fullName: 'test-dev/single-commit-repo',
      ownerLogin: 'test-dev',
      htmlUrl: 'https://github.com/test-dev/single-commit-repo',
      cloneUrl: singleCommitGitDir,
      defaultBranch: 'main',
      isPrivate: false,
      isFork: false,
      selectedForAnalysis: true,
      lastAnalyzedAt: null,
    });

    const analyzeRes = await request(app)
      .post(`/api/repositories/${singleRepo._id}/analyze`)
      .set('Cookie', [userACookie])
      .set('X-SkillProof-Request', 'true');

    expect(analyzeRes.status).toBe(202);
    const jobId = analyzeRes.body.jobId;

    let attempts = 0;
    while (attempts < 30) {
      await new Promise((r) => setTimeout(r, 400));
      const pollRes = await request(app)
        .get(`/api/analysis/${jobId}`)
        .set('Cookie', [userACookie]);

      if (pollRes.body.status === 'SUCCEEDED' || pollRes.body.status === 'FAILED') {
        break;
      }
      attempts++;
    }

    const flagsRes = await request(app)
      .get(`/api/repositories/${singleRepo._id}/flags`)
      .set('Cookie', [userACookie]);

    expect(flagsRes.status).toBe(200);
    const initialCommitFlag = flagsRes.body.flags.find((f: any) => f.flagType === 'LARGE_INITIAL_COMMIT');
    expect(initialCommitFlag).toBeDefined();
    expect(initialCommitFlag.severity).toBe('WARNING');
  });

  it('Enforces user isolation: User B cannot view User A repository evidence or flags', async () => {
    const userARepo = await Repository.findOne({ userId: userAId, fullName: 'test-dev/full-spring-app' });
    expect(userARepo).not.toBeNull();

    const evidenceRes = await request(app)
      .get(`/api/repositories/${userARepo!._id}/evidence`)
      .set('Cookie', [userBCookie]);

    expect(evidenceRes.status).toBe(404);

    const flagsRes = await request(app)
      .get(`/api/repositories/${userARepo!._id}/flags`)
      .set('Cookie', [userBCookie]);

    expect(flagsRes.status).toBe(404);
  });
});
