import { SkillSlug } from './skills.js';

export interface RepoQuizQuestionClient {
  id: string;
  category: string;
  skillSlug: SkillSlug | string;
  title: string;
  question: string;
  fileReference: string;
  codeSnippet?: string;
  options: string[];
}

export interface RepoQuizStartResponse {
  attemptId: string;
  repositoryId: string;
  repositoryFullName: string;
  totalQuestions: number;
  questions: RepoQuizQuestionClient[];
}

export interface RepoQuizAnswerSubmission {
  questionId: string;
  selectedOptionIndex: number;
}

export interface RepoQuizSubmitRequest {
  answers: RepoQuizAnswerSubmission[];
}

export interface RepoQuizQuestionReview {
  id: string;
  category: string;
  skillSlug: SkillSlug | string;
  title: string;
  question: string;
  fileReference: string;
  codeSnippet?: string;
  options: string[];
  selectedOptionIndex: number;
  correctOptionIndex: number;
  isCorrect: boolean;
  explanation: string;
}

export interface RepoQuizResultResponse {
  attemptId: string;
  repositoryId: string;
  repositoryFullName: string;
  score: number;
  percentage: number;
  totalQuestions: number;
  correctCount: number;
  incorrectCount: number;
  passed: boolean;
  completedAt: string;
  knowledgeGaps: string[];
  assessedCapabilities: string[];
  questions: RepoQuizQuestionReview[];
}
