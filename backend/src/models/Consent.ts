import mongoose, { Schema, Document, Types } from 'mongoose';

export interface IConsent extends Document {
  userId: Types.ObjectId;
  consentVersion: string;
  agreedAt: Date;
  ipHash?: string;
}

const ConsentSchema = new Schema<IConsent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    consentVersion: { type: String, required: true },
    agreedAt: { type: Date, required: true, default: Date.now },
    ipHash: { type: String },
  },
  {
    timestamps: false,
    collection: 'consents',
    autoIndex: false,
  }
);

export const ConsentModel = mongoose.model<IConsent>('Consent', ConsentSchema);
