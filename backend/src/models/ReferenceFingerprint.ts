import mongoose, { Document, Schema } from 'mongoose';

export interface IReferenceFingerprint extends Document {
  projectName: string;
  commitSha: string;
  fingerprintHash: string;
  createdAt: Date;
}

const ReferenceFingerprintSchema = new Schema<IReferenceFingerprint>(
  {
    projectName: { type: String, required: true },
    commitSha: { type: String, required: true },
    fingerprintHash: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

ReferenceFingerprintSchema.index({ fingerprintHash: 1 });
ReferenceFingerprintSchema.index({ projectName: 1 });

export const ReferenceFingerprint = mongoose.model<IReferenceFingerprint>(
  'ReferenceFingerprint',
  ReferenceFingerprintSchema,
  'referenceFingerprints'
);
