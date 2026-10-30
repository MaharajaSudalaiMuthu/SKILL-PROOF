import mongoose, { Document, Schema, Types } from 'mongoose';
import { DeletionTier, DeletionPurgedCounts } from '@skillproof/shared';

export interface IDeletionRequest extends Document {
  userId: Types.ObjectId;
  tier: DeletionTier;
  status: 'COMPLETED' | 'FAILED';
  purgedCounts: DeletionPurgedCounts;
  requestedAt: Date;
  completedAt: Date;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DeletionRequestSchema = new Schema<IDeletionRequest>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tier: {
      type: String,
      required: true,
      enum: ['ANALYSIS_DATA', 'ACCOUNT'],
    },
    status: {
      type: String,
      required: true,
      enum: ['COMPLETED', 'FAILED'],
      default: 'COMPLETED',
    },
    purgedCounts: { type: Schema.Types.Mixed, required: true },
    requestedAt: { type: Date, required: true, default: Date.now },
    completedAt: { type: Date, required: true, default: Date.now },
    errorMessage: { type: String },
  },
  {
    timestamps: true,
    collection: 'deletionRequests',
    autoIndex: false,
  }
);

export const DeletionRequest =
  (mongoose.models.DeletionRequest as mongoose.Model<IDeletionRequest>) ||
  mongoose.model<IDeletionRequest>('DeletionRequest', DeletionRequestSchema);
