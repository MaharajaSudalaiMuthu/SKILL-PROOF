import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { scanProjectWorkspace } from "../../src/ingestion/projectScanner.js";
import { inspectWorkspaceCode } from "../../src/engine/codeInspector.js";
import { generateQuizForRepository } from "../../src/engine/repoQuizGenerator.js";
import { IEvidenceRecord } from "../../src/models/EvidenceRecord.js";
import { IFileAttribution } from "../../src/models/FileAttribution.js";

describe("Permanent Universal Repository Analysis & Quiz Verification (8 Project Types)", () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), "skillproof-8proj-"));
  });

  afterEach(async () => {
    await fs.promises.rm(tempDir, { recursive: true, force: true });
  });

  function toEvidenceAndAttributions(inspection: any, scan: any, dir: string) {
    const evidenceRecords: IEvidenceRecord[] = inspection.findings.map((f: any) => ({
      userId: "user-test" as any,
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

    const attributions: IFileAttribution[] = scan.sourceFiles.map((sf: string) => ({
      repositoryId: "repo-123" as any,
      userId: "user-test" as any,
      analysisJobId: "job-123" as any,
      filePath: sf,
      totalLines: 40,
      confirmedLines: 40,
      uncertainLines: 0,
      otherLines: 0,
      ranges: [{ startLine: 1, endLine: 40, commitSha: "c1", commitDate: new Date(), authorLogin: "dev", status: "CONFIRMED" }],
    })) as unknown as IFileAttribution[];

    return { evidenceRecords, attributions };
  }

  function verifyQuestionQuality(questions: any[], minCount: number = 10) {
    expect(questions.length).toBeGreaterThanOrEqual(minCount);
    expect(questions.length).toBeLessThanOrEqual(20);

    for (const q of questions) {
      expect(q.options.length).toBe(4);
      // All 4 options in every question must be unique
      const uniqueOptions = new Set(q.options);
      expect(uniqueOptions.size).toBe(4);

      // Correct option index must be in [0, 3]
      expect(q.correctOptionIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctOptionIndex).toBeLessThan(4);

      // File reference must have line range
      expect(q.fileReference).toMatch(/:L\d+-L\d+/);
      expect(q.explanation.length).toBeGreaterThan(10);
    }
  }

  // PROJECT TYPE 1: Python Hangman Game
  it("1. Successfully analyzes Python Hangman game and generates 10+ adaptive questions", async () => {
    const projDir = path.join(tempDir, "hangman");
    await fs.promises.mkdir(projDir, { recursive: true });

    await fs.promises.writeFile(
      path.join(projDir, "main.py"),
      `from game import HangmanGame
from scoreboard import Scoreboard

def main():
    print("Welcome to Python Hangman!")
    game = HangmanGame()
    board = Scoreboard()
    while not game.is_over():
        game.play_round()
    board.save_score(game.player, game.attempts)
`
    );

    await fs.promises.writeFile(
      path.join(projDir, "game.py"),
      `import json
from words import WordBank

class HangmanGame:
    def __init__(self):
        self.word_bank = WordBank()
        self.attempts = 6
        self.guesses = []

    def choose_difficulty(self):
        level = input("Select difficulty (easy, medium, hard): ")
        return level

    def is_over(self):
        return self.attempts <= 0

    def play_round(self):
        guess = input("Enter your letter guess: ")
        self.guesses.append(guess)
`
    );

    await fs.promises.writeFile(
      path.join(projDir, "scoreboard.py"),
      `import os
import json

class Scoreboard:
    def __init__(self):
        self.scores = {}

    def save_score(self, player, score):
        try:
            with open("scores.json", "w") as f:
                json.dump({player: score}, f)
        except Exception as e:
            print(f"Error saving scoreboard: {e}")
`
    );

    const scan = await scanProjectWorkspace(projDir);
    expect(scan.primaryLanguage).toBe("Python");
    const inspection = await inspectWorkspaceCode(projDir, scan);
    expect(inspection.findings.length).toBeGreaterThanOrEqual(8);

    const { evidenceRecords, attributions } = toEvidenceAndAttributions(inspection, scan, projDir);
    const questions = generateQuizForRepository("student/python-hangman", evidenceRecords, attributions);
    verifyQuestionQuality(questions, 10);
  });

  // PROJECT TYPE 2: Python AI/ML Prediction Project
  it("2. Successfully analyzes Python AI/ML prediction project with scikit-learn/pandas", async () => {
    const projDir = path.join(tempDir, "ai-prediction");
    await fs.promises.mkdir(projDir, { recursive: true });

    await fs.promises.writeFile(
      path.join(projDir, "requirements.txt"),
      `scikit-learn==1.4.2
pandas==2.2.1
numpy==1.26.4
joblib==1.4.0
`
    );

    await fs.promises.writeFile(
      path.join(projDir, "train.py"),
      `import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier

def train_prediction_model():
    df = pd.read_csv("housing_data.csv")
    X = df.drop(columns=["target"])
    y = df["target"]
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2)
    clf = RandomForestClassifier(n_estimators=100)
    clf.fit(X_train, y_train)
    predictions = clf.predict(X_test)
    return clf, predictions
`
    );

    const scan = await scanProjectWorkspace(projDir);
    expect(scan.primaryLanguage).toBe("Python");
    expect(scan.frameworks).toContain("scikit-learn");
    expect(scan.frameworks).toContain("Pandas");
    expect(scan.frameworks).toContain("NumPy");

    const inspection = await inspectWorkspaceCode(projDir, scan);
    const mlFinding = inspection.findings.find((f) => f.category === "AI_ML_MODEL");
    expect(mlFinding).toBeDefined();

    const { evidenceRecords, attributions } = toEvidenceAndAttributions(inspection, scan, projDir);
    const questions = generateQuizForRepository("student/housing-ai-model", evidenceRecords, attributions);
    verifyQuestionQuality(questions, 5); // Guarantee generates questions
  });

  // PROJECT TYPE 3: React Frontend Application
  it("3. Successfully analyzes React frontend application with hooks and JSX", async () => {
    const projDir = path.join(tempDir, "react-app");
    const srcDir = path.join(projDir, "src");
    await fs.promises.mkdir(srcDir, { recursive: true });

    await fs.promises.writeFile(
      path.join(projDir, "package.json"),
      JSON.stringify({
        name: "student-portal-ui",
        dependencies: { react: "^18.3.0", "react-dom": "^18.3.0" },
      })
    );

    await fs.promises.writeFile(
      path.join(srcDir, "App.tsx"),
      `import React, { useState, useEffect } from "react";

export function App() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    fetch("/api/tasks").then(r => r.json()).then(setTasks);
  }, []);

  return (
    <div className="container">
      <h1>Task Dashboard</h1>
    </div>
  );
}
`
    );

    const scan = await scanProjectWorkspace(projDir);
    expect(scan.primaryLanguage).toBe("TypeScript");
    expect(scan.frameworks).toContain("React");

    const inspection = await inspectWorkspaceCode(projDir, scan);
    expect(inspection.findings.some((f) => f.category === "REACT_COMPONENT")).toBe(true);

    const { evidenceRecords, attributions } = toEvidenceAndAttributions(inspection, scan, projDir);
    const questions = generateQuizForRepository("student/portal-ui", evidenceRecords, attributions);
    verifyQuestionQuality(questions, 4);
  });

  // PROJECT TYPE 4: Node.js REST API
  it("4. Successfully analyzes Node.js REST API with Express", async () => {
    const projDir = path.join(tempDir, "node-api");
    const srcDir = path.join(projDir, "src");
    await fs.promises.mkdir(srcDir, { recursive: true });

    await fs.promises.writeFile(
      path.join(projDir, "package.json"),
      JSON.stringify({
        name: "product-api",
        dependencies: { express: "^4.19.2", mongoose: "^8.3.0" },
      })
    );

    await fs.promises.writeFile(
      path.join(srcDir, "routes.js"),
      `const express = require("express");
const router = express.Router();

router.get("/api/products", async (req, res) => {
  res.json({ products: [] });
});

router.post("/api/products", async (req, res) => {
  res.status(201).json({ created: true });
});

module.exports = router;
`
    );

    const scan = await scanProjectWorkspace(projDir);
    expect(scan.frameworks).toContain("Express");
    const inspection = await inspectWorkspaceCode(projDir, scan);
    expect(inspection.findings.some((f) => f.category === "API_ROUTE")).toBe(true);

    const { evidenceRecords, attributions } = toEvidenceAndAttributions(inspection, scan, projDir);
    const questions = generateQuizForRepository("student/product-api", evidenceRecords, attributions);
    verifyQuestionQuality(questions, 3);
  });

  // PROJECT TYPE 5: Java Spring Boot Project
  it("5. Successfully analyzes Java Spring Boot project with controllers & entities", async () => {
    const projDir = path.join(tempDir, "spring-app");
    const srcDir = path.join(projDir, "src", "main", "java", "com", "example");
    await fs.promises.mkdir(srcDir, { recursive: true });

    await fs.promises.writeFile(
      path.join(projDir, "pom.xml"),
      `<project><modelVersion>4.0.0</modelVersion><groupId>com.example</groupId><artifactId>demo</artifactId><version>1.0.0</version></project>`
    );

    await fs.promises.writeFile(
      path.join(srcDir, "BookController.java"),
      `package com.example;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/books")
public class BookController {
    @GetMapping("/{id}")
    public String getBook(@PathVariable Long id) {
        return "Book Details";
    }
}
`
    );

    const scan = await scanProjectWorkspace(projDir);
    expect(scan.primaryLanguage).toBe("Java");
    const inspection = await inspectWorkspaceCode(projDir, scan);
    expect(inspection.findings.some((f) => f.category === "API_ROUTE")).toBe(true);

    const { evidenceRecords, attributions } = toEvidenceAndAttributions(inspection, scan, projDir);
    const questions = generateQuizForRepository("student/spring-books", evidenceRecords, attributions);
    verifyQuestionQuality(questions, 2);
  });

  // PROJECT TYPE 6: C / C++ Project
  it("6. Successfully analyzes C/C++ project with structs, pointers, and memory allocation", async () => {
    const projDir = path.join(tempDir, "c-project");
    await fs.promises.mkdir(projDir, { recursive: true });

    await fs.promises.writeFile(
      path.join(projDir, "main.c"),
      `#include <stdio.h>
#include <stdlib.h>

struct Player {
    char name[32];
    int score;
};

int main(int argc, char* argv[]) {
    printf("Starting C Engine\\n");
    struct Player* p = (struct Player*)malloc(sizeof(struct Player));
    p->score = 100;
    free(p);
    return 0;
}
`
    );

    const scan = await scanProjectWorkspace(projDir);
    expect(scan.primaryLanguage).toBe("C");
    const inspection = await inspectWorkspaceCode(projDir, scan);
    expect(inspection.findings.length).toBeGreaterThanOrEqual(3);

    const { evidenceRecords, attributions } = toEvidenceAndAttributions(inspection, scan, projDir);
    const questions = generateQuizForRepository("student/c-game-engine", evidenceRecords, attributions);
    verifyQuestionQuality(questions, 3);
  });

  // PROJECT TYPE 7: Flask / Python Web Application
  it("7. Successfully analyzes Flask web application with endpoints and json", async () => {
    const projDir = path.join(tempDir, "flask-app");
    await fs.promises.mkdir(projDir, { recursive: true });

    await fs.promises.writeFile(
      path.join(projDir, "requirements.txt"),
      `flask==3.0.3\n`
    );

    await fs.promises.writeFile(
      path.join(projDir, "app.py"),
      `from flask import Flask, jsonify, request
app = Flask(__name__)

@app.route("/api/v1/predict", methods=["POST"])
def predict():
    data = request.get_json()
    return jsonify({"prediction": 1})
`
    );

    const scan = await scanProjectWorkspace(projDir);
    expect(scan.frameworks).toContain("Flask");
    const inspection = await inspectWorkspaceCode(projDir, scan);
    expect(inspection.findings.some((f) => f.category === "API_ROUTE")).toBe(true);

    const { evidenceRecords, attributions } = toEvidenceAndAttributions(inspection, scan, projDir);
    const questions = generateQuizForRepository("student/flask-service", evidenceRecords, attributions);
    verifyQuestionQuality(questions, 2);
  });

  // PROJECT TYPE 8: HTML / CSS / Vanilla JavaScript Project
  it("8. Successfully analyzes HTML/CSS/JavaScript project with forms, layout, and events", async () => {
    const projDir = path.join(tempDir, "vanilla-web");
    await fs.promises.mkdir(projDir, { recursive: true });

    await fs.promises.writeFile(
      path.join(projDir, "index.html"),
      `<!DOCTYPE html>
<html>
<head><link rel="stylesheet" href="style.css"></head>
<body>
  <form id="calc-form">
    <input type="text" id="num" />
    <button type="submit">Calculate</button>
  </form>
  <script src="script.js"></script>
</body>
</html>
`
    );

    await fs.promises.writeFile(
      path.join(projDir, "style.css"),
      `.container {
  display: flex;
  justify-content: center;
}
`
    );

    await fs.promises.writeFile(
      path.join(projDir, "script.js"),
      `document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("calc-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    console.log("Calculated");
  });
});
`
    );

    const scan = await scanProjectWorkspace(projDir);
    expect(scan.sourceFiles.length).toBeGreaterThanOrEqual(2);
    const inspection = await inspectWorkspaceCode(projDir, scan);
    expect(inspection.findings.some((f) => f.category === "FRONTEND_UI")).toBe(true);

    const { evidenceRecords, attributions } = toEvidenceAndAttributions(inspection, scan, projDir);
    const questions = generateQuizForRepository("student/frontend-portfolio", evidenceRecords, attributions);
    verifyQuestionQuality(questions, 2);
  });
});
