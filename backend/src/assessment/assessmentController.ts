import { Router, Response } from 'express';
import {
  SkillSlug,
  SKILL_SLUGS,
  SubmitAssessmentSchema,
  AssessmentAttemptStartResponse,
  AssessmentQuestionClientView,
  AssessmentQuestionResult,
  AssessmentResultResponse,
  AssessmentAttemptSummary,
} from '@skillproof/shared';
import { requireAuth, requireCsrf, AuthenticatedRequest } from '../middleware/auth.js';
import { AssessmentQuestion } from '../models/AssessmentQuestion.js';
import { AssessmentAttempt } from '../models/AssessmentAttempt.js';
import { SkillLevelSnapshot } from '../models/SkillLevelSnapshot.js';
import { recomputeUserSnapshots } from '../engine/snapshotService.js';
import { AppError } from '../middleware/errorHandler.js';

export const assessmentRouter = Router();

const ASSESSMENT_TIME_LIMIT_MINUTES = 15;
const QUESTIONS_PER_ATTEMPT = 3;
const PASSING_SCORE_PERCENT = 66;

// POST /api/assessments/:skillSlug/start - Initiate or resume a 3-question timed assessment
assessmentRouter.post('/:skillSlug/start', requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const { skillSlug } = req.params;
  const userId = req.user!._id;

  if (!skillSlug || !SKILL_SLUGS.includes(skillSlug as SkillSlug)) {
    throw new AppError(400, 'INVALID_SKILL_SLUG', `Invalid skill slug: '${skillSlug}'.`);
  }

  const slug = skillSlug as SkillSlug;

  // 1. Verify eligibility (User must be at OBSERVED level or higher)
  let snap = await SkillLevelSnapshot.findOne({ userId, skillSlug: slug });
  if (!snap) {
    await recomputeUserSnapshots(userId);
    snap = await SkillLevelSnapshot.findOne({ userId, skillSlug: slug });
  }

  const eligibleLevels = ['OBSERVED', 'SUPPORTED', 'VERIFIED'];
  if (!snap || !eligibleLevels.includes(snap.currentLevel)) {
    throw new AppError(
      403,
      'INELIGIBLE_FOR_ASSESSMENT',
      `You must attain the 'Observed' level through repository evidence before attempting the scenario assessment.`
    );
  }

  // 2. Check for active unexpired in-progress attempt to resume
  const now = new Date();
  const existingAttempt = await AssessmentAttempt.findOne({
    userId,
    skillSlug: slug,
    status: 'IN_PROGRESS',
    expiresAt: { $gt: now },
  });

  let targetAttempt = existingAttempt;

  if (!targetAttempt) {
    // Expire any stale attempts
    await AssessmentAttempt.updateMany(
      { userId, skillSlug: slug, status: 'IN_PROGRESS', expiresAt: { $lte: now } },
      { $set: { status: 'EXPIRED' } }
    );

    // 3. Sample 3 questions randomly
    const allQuestions = await AssessmentQuestion.find({ skillSlug: slug });
    if (allQuestions.length < QUESTIONS_PER_ATTEMPT) {
      throw new AppError(
        500,
        'INSUFFICIENT_QUESTIONS',
        `Not enough questions configured for skill '${skillSlug}'. Expected at least ${QUESTIONS_PER_ATTEMPT}.`
      );
    }

    // Shuffle array deterministically/randomly
    const shuffled = [...allQuestions].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, QUESTIONS_PER_ATTEMPT);

    const expiresAt = new Date(now.getTime() + ASSESSMENT_TIME_LIMIT_MINUTES * 60 * 1000);

    targetAttempt = await AssessmentAttempt.create({
      userId,
      skillSlug: slug,
      status: 'IN_PROGRESS',
      questionIds: selected.map((q) => q.questionId),
      answers: [],
      score: 0,
      passed: false,
      startedAt: now,
      expiresAt,
    });
  }

  // 4. Retrieve question details and sanitize (exclude correct answers and rubric explanations)
  const questionDocs = await AssessmentQuestion.find({
    questionId: { $in: targetAttempt.questionIds },
  });

  const questionMap = new Map(questionDocs.map((q) => [q.questionId, q]));
  const clientQuestions: AssessmentQuestionClientView[] = targetAttempt.questionIds.map((qid) => {
    const q = questionMap.get(qid)!;
    return {
      questionId: q.questionId,
      skillSlug: q.skillSlug,
      title: q.title,
      scenario: q.scenario,
      codeSnippet: q.codeSnippet,
      options: q.options,
      difficulty: q.difficulty,
    };
  });

  const response: AssessmentAttemptStartResponse = {
    attemptId: targetAttempt._id.toString(),
    skillSlug: slug,
    questions: clientQuestions,
    startedAt: targetAttempt.startedAt.toISOString(),
    expiresAt: targetAttempt.expiresAt.toISOString(),
    timeLimitMinutes: ASSESSMENT_TIME_LIMIT_MINUTES,
  };

  res.status(201).json(response);
});

// POST /api/assessments/:attemptId/submit - Submit answers, evaluate score, and promote to Supported if passed
assessmentRouter.post('/:attemptId/submit', requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const { attemptId } = req.params;
  const userId = req.user!._id;

  const payload = SubmitAssessmentSchema.parse(req.body);

  const attempt = await AssessmentAttempt.findOne({ _id: attemptId, userId });
  if (!attempt) {
    throw new AppError(404, 'ATTEMPT_NOT_FOUND', `Assessment attempt '${attemptId}' not found.`);
  }

  if (attempt.status === 'COMPLETED') {
    throw new AppError(400, 'ATTEMPT_ALREADY_COMPLETED', 'This assessment attempt has already been submitted and scored.');
  }

  const now = new Date();
  if (now.getTime() > attempt.expiresAt.getTime()) {
    attempt.status = 'EXPIRED';
    await attempt.save();
    throw new AppError(400, 'ATTEMPT_EXPIRED', 'The 15-minute assessment time limit has expired.');
  }

  // Fetch full questions with correct answers and rubrics
  const questionDocs = await AssessmentQuestion.find({
    questionId: { $in: attempt.questionIds },
  });
  const questionMap = new Map(questionDocs.map((q) => [q.questionId, q]));

  const submissionMap = new Map(payload.answers.map((a) => [a.questionId, a.selectedOptionIndex]));

  let correctCount = 0;
  const questionResults: AssessmentQuestionResult[] = [];

  for (const qid of attempt.questionIds) {
    const q = questionMap.get(qid);
    if (!q) continue;

    const userSelected = submissionMap.get(qid) ?? -1;
    const isCorrect = userSelected === q.correctOptionIndex;

    if (isCorrect) {
      correctCount++;
    }

    questionResults.push({
      questionId: q.questionId,
      title: q.title,
      scenario: q.scenario,
      codeSnippet: q.codeSnippet,
      options: q.options,
      selectedOptionIndex: userSelected,
      correctOptionIndex: q.correctOptionIndex,
      isCorrect,
      rubricExplanation: q.rubricExplanation,
    });
  }

  const totalQuestions = attempt.questionIds.length;
  const score = Math.round((correctCount / totalQuestions) * 1000) / 10;
  const passed = score >= PASSING_SCORE_PERCENT;

  attempt.status = 'COMPLETED';
  attempt.answers = payload.answers;
  attempt.score = score;
  attempt.passed = passed;
  attempt.completedAt = now;
  await attempt.save();

  // Recompute user snapshots to trigger Supported promotion if passed
  const updatedSnapshots = await recomputeUserSnapshots(userId);
  const updatedSnap = updatedSnapshots.find((s) => s.skillSlug === attempt.skillSlug);

  const response: AssessmentResultResponse = {
    attemptId: attempt._id.toString(),
    skillSlug: attempt.skillSlug,
    score,
    passed,
    totalQuestions,
    correctCount,
    completedAt: now.toISOString(),
    questions: questionResults,
    newLevel: updatedSnap?.currentLevel,
  };

  res.status(200).json(response);
});

// GET /api/assessments/attempts - List all assessment attempts for the user
assessmentRouter.get('/attempts', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user!._id;

  const attempts = await AssessmentAttempt.find({ userId }).sort({ createdAt: -1 });

  const result: AssessmentAttemptSummary[] = attempts.map((a) => ({
    id: a._id.toString(),
    skillSlug: a.skillSlug,
    status: a.status,
    score: a.status === 'COMPLETED' ? a.score : null,
    passed: a.passed,
    startedAt: a.startedAt.toISOString(),
    completedAt: a.completedAt ? a.completedAt.toISOString() : null,
  }));

  res.status(200).json(result);
});
