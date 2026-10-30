import mongoose, { Document, Schema, Types } from 'mongoose';
import {
  AntiGamingFlagType,
  ANTI_GAMING_FLAG_TYPES,
  FlagSeverity,
  FLAG_SEVERITIES,
} from '@skillproof/shared';

export interface IAntiGamingFlag extends Document {
  repositoryId: Types.ObjectId;
  userId: Types.ObjectId;
  flagType: AntiGamingFlagType;
  severity: FlagSeverity;
  explanation: string;
  metricValue: number;
  createdAt: Date;
}

const AntiGamingFlagSchema = new Schema<IAntiGamingFlag>(
  {
    repositoryId: { type: Schema.Types.ObjectId, ref: 'Repository', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    flagType: { type: String, enum: ANTI_GAMING_FLAG_TYPES, required: true },
    severity: { type: String, enum: FLAG_SEVERITIES, required: true },
    explanation: { type: String, required: true },
    metricValue: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

AntiGamingFlagSchema.index({ repositoryId: 1 });
AntiGamingFlagSchema.index({ userId: 1 });

export const AntiGamingFlag = mongoose.model<IAntiGamingFlag>(
  'AntiGamingFlag',
  AntiGamingFlagSchema,
  'antiGamingFlags'
);
