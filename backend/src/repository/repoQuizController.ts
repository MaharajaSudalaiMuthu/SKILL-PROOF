import { Router, Response } from 'express';
import {
  RepoQuizStartResponse,
  RepoQuizResultResponse,
  RepoQuizQuestionReview,
  RepoQuizQuestionClient,
} from '@skillproof/shared';
import { requireAuth, requireCsrf, AuthenticatedRequest } from '../middleware/auth.js';
import { Repository } from '../models/Repository.js';
import { AnalysisJob } from '../models/AnalysisJob.js';
import { EvidenceRecord } from '../models/EvidenceRecord.js';
import { FileAttribution } from '../models/FileAttribution.js';
import { RepositoryQuizAttempt } from '../models/RepositoryQuizAttempt.js';
import { generateQuizForRepository } from '../engine/repoQuizGenerator.js';
import { AppError } from '../middleware/errorHandler.js';

export const repoQuizRouter = Router();

// POST /api/repositories/:id/quiz/start - Start or resume a repository adaptive quiz
repoQuizRouter.post('/:id/quiz/start', requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const repoId = String(req.params.id);
  const userId = req.userId;

  const repository = await Repository.findOne({ _id: repoId, userId });
  if (!repository) {
    throw new AppError(404, 'NOT_FOUND', 'Repository not found or access denied.');
  }

  // Check that analysis has completed
  const completedJob = await AnalysisJob.findOne({
    repositoryId: repository._id,
    userId,
    status: 'SUCCEEDED',
  });

  if (!completedJob) {
    throw new AppError(
      400,
      'ANALYSIS_REQUIRED',
      'Please run repository analysis before starting the knowledge assessment.'
    );
  }

  // Check for existing IN_PROGRESS attempt (unless fresh retake is requested)
  const isFresh = req.query.fresh === 'true' || req.body?.fresh === true;
  let attempt = isFresh
    ? null
    : await RepositoryQuizAttempt.findOne({
        repositoryId: repository._id,
        userId,
        status: 'IN_PROGRESS',
      });

  if (!attempt) {
    const evidenceRecords = await EvidenceRecord.find({
      repositoryId: repository._id,
      userId,
      evidenceType: 'STATIC',
    });

    const attributions = await FileAttribution.find({
      repositoryId: repository._id,
      userId,
    });

    if (evidenceRecords.length === 0 && attributions.length === 0) {
      throw new AppError(
        400,
        'INSUFFICIENT_EVIDENCE',
        `The repository "${repository.fullName}" does not contain sufficient implementation source code (functions, API routes, database models, or tests) to generate an adaptive assessment. Please submit a repository containing application source files.`
      );
    }

    const questions = generateQuizForRepository(repository.fullName, evidenceRecords, attributions);

    if (questions.length === 0) {
      throw new AppError(
        400,
        'INSUFFICIENT_EVIDENCE',
        `No verified code findings could be extracted from "${repository.fullName}". Ensure the repository contains active route handlers, exported functions, database models, or test suites.`
      );
    }

    attempt = await RepositoryQuizAttempt.create({
      userId,
      repositoryId: repository._id,
      repositoryFullName: repository.fullName,
      status: 'IN_PROGRESS',
      questions,
      totalQuestions: questions.length,
      startedAt: new Date(),
    });
  }

  const clientQuestions: RepoQuizQuestionClient[] = attempt.questions.map((q) => ({
    id: q.id,
    category: q.category,
    skillSlug: q.skillSlug,
    title: q.title,
    question: q.question,
    fileReference: q.fileReference,
    codeSnippet: q.codeSnippet,
    options: q.options,
  }));

  const response: RepoQuizStartResponse = {
    attemptId: attempt._id.toString(),
    repositoryId: repository._id.toString(),
    repositoryFullName: repository.fullName,
    totalQuestions: clientQuestions.length,
    questions: clientQuestions,
  };

  res.status(200).json(response);
});

// POST /api/repositories/:id/quiz/:attemptId/submit - Submit answers and calculate score
repoQuizRouter.post('/:id/quiz/:attemptId/submit', requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const repoId = String(req.params.id);
  const attemptId = String(req.params.attemptId);
  const userId = req.userId;
  const { answers } = req.body;

  if (!Array.isArray(answers)) {
    throw new AppError(400, 'INVALID_PAYLOAD', 'Answers array is required.');
  }

  const attempt = await RepositoryQuizAttempt.findOne({
    _id: attemptId,
    repositoryId: repoId,
    userId,
  });

  if (!attempt) {
    throw new AppError(404, 'NOT_FOUND', 'Quiz attempt not found.');
  }

  const answerMap = new Map<string, number>();
  for (const a of answers) {
    if (a && typeof a.questionId === 'string' && typeof a.selectedOptionIndex === 'number') {
      answerMap.set(a.questionId, a.selectedOptionIndex);
    }
  }

  let correctCount = 0;
  const knowledgeGapsSet = new Set<string>();
  const assessedCapabilitiesSet = new Set<string>();

  const reviewedQuestions: RepoQuizQuestionReview[] = attempt.questions.map((q) => {
    assessedCapabilitiesSet.add(q.category);
    const selectedIndex = answerMap.has(q.id) ? answerMap.get(q.id)! : -1;
    const isCorrect = selectedIndex === q.correctOptionIndex;

    if (isCorrect) {
      correctCount++;
    } else {
      knowledgeGapsSet.add(q.category);
    }

    return {
      id: q.id,
      category: q.category,
      skillSlug: q.skillSlug,
      title: q.title,
      question: q.question,
      fileReference: q.fileReference,
      codeSnippet: q.codeSnippet,
      options: q.options,
      selectedOptionIndex: selectedIndex,
      correctOptionIndex: q.correctOptionIndex,
      isCorrect,
      explanation: q.explanation,
    };
  });

  const totalQuestions = attempt.questions.length;
  const scorePercent = totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;
  const passed = scorePercent >= 70;

  attempt.status = 'COMPLETED';
  attempt.answers = Array.from(answerMap.entries()).map(([questionId, selectedOptionIndex]) => ({
    questionId,
    selectedOptionIndex,
  }));
  attempt.score = scorePercent;
  attempt.percentage = scorePercent;
  attempt.correctCount = correctCount;
  attempt.passed = passed;
  attempt.knowledgeGaps = Array.from(knowledgeGapsSet);
  attempt.assessedCapabilities = Array.from(assessedCapabilitiesSet);
  attempt.completedAt = new Date();
  await attempt.save();

  const response: RepoQuizResultResponse = {
    attemptId: attempt._id.toString(),
    repositoryId: repoId,
    repositoryFullName: attempt.repositoryFullName,
    score: scorePercent,
    percentage: scorePercent,
    totalQuestions,
    correctCount,
    incorrectCount: totalQuestions - correctCount,
    passed,
    completedAt: attempt.completedAt.toISOString(),
    knowledgeGaps: attempt.knowledgeGaps,
    assessedCapabilities: attempt.assessedCapabilities,
    questions: reviewedQuestions,
  };

  res.status(200).json(response);
});

// GET /api/repositories/:id/quiz/latest - Get latest completed quiz result
repoQuizRouter.get('/:id/quiz/latest', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const repoId = String(req.params.id);
  const userId = req.userId;

  const attempt = await RepositoryQuizAttempt.findOne({
    repositoryId: repoId,
    userId,
    status: 'COMPLETED',
  }).sort({ completedAt: -1 });

  if (!attempt) {
    res.status(200).json({ result: null });
    return;
  }

  const answerMap = new Map(attempt.answers.map((a) => [a.questionId, a.selectedOptionIndex]));

  const reviewedQuestions: RepoQuizQuestionReview[] = attempt.questions.map((q) => {
    const selectedIndex = answerMap.has(q.id) ? answerMap.get(q.id)! : -1;
    return {
      id: q.id,
      category: q.category,
      skillSlug: q.skillSlug,
      title: q.title,
      question: q.question,
      fileReference: q.fileReference,
      codeSnippet: q.codeSnippet,
      options: q.options,
      selectedOptionIndex: selectedIndex,
      correctOptionIndex: q.correctOptionIndex,
      isCorrect: selectedIndex === q.correctOptionIndex,
      explanation: q.explanation,
    };
  });

  const response: RepoQuizResultResponse = {
    attemptId: attempt._id.toString(),
    repositoryId: repoId,
    repositoryFullName: attempt.repositoryFullName,
    score: attempt.score,
    percentage: attempt.percentage,
    totalQuestions: attempt.totalQuestions,
    correctCount: attempt.correctCount,
    incorrectCount: attempt.totalQuestions - attempt.correctCount,
    passed: attempt.passed,
    completedAt: attempt.completedAt ? attempt.completedAt.toISOString() : attempt.createdAt.toISOString(),
    knowledgeGaps: attempt.knowledgeGaps,
    assessedCapabilities: attempt.assessedCapabilities,
    questions: reviewedQuestions,
  };

  res.status(200).json({ result: response });
});
