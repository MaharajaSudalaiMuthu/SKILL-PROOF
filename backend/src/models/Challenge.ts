import mongoose, { Document, Schema } from 'mongoose';
import { SkillSlug, SKILL_SLUGS } from '@skillproof/shared';

export interface IChallengeFile {
  path: string;
  content: string;
  readOnly?: boolean;
}

export interface IChallenge extends Document {
  slug: string;
  title: string;
  description: string;
  mappedSkills: SkillSlug[];
  timeLimitMinutes: number;
  starterFiles: IChallengeFile[];
  hiddenTestFiles: IChallengeFile[];
  instructions: string;
  createdAt: Date;
  updatedAt: Date;
}

const ChallengeFileSchema = new Schema<IChallengeFile>(
  {
    path: { type: String, required: true },
    content: { type: String, required: true },
    readOnly: { type: Boolean, default: false },
  },
  { _id: false }
);

const ChallengeSchema = new Schema<IChallenge>(
  {
    slug: { type: String, required: true, unique: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    mappedSkills: {
      type: [String],
      required: true,
      validate: [
        (val: string[]) => val.length > 0 && val.every((s) => SKILL_SLUGS.includes(s as SkillSlug)),
        'Must contain valid canonical skill slugs',
      ],
    },
    timeLimitMinutes: { type: Number, required: true, default: 45 },
    starterFiles: { type: [ChallengeFileSchema], required: true },
    hiddenTestFiles: { type: [ChallengeFileSchema], required: true },
    instructions: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: 'challenges',
    autoIndex: false,
  }
);

export const Challenge = mongoose.model<IChallenge>('Challenge', ChallengeSchema, 'challenges');
