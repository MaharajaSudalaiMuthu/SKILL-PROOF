import mongoose, { Document, Schema, Types } from 'mongoose';
import { AttributionStatus, ATTRIBUTION_STATUSES } from '@skillproof/shared';

export interface ILineRange {
  startLine: number;
  endLine: number;
  commitSha: string;
  commitDate: Date;
  authorLogin: string | null;
  status: AttributionStatus;
}

export interface IFileAttribution extends Document {
  analysisJobId: Types.ObjectId;
  repositoryId: Types.ObjectId;
  userId: Types.ObjectId;
  filePath: string;
  ranges: ILineRange[];
  totalLines: number;
  confirmedLines: number;
  uncertainLines: number;
  otherLines: number;
  createdAt: Date;
}

const LineRangeSchema = new Schema<ILineRange>(
  {
    startLine: { type: Number, required: true },
    endLine: { type: Number, required: true },
    commitSha: { type: String, required: true },
    commitDate: { type: Date, required: true },
    authorLogin: { type: String, default: null },
    status: { type: String, enum: ATTRIBUTION_STATUSES, required: true },
  },
  { _id: false }
);

const FileAttributionSchema = new Schema<IFileAttribution>(
  {
    analysisJobId: { type: Schema.Types.ObjectId, ref: 'AnalysisJob', required: true },
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    filePath: { type: String, required: true },
    ranges: [LineRangeSchema],
    totalLines: { type: Number, required: true, default: 0 },
    confirmedLines: { type: Number, required: true, default: 0 },
    uncertainLines: { type: Number, required: true, default: 0 },
    otherLines: { type: Number, required: true, default: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

FileAttributionSchema.index({ analysisJobId: 1 });
FileAttributionSchema.index({ userId: 1 });
FileAttributionSchema.index({ repositoryId: 1 });

export const FileAttribution = mongoose.model<IFileAttribution>(
  'FileAttribution',
  FileAttributionSchema,
  'fileAttributions'
);
