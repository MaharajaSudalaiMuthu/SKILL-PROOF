import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  githubUserId: number;
  githubLogin: string;
  name?: string;
  avatarUrl?: string;
  encryptedAccessToken: string;
  tokenIv: string;
  tokenAuthTag: string;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    githubUserId: { type: Number, required: true, unique: true },
    githubLogin: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, trim: true },
    avatarUrl: { type: String, trim: true },
    encryptedAccessToken: { type: String, required: true },
    tokenIv: { type: String, required: true },
    tokenAuthTag: { type: String, required: true },
  },
  {
    timestamps: true,
    collection: 'users',
    autoIndex: false, // Managed by migrate-mongo
  }
);

export const UserModel = mongoose.model<IUser>('User', UserSchema);
export const User = UserModel;
