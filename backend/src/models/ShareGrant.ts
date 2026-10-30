import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IShareGrant extends Document {
  userId: Types.ObjectId;
  skillSlug: string;
  tokenHash: string;
  expiresAt: Date;
  status: 'ACTIVE' | 'REVOKED' | 'EXPIRED';
  revokedAt?: Date;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
}

const ShareGrantSchema = new Schema<IShareGrant>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    skillSlug: { type: String, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },
    status: {
      type: String,
      required: true,
      enum: ['ACTIVE', 'REVOKED', 'EXPIRED'],
      default: 'ACTIVE',
      index: true,
    },
    revokedAt: { type: Date },
    viewCount: { type: Number, required: true, default: 0 },
  },
  {
    timestamps: true,
    collection: 'shareGrants',
    autoIndex: false,
  }
);

export const ShareGrant =
  (mongoose.models.ShareGrant as mongoose.Model<IShareGrant>) ||
  mongoose.model<IShareGrant>('ShareGrant', ShareGrantSchema);
