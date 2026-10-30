import { MongoMemoryReplSet } from 'mongodb-memory-server';
import fs from 'fs';
import path from 'path';

async function startLocalReplicaSet() {
  console.log('Starting local MongoDB replica set (rs0) via MongoMemoryReplSet on port 27017...');

  const replSet = await MongoMemoryReplSet.create({
    replSet: {
      name: 'rs0',
      count: 1,
      storageEngine: 'wiredTiger',
    },
    instanceOpts: [
      {
        port: 27017,
        dbName: 'skillproof',
      },
    ],
  });

  await replSet.waitUntilRunning();
  const uri = replSet.getUri('skillproof');
  try {
    fs.writeFileSync(path.resolve(process.cwd(), '.local-mongo-uri'), uri, 'utf8');
  } catch {}
  console.log(`\n======================================================`);
  console.log(`Local MongoDB Replica Set is ONLINE!`);
  console.log(`URI: ${uri}`);
  console.log(`Port: 27017`);
  console.log(`Replica Set: rs0`);
  console.log(`======================================================\n`);

  // Keep process alive indefinitely
  setInterval(() => {}, 60000);

  const cleanup = async () => {
    console.log('Stopping local MongoDB replica set...');
    await replSet.stop();
    console.log('MongoDB stopped.');
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);
}

startLocalReplicaSet().catch((err) => {
  console.error('Failed to start local MongoDB replica set:', err);
  process.exit(1);
});
