import mongoose, { Document, Schema, Types } from 'mongoose';
import { SkillSlug, SKILL_SLUGS, SkillLevel, SKILL_LEVELS } from '@skillproof/shared';

export interface ISkillLevelSnapshot extends Document {
  userId: Types.ObjectId;
  skillSlug: SkillSlug;
  currentLevel: SkillLevel;
  awardedAt: Date | null;
  reasons: string[];
  supportingEvidenceIds: string[];
  missingRequirements: string[];
  totalRecencyWeight: number;
  qualifyingFindingsCount: number;
  limitations: string[];
  nextAction: string | null;
  evaluatedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SkillLevelSnapshotSchema = new Schema<ISkillLevelSnapshot>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    skillSlug: { type: String, enum: SKILL_SLUGS, required: true },
    currentLevel: { type: String, enum: SKILL_LEVELS, required: true },
    awardedAt: { type: Date, default: null },
    reasons: { type: [String], default: [] },
    supportingEvidenceIds: { type: [String], default: [] },
    missingRequirements: { type: [String], default: [] },
    totalRecencyWeight: { type: Number, required: true, default: 0 },
    qualifyingFindingsCount: { type: Number, required: true, default: 0 },
    limitations: { type: [String], default: [] },
    nextAction: { type: String, default: null },
    evaluatedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

SkillLevelSnapshotSchema.index({ userId: 1, skillSlug: 1 }, { unique: true });
SkillLevelSnapshotSchema.index({ userId: 1, currentLevel: 1 });

export const SkillLevelSnapshot = mongoose.model<ISkillLevelSnapshot>(
  'SkillLevelSnapshot',
  SkillLevelSnapshotSchema,
  'skillLevelSnapshots'
);
