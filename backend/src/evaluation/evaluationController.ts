import { Router, Response } from 'express';
import {
  ComputeAgreementRequestSchema,
  ComputeAgreementResponse,
  EvaluationExportPayload,
} from '@skillproof/shared';
import { requireAuth, requireCsrf, AuthenticatedRequest } from '../middleware/auth.js';
import { AppError } from '../middleware/errorHandler.js';
import { exportPseudonymizedEvaluationData } from './exportService.js';
import { computeInterRaterAgreement, RatingPair } from './agreementService.js';
import { logger } from '../middleware/pinoLogger.js';

export const evaluationRouter = Router();

evaluationRouter.use(requireAuth);

/**
 * GET /api/evaluation/export
 * Exports complete pseudonymized pilot evaluation dataset across all subjects and skills.
 * Guarantees zero PII retention (deterministic salt-hashed subject IDs).
 */
evaluationRouter.get(
  '/export',
  async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const payload: EvaluationExportPayload = await exportPseudonymizedEvaluationData();
      res.json(payload);
    } catch (err) {
      logger.error({ err }, 'Failed to export evaluation data');
      throw new AppError(500, 'EXPORT_FAILED', 'Failed to generate pseudonymized evaluation data');
    }
  }
);

/**
 * POST /api/evaluation/agreement
 * Receives expert rating entries and computes inter-rater agreement against SkillProof automated levels.
 * Returns: Cohen's Kappa, Linear Weighted Kappa, Quadratic Weighted Kappa, Percentage Agreement,
 * and 5x5 Confusion Matrix.
 */
evaluationRouter.post(
  '/agreement',
  requireCsrf,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    const parseResult = ComputeAgreementRequestSchema.safeParse(req.body);
    if (!parseResult.success) {
      throw new AppError(
        400,
        'VALIDATION_ERROR',
        parseResult.error.errors.map((e) => e.message).join('; ')
      );
    }

    const { ratings } = parseResult.data;

    // Get current platform levels for all subjects
    const exportPayload = await exportPseudonymizedEvaluationData();
    const platformMap = new Map<string, string>(); // key: `${subjectId}:${skillSlug}` -> platformLevel

    for (const rec of exportPayload.records) {
      platformMap.set(`${rec.subjectId}:${rec.skillSlug}`, rec.platformLevel);
    }

    const pairs: RatingPair[] = [];
    for (const rating of ratings) {
      const key = `${rating.subjectId}:${rating.skillSlug}`;
      const platformLevel = (platformMap.get(key) || 'NONE') as any;
      pairs.push({
        platformLevel,
        expertLevel: rating.expertLevel,
      });
    }

    const metrics = computeInterRaterAgreement(pairs);

    const response: ComputeAgreementResponse = {
      metrics,
      evaluatedAt: new Date().toISOString(),
    };

    res.json(response);
  }
);
