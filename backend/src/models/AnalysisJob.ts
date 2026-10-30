import mongoose, { Document, Schema, Types } from 'mongoose';
import { JobStatus, JOB_STATUSES } from '@skillproof/shared';

export interface IAnalysisJob extends Document {
  repositoryId: Types.ObjectId;
  userId: Types.ObjectId;
  status: JobStatus;
  progressPercent: number;
  stage: string;
  errorMessage: string | null;
  filesAnalyzed: number;
  totalLines: number;
  confirmedLines: number;
  startedAt?: Date;
  completedAt?: Date;
  createdAt: Date;
}

const AnalysisJobSchema = new Schema<IAnalysisJob>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    status: {
      type: String,
      enum: JOB_STATUSES,
      required: true,
      default: 'QUEUED',
    },
    progressPercent: { type: Number, required: true, default: 0, min: 0, max: 100 },
    stage: { type: String, required: true, default: 'QUEUED' },
    errorMessage: { type: String, default: null },
    filesAnalyzed: { type: Number, required: true, default: 0 },
    totalLines: { type: Number, required: true, default: 0 },
    confirmedLines: { type: Number, required: true, default: 0 },
    startedAt: { type: Date },
    completedAt: { type: Date },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Indexes (mirrors migrate-mongo baseline)
AnalysisJobSchema.index({ repositoryId: 1 });
AnalysisJobSchema.index({ userId: 1 });
AnalysisJobSchema.index({ status: 1 });

export const AnalysisJob = mongoose.model<IAnalysisJob>('AnalysisJob', AnalysisJobSchema, 'analysisJobs');
