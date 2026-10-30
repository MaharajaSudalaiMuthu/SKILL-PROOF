import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { z } from 'zod';
import { SkillProofConfigSchema } from '@skillproof/shared';

import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load root .env file
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

let fallbackMongoUri = 'mongodb://127.0.0.1:27017/skillproof?replicaSet=rs0';
try {
  const localUriFile = path.resolve(__dirname, '../../../../.local-mongo-uri');
  if (fs.existsSync(localUriFile)) {
    const content = fs.readFileSync(localUriFile, 'utf8').trim();
    if (content) fallbackMongoUri = content;
  }
} catch {}

const EnvSchema = z.object({
  PORT: z.coerce.number().default(8080),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_BASE_URL: z.string().url().default('http://localhost:5173'),
  API_BASE_URL: z.string().url().default('http://localhost:8080'),
  MONGODB_URI: z.string().default(fallbackMongoUri),
  JWT_SECRET: z.string().min(32).default('a_temporary_development_jwt_secret_min_32_characters_long_for_dev_mode'),
  ENCRYPTION_SECRET_KEY: z.string().length(64).default('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  GITHUB_CLIENT_ID: z.string().default('placeholder_client_id'),
  GITHUB_CLIENT_SECRET: z.string().default('placeholder_client_secret'),
  SIGNING_KEY_PATH: z.string().default('keys/ed25519-private.pem'),
  SANDBOX_RUNNER_URL: z.string().url().default('http://127.0.0.1:8081'),
  SANDBOX_RUNNER_SECRET: z.string().min(32).default('temporary_runner_secret_min_32_chars_for_hmac_auth'),
});

const parsedEnv = EnvSchema.parse(process.env);
const parsedSkillProof = SkillProofConfigSchema.parse({});

export const config = {
  env: parsedEnv,
  skillproof: parsedSkillProof,
};

export type AppConfig = typeof config;
