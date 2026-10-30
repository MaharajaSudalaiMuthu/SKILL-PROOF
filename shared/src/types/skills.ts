export const SKILL_SLUGS = [
  'rest-controller-design',
  'jpa-hibernate-persistence',
  'spring-security-configuration',
  'jwt-issuance-validation',
  'structured-exception-handling',
  'unit-tests-meaningful-assertions',
  'transaction-management',
  'input-validation',
] as const;

export type SkillSlug = (typeof SKILL_SLUGS)[number];

export interface SkillDefinition {
  slug: SkillSlug;
  name: string;
  description: string;
  displayOrder: number;
  maxAttainableLevel: 'SUPPORTED' | 'VERIFIED';
}

export const SKILL_DEFINITIONS: Record<SkillSlug, SkillDefinition> = {
  'rest-controller-design': {
    slug: 'rest-controller-design',
    name: 'REST Controller Design',
    description: 'Design and implementation of Spring REST endpoints with proper HTTP verbs, parameter binding, and response status.',
    displayOrder: 1,
    maxAttainableLevel: 'VERIFIED',
  },
  'jpa-hibernate-persistence': {
    slug: 'jpa-hibernate-persistence',
    name: 'JPA & Hibernate Persistence',
    description: 'Relational data mapping with JPA entities, Spring Data repositories, EntityManager interactions, and query methods.',
    displayOrder: 2,
    maxAttainableLevel: 'VERIFIED',
  },
  'spring-security-configuration': {
    slug: 'spring-security-configuration',
    name: 'Spring Security Configuration',
    description: 'Spring Security filter chain configuration, endpoint authorization rules, CORS/CSRF settings, and password encoding.',
    displayOrder: 3,
    maxAttainableLevel: 'VERIFIED',
  },
  'jwt-issuance-validation': {
    slug: 'jwt-issuance-validation',
    name: 'JWT Issuance & Validation',
    description: 'Cryptographic JSON Web Token generation, claims definition, expiration handling, signature verification, and security filters.',
    displayOrder: 4,
    maxAttainableLevel: 'VERIFIED',
  },
  'structured-exception-handling': {
    slug: 'structured-exception-handling',
    name: 'Structured Exception Handling',
    description: 'Global REST error handling using @ControllerAdvice, @ExceptionHandler methods, structured problem responses, and custom exception types.',
    displayOrder: 5,
    maxAttainableLevel: 'VERIFIED',
  },
  'unit-tests-meaningful-assertions': {
    slug: 'unit-tests-meaningful-assertions',
    name: 'Unit Tests with Meaningful Assertions',
    description: 'Non-trivial unit test suites using JUnit, AssertJ, Mockito, or MockMvc verifying observable behavior beyond trivial assertions.',
    displayOrder: 6,
    maxAttainableLevel: 'SUPPORTED', // No practical challenge verifies it; maximum is Supported
  },
  'transaction-management': {
    slug: 'transaction-management',
    name: 'Transaction Management',
    description: 'Declarative and programmatic database transaction demarcation with @Transactional or TransactionTemplate managing persistence operations.',
    displayOrder: 7,
    maxAttainableLevel: 'VERIFIED',
  },
  'input-validation': {
    slug: 'input-validation',
    name: 'Input Validation',
    description: 'Bean Validation constraint annotations on payload structures enforced through @Valid/@Validated parameters or explicit Validator execution.',
    displayOrder: 8,
    maxAttainableLevel: 'VERIFIED',
  },
};
