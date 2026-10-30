import { MongoMemoryReplSet } from 'mongodb-memory-server';

let replSet: MongoMemoryReplSet | null = null;

export async function setup() {
  replSet = await MongoMemoryReplSet.create({
    replSet: { name: 'rs0', count: 1 },
  });
  await replSet.waitUntilRunning();
  const uri = replSet.getUri('skillproof');
  process.env.MONGODB_URI = uri;
}

export async function teardown() {
  if (replSet) {
    await replSet.stop();
  }
}
