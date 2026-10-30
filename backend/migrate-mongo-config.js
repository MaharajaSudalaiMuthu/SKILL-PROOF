import dotenv from 'dotenv';
dotenv.config({ path: '../.env' });

const config = {
  mongodb: {
    url: process.env.MONGODB_URI || 'mongodb://localhost:27017/skillproof?replicaSet=rs0',
    databaseName: 'skillproof',
    options: {}
  },
  migrationsDir: 'migrations',
  changelogCollectionName: 'changelog',
  migrationFileExtension: '.js',
  useFileHash: false,
  moduleSystem: 'esm'
};

export default config;
export const mongodb = config.mongodb;
export const migrationsDir = config.migrationsDir;
export const changelogCollectionName = config.changelogCollectionName;
export const migrationFileExtension = config.migrationFileExtension;
export const useFileHash = config.useFileHash;
export const moduleSystem = config.moduleSystem;
