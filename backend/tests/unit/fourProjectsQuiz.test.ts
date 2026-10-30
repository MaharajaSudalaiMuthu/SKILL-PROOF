import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { scanProjectWorkspace } from "../../src/ingestion/projectScanner.js";
import { inspectWorkspaceCode } from "../../src/engine/codeInspector.js";
import { generateQuizForRepository } from "../../src/engine/repoQuizGenerator.js";
import { IEvidenceRecord } from "../../src/models/EvidenceRecord.js";

describe("Four Project Types Repository Adaptive Quiz Verification", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "skillproof-4proj-"));
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  it("1. Successfully scans, inspects, and generates adaptive quiz for M-KESAVAN003/python-hangman-game", async () => {
    const hangmanSrc = "/tmp/test-hangman";
    let targetDir = hangmanSrc;

    if (!fs.existsSync(hangmanSrc)) {
      targetDir = path.join(tempDir, "hangman");
      await fs.promises.mkdir(targetDir, { recursive: true });
      await fs.promises.writeFile(
        path.join(targetDir, "main.py"),
        `from game import HangmanGame
from scoreboard import Scoreboard

def main():
    print("Welcome to Hangman!")
    board = Scoreboard()
    game = HangmanGame()
    while not game.is_over():
        game.play_round()
`
      );
      await fs.promises.writeFile(
        path.join(targetDir, "game.py"),
        `import json
from words import WordBank

class HangmanGame:
    def __init__(self):
        self.word_bank = WordBank()
        self.attempts_remaining = 6
        self.guessed_letters = []

    def choose_difficulty(self):
        level = input("Choose difficulty (easy, medium, hard): ")
        return level

    def is_won(self):
        return self.attempts_remaining > 0

    def play_round(self):
        guess = input("Guess a letter: ")
        self.guessed_letters.append(guess)
`
      );
    }

    const scan = await scanProjectWorkspace(targetDir);
    expect(scan.primaryLanguage).toBe("Python");
    expect(scan.sourceFiles.length).toBeGreaterThanOrEqual(1);

    const inspection = await inspectWorkspaceCode(targetDir, scan);
    expect(inspection.findings.length).toBeGreaterThanOrEqual(10);

    const evidenceRecords: IEvidenceRecord[] = inspection.findings.map((f) => ({
      userId: "user-hangman" as any,
      skillSlug: "transaction-management" as any,
      evidenceType: "STATIC" as any,
      validityStatus: "VALID" as any,
      attributionStatus: "CONFIRMED" as any,
      filePath: f.filePath,
      startLine: f.startLine,
      endLine: f.endLine,
      matchedPattern: f.codeSnippet,
      dedupeKey: `dedupe-${f.id}`,
      recencyWeight: 1.0,
      createdAt: new Date(),
      rawDetails: {
        category: f.category,
        primaryIdentifier: f.primaryIdentifier,
        secondaryInfo: f.secondaryInfo,
        correctAnswer: f.correctAnswer,
        distractors: f.distractors,
        explanation: f.explanation,
        title: f.title,
        codeSnippet: f.codeSnippet,
      },
    })) as unknown as IEvidenceRecord[];

    const questions = generateQuizForRepository("M-KESAVAN003/python-hangman-game", evidenceRecords, []);
    expect(questions.length).toBeGreaterThanOrEqual(10);
    expect(questions.length).toBeLessThanOrEqual(20);

    for (const q of questions) {
      expect(q.options.length).toBe(4);
      expect(q.correctOptionIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctOptionIndex).toBeLessThan(4);
      expect(q.fileReference).toMatch(/\.py:L\d+-L\d+/);
      expect(q.explanation.length).toBeGreaterThan(10);
    }
  });

  it("2. Successfully scans, inspects, and generates adaptive quiz for Spring Boot project", async () => {
    const springDir = path.join(tempDir, "spring-petclinic");
    const srcDir = path.join(springDir, "src", "main", "java", "org", "example", "petclinic");
    await fs.promises.mkdir(srcDir, { recursive: true });

    await fs.promises.writeFile(
      path.join(springDir, "pom.xml"),
      `<project><modelVersion>4.0.0</modelVersion><groupId>org.example</groupId><artifactId>petclinic</artifactId><version>1.0.0</version></project>`
    );

    await fs.promises.writeFile(
      path.join(srcDir, "PetController.java"),
      `package org.example.petclinic;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/pets")
public class PetController {
    @GetMapping("/{id}")
    public Pet getPet(@PathVariable Long id) {
        return null;
    }

    @PostMapping
    public Pet createPet(@RequestBody Pet pet) {
        return pet;
    }
}
`
    );

    await fs.promises.writeFile(
      path.join(srcDir, "Pet.java"),
      `package org.example.petclinic;
import jakarta.persistence.*;

@Entity
@Table(name = "pets")
public class Pet {
    @Id
    @GeneratedValue
    private Long id;
    private String name;

    public Long getId() { return id; }
    public String getName() { return name; }
}
`
    );

    const scan = await scanProjectWorkspace(springDir);
    expect(scan.primaryLanguage).toBe("Java");
    expect(scan.sourceFiles.length).toBeGreaterThanOrEqual(2);

    const inspection = await inspectWorkspaceCode(springDir, scan);
    expect(inspection.findings.length).toBeGreaterThanOrEqual(4);

    const evidenceRecords: IEvidenceRecord[] = inspection.findings.map((f) => ({
      userId: "user-spring" as any,
      skillSlug: "rest-controller-design" as any,
      evidenceType: "STATIC" as any,
      validityStatus: "VALID" as any,
      attributionStatus: "CONFIRMED" as any,
      filePath: f.filePath,
      startLine: f.startLine,
      endLine: f.endLine,
      matchedPattern: f.codeSnippet,
      dedupeKey: `dedupe-${f.id}`,
      recencyWeight: 1.0,
      createdAt: new Date(),
      rawDetails: {
        category: f.category,
        primaryIdentifier: f.primaryIdentifier,
        secondaryInfo: f.secondaryInfo,
        correctAnswer: f.correctAnswer,
        distractors: f.distractors,
        explanation: f.explanation,
        title: f.title,
        codeSnippet: f.codeSnippet,
      },
    })) as unknown as IEvidenceRecord[];

    const questions = generateQuizForRepository("spring-projects/spring-petclinic", evidenceRecords, []);
    expect(questions.length).toBeGreaterThanOrEqual(4);

    for (const q of questions) {
      expect(q.options.length).toBe(4);
      expect(q.fileReference).toMatch(/\.java:L\d+-L\d+/);
    }
  });

  it("3. Successfully scans, inspects, and generates adaptive quiz for React project", async () => {
    const reactDir = path.join(tempDir, "react-dashboard");
    const srcDir = path.join(reactDir, "src");
    await fs.promises.mkdir(srcDir, { recursive: true });

    await fs.promises.writeFile(
      path.join(reactDir, "package.json"),
      JSON.stringify({
        name: "react-dashboard",
        dependencies: { react: "^18.2.0", "react-dom": "^18.2.0" },
      })
    );

    await fs.promises.writeFile(
      path.join(srcDir, "App.tsx"),
      `import React, { useState, useEffect } from "react";
import { UserProfile } from "./UserProfile";

export function App() {
  const [userCount, setUserCount] = useState(0);
  const [searchTerm, setSearchTerm] = useState("");

  const handleSearch = (term: string) => {
    setSearchTerm(term);
  };

  return <div><h1>Dashboard</h1></div>;
}
`
    );

    await fs.promises.writeFile(
      path.join(srcDir, "UserProfile.tsx"),
      `import React, { useState } from "react";

export function UserProfile() {
  const [activeTab, setActiveTab] = useState("overview");
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  return <div>Profile</div>;
}
`
    );

    const scan = await scanProjectWorkspace(reactDir);
    expect(scan.primaryLanguage).toBe("TypeScript");
    expect(scan.frameworks).toContain("React");

    const inspection = await inspectWorkspaceCode(reactDir, scan);
    expect(inspection.findings.length).toBeGreaterThanOrEqual(4);

    const reactFinding = inspection.findings.find((f) => f.category === "REACT_COMPONENT");
    expect(reactFinding).toBeDefined();

    const evidenceRecords: IEvidenceRecord[] = inspection.findings.map((f) => ({
      userId: "user-react" as any,
      skillSlug: "rest-controller-design" as any,
      evidenceType: "STATIC" as any,
      validityStatus: "VALID" as any,
      attributionStatus: "CONFIRMED" as any,
      filePath: f.filePath,
      startLine: f.startLine,
      endLine: f.endLine,
      matchedPattern: f.codeSnippet,
      dedupeKey: `dedupe-${f.id}`,
      recencyWeight: 1.0,
      createdAt: new Date(),
      rawDetails: {
        category: f.category,
        primaryIdentifier: f.primaryIdentifier,
        secondaryInfo: f.secondaryInfo,
        correctAnswer: f.correctAnswer,
        distractors: f.distractors,
        explanation: f.explanation,
        title: f.title,
        codeSnippet: f.codeSnippet,
      },
    })) as unknown as IEvidenceRecord[];

    const questions = generateQuizForRepository("student/react-dashboard", evidenceRecords, []);
    expect(questions.length).toBeGreaterThanOrEqual(4);

    for (const q of questions) {
      expect(q.options.length).toBe(4);
      expect(q.fileReference).toMatch(/\.tsx:L\d+-L\d+/);
    }
  });

  it("4. Successfully scans, inspects, and generates adaptive quiz for Node.js backend project", async () => {
    const nodeDir = path.join(tempDir, "node-express-auth");
    const srcDir = path.join(nodeDir, "src");
    await fs.promises.mkdir(srcDir, { recursive: true });

    await fs.promises.writeFile(
      path.join(nodeDir, "package.json"),
      JSON.stringify({
        name: "node-express-auth",
        dependencies: { express: "^4.19.2", jsonwebtoken: "^9.0.2" },
      })
    );

    await fs.promises.writeFile(
      path.join(srcDir, "auth.js"),
      `const express = require("express");
const router = express.Router();

router.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  res.json({ token: "jwt-token-123" });
});

router.post("/api/auth/register", (req, res) => {
  res.status(201).json({ success: true });
});

module.exports = router;
`
    );

    const scan = await scanProjectWorkspace(nodeDir);
    expect(scan.primaryLanguage).toBe("JavaScript");
    expect(scan.frameworks).toContain("Express");

    const inspection = await inspectWorkspaceCode(nodeDir, scan);
    expect(inspection.findings.length).toBeGreaterThanOrEqual(3);

    const evidenceRecords: IEvidenceRecord[] = inspection.findings.map((f) => ({
      userId: "user-node" as any,
      skillSlug: "rest-controller-design" as any,
      evidenceType: "STATIC" as any,
      validityStatus: "VALID" as any,
      attributionStatus: "CONFIRMED" as any,
      filePath: f.filePath,
      startLine: f.startLine,
      endLine: f.endLine,
      matchedPattern: f.codeSnippet,
      dedupeKey: `dedupe-${f.id}`,
      recencyWeight: 1.0,
      createdAt: new Date(),
      rawDetails: {
        category: f.category,
        primaryIdentifier: f.primaryIdentifier,
        secondaryInfo: f.secondaryInfo,
        correctAnswer: f.correctAnswer,
        distractors: f.distractors,
        explanation: f.explanation,
        title: f.title,
        codeSnippet: f.codeSnippet,
      },
    })) as unknown as IEvidenceRecord[];

    const questions = generateQuizForRepository("student/node-express-auth", evidenceRecords, []);
    expect(questions.length).toBeGreaterThanOrEqual(3);

    for (const q of questions) {
      expect(q.options.length).toBe(4);
      expect(q.fileReference).toMatch(/\.js:L\d+-L\d+/);
    }
  });
});
