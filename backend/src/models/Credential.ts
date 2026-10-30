import mongoose, { Document, Schema, Types } from 'mongoose';
import { CredentialStatus, SkillLevel, VerifiableCredential } from '@skillproof/shared';

export interface ICredential extends Document {
  credentialId: string;
  userId: Types.ObjectId;
  skillSlug: string;
  level: SkillLevel;
  status: CredentialStatus;
  issuedAt: Date;
  validUntil: Date;
  revokedAt?: Date;
  revocationReason?: string;
  credentialPayload: VerifiableCredential;
  createdAt: Date;
  updatedAt: Date;
}

const CredentialSchema = new Schema<ICredential>(
  {
    credentialId: { type: String, required: true, unique: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    skillSlug: { type: String, required: true, index: true },
    level: {
      type: String,
      required: true,
      enum: ['NONE', 'CLAIMED', 'OBSERVED', 'SUPPORTED', 'VERIFIED'],
    },
    status: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'REVOKED', 'EXPIRED', 'SUPERSEDED'],
      default: 'ACTIVE',
      index: true,
    },
    issuedAt: { type: Date, required: true, default: Date.now },
    validUntil: { type: Date, required: true },
    revokedAt: { type: Date },
    revocationReason: { type: String },
    credentialPayload: { type: Schema.Types.Mixed, required: true },
  },
  {
    timestamps: true,
    collection: 'credentials',
    autoIndex: false,
  }
);

export const Credential =
  (mongoose.models.Credential as mongoose.Model<ICredential>) ||
  mongoose.model<ICredential>('Credential', CredentialSchema);
