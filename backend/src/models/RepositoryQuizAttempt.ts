import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IQuizQuestionDoc {
  id: string;
  category: string;
  skillSlug: string;
  title: string;
  question: string;
  fileReference: string;
  codeSnippet?: string;
  options: string[];
  correctOptionIndex: number;
  explanation: string;
}

export interface IQuizAnswerDoc {
  questionId: string;
  selectedOptionIndex: number;
}

export interface IRepositoryQuizAttempt extends Document {
  userId: Types.ObjectId;
  repositoryId: Types.ObjectId;
  repositoryFullName: string;
  status: 'IN_PROGRESS' | 'COMPLETED';
  questions: IQuizQuestionDoc[];
  answers: IQuizAnswerDoc[];
  score: number;
  percentage: number;
  totalQuestions: number;
  correctCount: number;
  passed: boolean;
  knowledgeGaps: string[];
  assessedCapabilities: string[];
  startedAt: Date;
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const QuizQuestionSchema = new Schema<IQuizQuestionDoc>(
  {
    id: { type: String, required: true },
    category: { type: String, required: true },
    skillSlug: { type: String, required: true },
    title: { type: String, required: true },
    question: { type: String, required: true },
    fileReference: { type: String, required: true },
    codeSnippet: { type: String },
    options: { type: [String], required: true },
    correctOptionIndex: { type: Number, required: true },
    explanation: { type: String, required: true },
  },
  { _id: false }
);

const QuizAnswerSchema = new Schema<IQuizAnswerDoc>(
  {
    questionId: { type: String, required: true },
    selectedOptionIndex: { type: Number, required: true },
  },
  { _id: false }
);

const RepositoryQuizAttemptSchema = new Schema<IRepositoryQuizAttempt>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    repositoryFullName: { type: String, required: true },
    status: { type: String, enum: ['IN_PROGRESS', 'COMPLETED'], default: 'IN_PROGRESS', required: true },
    questions: { type: [QuizQuestionSchema], required: true },
    answers: { type: [QuizAnswerSchema], default: [] },
    score: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    totalQuestions: { type: Number, default: 0 },
    correctCount: { type: Number, default: 0 },
    passed: { type: Boolean, default: false },
    knowledgeGaps: { type: [String], default: [] },
    assessedCapabilities: { type: [String], default: [] },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
  },
  {
    timestamps: true,
    collection: 'repositoryQuizAttempts',
  }
);

RepositoryQuizAttemptSchema.index({ userId: 1, repositoryId: 1 });
RepositoryQuizAttemptSchema.index({ repositoryId: 1, status: 1 });

export const RepositoryQuizAttempt = mongoose.model<IRepositoryQuizAttempt>(
  'RepositoryQuizAttempt',
  RepositoryQuizAttemptSchema,
  'repositoryQuizAttempts'
);
