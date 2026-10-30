import mongoose, { Document, Schema, Types } from 'mongoose';

export interface ISandboxSubmittedFile {
  path: string;
  content: string;
}

export interface ISandboxRun extends Document {
  runId: string;
  userId: Types.ObjectId;
  challengeSlug: string;
  status: 'QUEUED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'TIMED_OUT';
  submittedFiles: ISandboxSubmittedFile[];
  passed: boolean;
  score: number;
  totalTests: number;
  passedTests: number;
  failedTests: number;
  testOutput: string;
  executionTimeMs: number;
  completedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const SandboxSubmittedFileSchema = new Schema<ISandboxSubmittedFile>(
  {
    path: { type: String, required: true },
    content: { type: String, required: true },
  },
  { _id: false }
);

const SandboxRunSchema = new Schema<ISandboxRun>(
  {
    runId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    challengeSlug: { type: String, required: true, index: true },
    status: {
      type: String,
      required: true,
      enum: ['QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'TIMED_OUT'],
      default: 'COMPLETED',
    },
    submittedFiles: { type: [SandboxSubmittedFileSchema], required: true },
    passed: { type: Boolean, required: true, default: false },
    score: { type: Number, required: true, default: 0 },
    totalTests: { type: Number, required: true, default: 0 },
    passedTests: { type: Number, required: true, default: 0 },
    failedTests: { type: Number, required: true, default: 0 },
    testOutput: { type: String, default: '' },
    executionTimeMs: { type: Number, default: 0 },
    completedAt: { type: Date, required: true, default: Date.now },
  },
  {
    timestamps: true,
    collection: 'sandboxRuns',
    autoIndex: false,
  }
);

SandboxRunSchema.index({ userId: 1, challengeSlug: 1, passed: 1 });
SandboxRunSchema.index({ userId: 1, createdAt: -1 });

export const SandboxRun = mongoose.model<ISandboxRun>('SandboxRun', SandboxRunSchema, 'sandboxRuns');
