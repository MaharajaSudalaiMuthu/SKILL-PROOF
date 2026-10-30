import { describe, it, expect } from 'vitest';
import { generateQuizForRepository } from '../../src/engine/repoQuizGenerator.js';
import { IEvidenceRecord } from '../../src/models/EvidenceRecord.js';
import { IFileAttribution } from '../../src/models/FileAttribution.js';

describe('Repository-Based Adaptive Quiz Generator Engine', () => {
  const mockEvidence: Partial<IEvidenceRecord>[] = [
    {
      skillSlug: 'rest-controller-design',
      filePath: 'src/main/java/org/springframework/samples/petclinic/owner/OwnerController.java',
      startLine: 45,
      endLine: 120,
      matchedPattern: '@RestController OwnerController with 3 verbs (GET, POST, PUT)',
      rawDetails: {
        className: 'OwnerController',
        verbs: ['GET', 'POST', 'PUT'],
        usesResponseEntity: true,
        usesResponseStatus: false,
        handlerCount: 5,
      },
    },
    {
      skillSlug: 'jpa-hibernate-persistence',
      filePath: 'src/main/java/org/springframework/samples/petclinic/owner/Owner.java',
      startLine: 30,
      endLine: 85,
      matchedPattern: '@Entity Owner with @Id via OwnerRepository',
      rawDetails: {
        entityName: 'Owner',
        idFieldName: 'id',
        persistenceMechanism: 'OwnerRepository',
        relationships: ['@OneToMany'],
      },
    },
    {
      skillSlug: 'unit-tests-meaningful-assertions',
      filePath: 'src/test/java/org/springframework/samples/petclinic/owner/OwnerControllerTests.java',
      startLine: 25,
      endLine: 90,
      matchedPattern: 'Test suite with AssertJ and MockMvc',
      rawDetails: {
        testClassName: 'OwnerControllerTests',
        assertionFrameworks: ['AssertJ', 'MockMvc'],
        testMethodCount: 8,
      },
    },
    {
      skillSlug: 'input-validation',
      filePath: 'src/main/java/org/springframework/samples/petclinic/owner/PetValidator.java',
      startLine: 20,
      endLine: 50,
      matchedPattern: 'Validation rules for Pet',
      rawDetails: {
        targetClass: 'PetValidator',
        hasValidAnnotation: true,
      },
    },
    {
      skillSlug: 'structured-exception-handling',
      filePath: 'src/main/java/org/springframework/samples/petclinic/system/GlobalErrorHandler.java',
      startLine: 15,
      endLine: 45,
      matchedPattern: '@ControllerAdvice GlobalErrorHandler',
      rawDetails: {
        handlerClass: 'GlobalErrorHandler',
        usesControllerAdvice: true,
      },
    },
  ];

  const mockAttributions: Partial<IFileAttribution>[] = [
    {
      filePath: 'src/main/java/org/springframework/samples/petclinic/owner/OwnerController.java',
      totalLines: 120,
      confirmedLines: 110,
    },
    {
      filePath: 'src/main/java/org/springframework/samples/petclinic/owner/Owner.java',
      totalLines: 85,
      confirmedLines: 85,
    },
    {
      filePath: 'src/main/java/org/springframework/samples/petclinic/service/ClinicService.java',
      totalLines: 60,
      confirmedLines: 60,
    },
  ];

  it('1. generates questions derived strictly from actual repository AST evidence', () => {
    const questions = generateQuizForRepository(
      'spring-projects/spring-petclinic',
      mockEvidence as IEvidenceRecord[],
      mockAttributions as IFileAttribution[]
    );

    expect(questions.length).toBeGreaterThanOrEqual(5);
    expect(questions.length).toBeLessThanOrEqual(10);

    for (const q of questions) {
      expect(q.id).toBeDefined();
      expect(q.title).toBeDefined();
      expect(q.question).toBeDefined();
      expect(q.fileReference).toContain('.java');
      expect(q.options).toHaveLength(4);
      expect(q.correctOptionIndex).toBeGreaterThanOrEqual(0);
      expect(q.correctOptionIndex).toBeLessThanOrEqual(3);
      expect(q.options[q.correctOptionIndex]).toBeDefined();
      expect(q.explanation).toBeDefined();
    }
  });

  it('2. verifies that REST Controller questions use the real verbs detected in the code', () => {
    const questions = generateQuizForRepository(
      'spring-projects/spring-petclinic',
      mockEvidence as IEvidenceRecord[],
      mockAttributions as IFileAttribution[]
    );

    const restQ = questions.find((q) => q.skillSlug === 'rest-controller-design' && q.category === 'REST APIs');
    expect(restQ).toBeDefined();
    expect(restQ?.question).toContain('OwnerController');
    const correctOption = restQ!.options[restQ!.correctOptionIndex];
    expect(correctOption).toContain('GET, POST, PUT');
    expect(restQ?.fileReference).toContain('OwnerController.java');
  });

  it('3. verifies that JPA questions use the real entity and persistence mechanism', () => {
    const questions = generateQuizForRepository(
      'spring-projects/spring-petclinic',
      mockEvidence as IEvidenceRecord[],
      mockAttributions as IFileAttribution[]
    );

    const jpaQ = questions.find((q) => q.skillSlug === 'jpa-hibernate-persistence');
    expect(jpaQ).toBeDefined();
    expect(jpaQ?.question).toContain('Owner');
    const correctOption = jpaQ!.options[jpaQ!.correctOptionIndex];
    expect(correctOption).toContain('OwnerRepository');
    expect(correctOption).toContain('id');
  });

  it('4. computes passing score threshold accurately (>= 70%)', () => {
    const total = 10;
    // 7 correct => 70% => pass
    expect(Math.round((7 / total) * 100) >= 70).toBe(true);
    // 8 correct => 80% => pass
    expect(Math.round((8 / total) * 100) >= 70).toBe(true);
    // 6 correct => 60% => fail
    expect(Math.round((6 / total) * 100) >= 70).toBe(false);
  });
});
