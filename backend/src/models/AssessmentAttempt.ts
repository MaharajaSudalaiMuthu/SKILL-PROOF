import mongoose, { Document, Schema, Types } from 'mongoose';
import { SkillSlug, SKILL_SLUGS } from '@skillproof/shared';

export interface IAssessmentAnswer {
  questionId: string;
  selectedOptionIndex: number;
}

export interface IAssessmentAttempt extends Document {
  userId: Types.ObjectId;
  skillSlug: SkillSlug;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'EXPIRED';
  questionIds: string[];
  answers: IAssessmentAnswer[];
  score: number;
  passed: boolean;
  startedAt: Date;
  completedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const AssessmentAnswerSchema = new Schema<IAssessmentAnswer>(
  {
    questionId: { type: String, required: true },
    selectedOptionIndex: { type: Number, required: true, min: 0, max: 3 },
  },
  { _id: false }
);

const AssessmentAttemptSchema = new Schema<IAssessmentAttempt>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    skillSlug: { type: String, required: true, enum: SKILL_SLUGS },
    status: {
      type: String,
      required: true,
      enum: ['IN_PROGRESS', 'COMPLETED', 'EXPIRED'],
      default: 'IN_PROGRESS',
    },
    questionIds: { type: [String], required: true },
    answers: { type: [AssessmentAnswerSchema], default: [] },
    score: { type: Number, required: true, default: 0 },
    passed: { type: Boolean, required: true, default: false },
    startedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date },
    expiresAt: { type: Date, required: true },
  },
  {
    timestamps: true,
    collection: 'assessmentAttempts',
    autoIndex: false,
  }
);

AssessmentAttemptSchema.index({ userId: 1, skillSlug: 1 });
AssessmentAttemptSchema.index({ userId: 1, status: 1 });

export const AssessmentAttempt = mongoose.model<IAssessmentAttempt>(
  'AssessmentAttempt',
  AssessmentAttemptSchema,
  'assessmentAttempts'
);
