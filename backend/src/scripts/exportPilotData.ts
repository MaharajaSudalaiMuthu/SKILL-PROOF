import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import { config } from '../config/index.js';
import { exportPseudonymizedEvaluationData } from '../evaluation/exportService.js';
import { logger } from '../middleware/pinoLogger.js';

async function main() {
  const outputPath = process.argv[2] || path.resolve(process.cwd(), 'pilot-evaluation-export.json');

  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGODB_URI || config.env.MONGODB_URI);
  }

  logger.info({ outputPath }, 'Exporting pilot evaluation data...');
  const data = await exportPseudonymizedEvaluationData();

  fs.writeFileSync(outputPath, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`Successfully exported ${data.totalRecords} records across ${data.totalSubjects} subjects to: ${outputPath}`);

  await mongoose.disconnect();
}

if (process.argv[1]?.endsWith('exportPilotData.ts') || process.argv[1]?.endsWith('exportPilotData.js')) {
  main().catch((err) => {
    console.error('Export failed:', err);
    process.exit(1);
  });
}
