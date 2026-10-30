import mongoose, { Document, Schema } from 'mongoose';
import { SkillSlug, SKILL_SLUGS } from '@skillproof/shared';

export interface IAssessmentQuestion extends Document {
  questionId: string;
  skillSlug: SkillSlug;
  title: string;
  scenario: string;
  codeSnippet?: string;
  options: string[];
  correctOptionIndex: number;
  rubricExplanation: string;
  difficulty: string;
  createdAt: Date;
}

const AssessmentQuestionSchema = new Schema<IAssessmentQuestion>(
  {
    questionId: { type: String, required: true, unique: true },
    skillSlug: { type: String, required: true, enum: SKILL_SLUGS, index: true },
    title: { type: String, required: true },
    scenario: { type: String, required: true },
    codeSnippet: { type: String },
    options: {
      type: [String],
      required: true,
      validate: [(val: string[]) => val.length === 4, 'Must provide exactly 4 options'],
    },
    correctOptionIndex: { type: Number, required: true, min: 0, max: 3 },
    rubricExplanation: { type: String, required: true },
    difficulty: { type: String, required: true, default: 'INTERMEDIATE' },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'assessmentQuestions',
    autoIndex: false,
  }
);

export const AssessmentQuestion = mongoose.model<IAssessmentQuestion>(
  'AssessmentQuestion',
  AssessmentQuestionSchema,
  'assessmentQuestions'
);
