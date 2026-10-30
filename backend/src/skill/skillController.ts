import { Router, Response } from 'express';
import { CreateClaimSchema, SkillSlug, SKILL_SLUGS } from '@skillproof/shared';
import { requireAuth, requireCsrf, AuthenticatedRequest } from '../middleware/auth.js';
import { SkillModel } from '../models/Skill.js';
import { UserSkillClaimModel } from '../models/UserSkillClaim.js';
import { recomputeUserSnapshots } from '../engine/snapshotService.js';
import { AppError } from '../middleware/errorHandler.js';

export const skillRouter = Router();

// GET /api/skills - List skills with current user's claim status
skillRouter.get('/', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  const skills = await SkillModel.find().sort({ displayOrder: 1 });
  const userClaims = await UserSkillClaimModel.find({ userId: req.user?._id });

  const claimsMap = new Map<string, Date>();
  for (const claim of userClaims) {
    claimsMap.set(claim.skillSlug, claim.claimedAt);
  }

  const result = skills.map((s) => ({
    slug: s.slug,
    name: s.name,
    description: s.description,
    displayOrder: s.displayOrder,
    maxAttainableLevel: s.maxAttainableLevel,
    claimed: claimsMap.has(s.slug),
    claimedAt: claimsMap.get(s.slug) || null,
  }));

  res.status(200).json(result);
});

// POST /api/skills/claims - Declare a self-reported skill claim (R23)
skillRouter.post('/claims', requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const payload = CreateClaimSchema.parse(req.body);

  const existingClaim = await UserSkillClaimModel.findOne({
    userId: req.user?._id,
    skillSlug: payload.skillSlug,
  });

  if (existingClaim) {
    res.status(200).json({
      message: 'Skill is already claimed.',
      skillSlug: existingClaim.skillSlug,
      claimedAt: existingClaim.claimedAt,
    });
    return;
  }

  const claim = await UserSkillClaimModel.create({
    userId: req.user?._id,
    skillSlug: payload.skillSlug,
    claimedAt: new Date(),
  });

  await recomputeUserSnapshots(req.user!._id);

  res.status(201).json({
    message: 'Skill claimed successfully.',
    skillSlug: claim.skillSlug,
    claimedAt: claim.claimedAt,
  });
});

// DELETE /api/skills/claims/:skillSlug - Remove a declared skill claim
skillRouter.delete('/claims/:skillSlug', requireAuth, requireCsrf, async (req: AuthenticatedRequest, res: Response) => {
  const { skillSlug } = req.params;

  if (!skillSlug || !SKILL_SLUGS.includes(skillSlug as SkillSlug)) {
    throw new AppError(400, 'INVALID_SKILL_SLUG', `Invalid skill slug: '${skillSlug}'.`);
  }

  await UserSkillClaimModel.deleteOne({
    userId: req.user?._id,
    skillSlug,
  });

  await recomputeUserSnapshots(req.user!._id);

  res.status(200).json({
    message: `Claim for skill '${skillSlug}' removed successfully.`,
    skillSlug,
  });
});
