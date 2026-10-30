import mongoose, { Schema, Document } from 'mongoose';
import { SkillSlug, SKILL_SLUGS } from '@skillproof/shared';

export interface ISkill extends Document {
  slug: SkillSlug;
  name: string;
  description: string;
  displayOrder: number;
  maxAttainableLevel: string;
}

const SkillSchema = new Schema<ISkill>(
  {
    slug: { type: String, required: true, unique: true, enum: SKILL_SLUGS },
    name: { type: String, required: true },
    description: { type: String, required: true },
    displayOrder: { type: Number, required: true },
    maxAttainableLevel: { type: String, required: true, enum: ['SUPPORTED', 'VERIFIED'] },
  },
  {
    timestamps: true,
    collection: 'skills',
    autoIndex: false,
  }
);

export const SkillModel = mongoose.model<ISkill>('Skill', SkillSchema);
