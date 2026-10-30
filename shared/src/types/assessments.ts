import { SkillSlug } from './skills.js';
import { SkillLevel } from './levels.js';

export interface AssessmentQuestionClientView {
  questionId: string;
  skillSlug: SkillSlug;
  title: string;
  scenario: string;
  codeSnippet?: string;
  options: string[];
  difficulty: string;
}

export interface AssessmentAttemptStartResponse {
  attemptId: string;
  skillSlug: SkillSlug;
  questions: AssessmentQuestionClientView[];
  startedAt: string;
  expiresAt: string;
  timeLimitMinutes: number;
}

export interface AssessmentAnswerSubmission {
  questionId: string;
  selectedOptionIndex: number;
}

export interface AssessmentSubmitRequest {
  answers: AssessmentAnswerSubmission[];
}

export interface AssessmentQuestionResult {
  questionId: string;
  title: string;
  scenario: string;
  codeSnippet?: string;
  options: string[];
  selectedOptionIndex: number;
  correctOptionIndex: number;
  isCorrect: boolean;
  rubricExplanation: string;
}

export interface AssessmentResultResponse {
  attemptId: string;
  skillSlug: SkillSlug;
  score: number;
  passed: boolean;
  totalQuestions: number;
  correctCount: number;
  completedAt: string;
  questions: AssessmentQuestionResult[];
  newLevel?: SkillLevel;
}

export interface AssessmentAttemptSummary {
  id: string;
  skillSlug: SkillSlug;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';
  score: number | null;
  passed: boolean;
  startedAt: string;
  completedAt: string | null;
}
