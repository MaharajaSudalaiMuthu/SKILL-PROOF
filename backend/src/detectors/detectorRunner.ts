import { DetectorFinding } from '@skillproof/shared';
import { ParsedJavaFile } from './ast/javaAstHelper.js';
import { SymbolIndex } from './ast/symbolIndex.js';
import { detectRestController } from './impl/restControllerDetector.js';
import { detectJpaHibernate } from './impl/jpaHibernateDetector.js';
import { detectSpringSecurity } from './impl/springSecurityDetector.js';
import { detectJwt } from './impl/jwtDetector.js';
import { detectExceptionHandling } from './impl/exceptionHandlingDetector.js';
import { detectUnitTest } from './impl/unitTestDetector.js';
import { detectTransaction } from './impl/transactionDetector.js';
import { detectInputValidation } from './impl/inputValidationDetector.js';
import { logger } from '../middleware/pinoLogger.js';

export interface DetectorRunnerResult {
  findings: DetectorFinding[];
  parseErrorCount: number;
}

export function runAllDetectors(parsedFiles: ParsedJavaFile[]): DetectorRunnerResult {
  const index = new SymbolIndex(parsedFiles);
  const findings: DetectorFinding[] = [];
  let parseErrorCount = 0;

  for (const file of parsedFiles) {
    if (file.hasParseError) {
      parseErrorCount++;
      continue;
    }

    try {
      findings.push(...detectRestController(file, index));
      findings.push(...detectJpaHibernate(file, index));
      findings.push(...detectSpringSecurity(file, index));
      findings.push(...detectJwt(file, index));
      findings.push(...detectExceptionHandling(file, index));
      findings.push(...detectUnitTest(file, index));
      findings.push(...detectTransaction(file, index));
      findings.push(...detectInputValidation(file, index));
    } catch (err) {
      logger.error({ filePath: file.filePath, err }, 'Unexpected error executing detectors on file.');
    }
  }

  return { findings, parseErrorCount };
}
