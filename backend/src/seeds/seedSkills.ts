import { SKILL_DEFINITIONS, SKILL_SLUGS } from '@skillproof/shared';
import { SkillModel } from '../models/Skill.js';
import { logger } from '../middleware/pinoLogger.js';

export async function seedSkills(): Promise<void> {
  for (const slug of SKILL_SLUGS) {
    const def = SKILL_DEFINITIONS[slug];
    await SkillModel.findOneAndUpdate(
      { slug },
      {
        slug: def.slug,
        name: def.name,
        description: def.description,
        displayOrder: def.displayOrder,
        maxAttainableLevel: def.maxAttainableLevel,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
  logger.info('Canonical skills catalogue seeded idempotently.');
}
