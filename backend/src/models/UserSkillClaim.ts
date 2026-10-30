import mongoose, { Schema, Document, Types } from 'mongoose';
import { SkillSlug, SKILL_SLUGS } from '@skillproof/shared';

export interface IUserSkillClaim extends Document {
  userId: Types.ObjectId;
  skillSlug: SkillSlug;
  claimedAt: Date;
}

const UserSkillClaimSchema = new Schema<IUserSkillClaim>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    skillSlug: { type: String, required: true, enum: SKILL_SLUGS },
    claimedAt: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: false,
    collection: 'userSkillClaims',
    autoIndex: false,
  }
);

export const UserSkillClaimModel = mongoose.model<IUserSkillClaim>('UserSkillClaim', UserSkillClaimSchema);
