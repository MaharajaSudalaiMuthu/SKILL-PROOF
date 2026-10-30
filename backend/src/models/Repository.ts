import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IRepository extends Document {
  userId: Types.ObjectId;
  githubRepoId: number;
  fullName: string;
  cloneUrl: string;
  isFork: boolean;
  defaultBranch: string;
  sourceType?: 'GITHUB' | 'ZIP_UPLOAD';
  isPrivate?: boolean;
  zipFilePath?: string;
  accessToken?: string;
  detectedLanguages?: string[];
  detectedFrameworks?: string[];
  createdAt: Date;
}

const RepositorySchema = new Schema<IRepository>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    githubRepoId: { type: Number, required: true },
    fullName: { type: String, required: true, trim: true },
    cloneUrl: { type: String, required: true, trim: true },
    isFork: { type: Boolean, required: true, default: false },
    defaultBranch: { type: String, required: true, default: 'main' },
    sourceType: { type: String, enum: ['GITHUB', 'ZIP_UPLOAD'], default: 'GITHUB' },
    isPrivate: { type: Boolean, default: false },
    zipFilePath: { type: String },
    accessToken: { type: String },
    detectedLanguages: { type: [String], default: [] },
    detectedFrameworks: { type: [String], default: [] },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Indexes (mirrors migrate-mongo baseline)
RepositorySchema.index({ userId: 1, githubRepoId: 1 }, { unique: true });
RepositorySchema.index({ userId: 1 });

export const Repository = mongoose.model<IRepository>('Repository', RepositorySchema, 'repositories');
