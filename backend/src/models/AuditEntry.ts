import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IAuditEntry extends Document {
  userId: Types.ObjectId;
  action: string;
  details: Record<string, unknown>;
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

const AuditEntrySchema = new Schema<IAuditEntry>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    action: { type: String, required: true },
    details: { type: Schema.Types.Mixed, default: {} },
    timestamp: { type: Date, required: true, default: Date.now, index: true },
    ipAddress: { type: String },
    userAgent: { type: String },
  },
  {
    timestamps: true,
    collection: 'auditEntries',
    autoIndex: false,
  }
);

export const AuditEntry =
  (mongoose.models.AuditEntry as mongoose.Model<IAuditEntry>) ||
  mongoose.model<IAuditEntry>('AuditEntry', AuditEntrySchema);
