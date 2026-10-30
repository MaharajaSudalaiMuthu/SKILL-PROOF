import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  SkillSlug,
  SKILL_SLUGS,
  EvidenceType,
  EVIDENCE_TYPES,
  EvidenceValidityStatus,
  EVIDENCE_VALIDITY_STATUSES,
  AttributionStatus,
  ATTRIBUTION_STATUSES,
} from '@skillproof/shared';

export interface IEvidenceRecord extends Document {
  userId: Types.ObjectId;
  skillSlug: SkillSlug;
  evidenceType: EvidenceType;
  validityStatus: EvidenceValidityStatus;
  attributionStatus: AttributionStatus;
  repositoryId?: Types.ObjectId;
  filePath?: string;
  startLine?: number;
  endLine?: number;
  commitSha?: string;
  commitDate?: Date;
  detectorName?: string;
  matchedPattern?: string;
  dedupeKey: string;
  rawDetails: Record<string, unknown>;
  recencyWeight: number;
  createdAt: Date;
}

const EvidenceRecordSchema = new Schema<IEvidenceRecord>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    skillSlug: { type: String, enum: SKILL_SLUGS, required: true },
    evidenceType: { type: String, enum: EVIDENCE_TYPES, required: true, default: 'STATIC' },
    validityStatus: { type: String, enum: EVIDENCE_VALIDITY_STATUSES, required: true, default: 'VALID' },
    attributionStatus: { type: String, enum: ATTRIBUTION_STATUSES, required: true, default: 'CONFIRMED' },
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository' },
    filePath: { type: String },
    startLine: { type: Number },
    endLine: { type: Number },
    commitSha: { type: String },
    commitDate: { type: Date },
    detectorName: { type: String },
    matchedPattern: { type: String },
    dedupeKey: { type: String, required: true, unique: true },
    rawDetails: { type: Schema.Types.Mixed, default: {} },
    recencyWeight: { type: Number, required: true, default: 1.0 },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

EvidenceRecordSchema.index({ userId: 1, skillSlug: 1, validityStatus: 1 });
EvidenceRecordSchema.index({ repositoryId: 1 });

export const EvidenceRecord = mongoose.model<IEvidenceRecord>(
  'EvidenceRecord',
  EvidenceRecordSchema,
  'evidenceRecords'
);
