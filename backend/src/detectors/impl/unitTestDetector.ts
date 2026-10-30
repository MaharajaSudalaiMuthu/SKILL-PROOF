import { DetectorFinding } from '@skillproof/shared';
import { ParsedJavaFile } from '../ast/javaAstHelper.js';
import { SymbolIndex } from '../ast/symbolIndex.js';

export function detectUnitTest(
  file: ParsedJavaFile,
  _index: SymbolIndex
): DetectorFinding[] {
  const findings: DetectorFinding[] = [];

  for (const type of file.types) {
    if (type.kind !== 'class') continue;

    const testMethods = type.methods.filter((m) => {
      const isTest = m.annotations.some(
        (a) => a.name === 'Test' || a.name === 'ParameterizedTest' || a.name === 'RepeatedTest'
      );
      const isDisabled = m.annotations.some((a) => a.name === 'Disabled' || a.name === 'Ignore');
      return isTest && !isDisabled;
    });

    if (testMethods.length < 3) {
      continue;
    }

    let qualifiedTestMethodsCount = 0;
    let totalAssertions = 0;
    let hasMocks = false;

    // Check for mocks at class level
    if (
      type.rawText.includes('@Mock') ||
      type.rawText.includes('@MockBean') ||
      type.rawText.includes('Mockito.mock(') ||
      type.rawText.includes('mock(')
    ) {
      hasMocks = true;
    }

    for (const tm of testMethods) {
      const body = tm.bodyText;
      let methodAssertionCount = 0;

      // Match common non-trivial assertion patterns
      const assertionMatches = [
        ...body.matchAll(/assertEquals\s*\(/g),
        ...body.matchAll(/assertNotEquals\s*\(/g),
        ...body.matchAll(/assertThat\s*\(/g),
        ...body.matchAll(/assertThrows\s*\(/g),
        ...body.matchAll(/verify\s*\(/g),
        ...body.matchAll(/\.andExpect\s*\(/g),
      ];

      methodAssertionCount += assertionMatches.length;

      // Handle assertTrue / assertFalse: exclude assertTrue(true) and assertFalse(false)
      const trueMatches = [...body.matchAll(/assertTrue\s*\(([^)]+)\)/g)];
      for (const tmMatch of trueMatches) {
        const expr = tmMatch[1]?.trim();
        if (expr && expr !== 'true' && expr !== 'Boolean.TRUE') {
          methodAssertionCount++;
        }
      }

      // Handle assertNotNull: exclude assertNotNull(new ...) on freshly constructed objects
      const notNullMatches = [...body.matchAll(/assertNotNull\s*\(([^)]+)\)/g)];
      for (const nnMatch of notNullMatches) {
        const expr = nnMatch[1]?.trim();
        if (expr && !expr.startsWith('new ')) {
          methodAssertionCount++;
        }
      }

      if (methodAssertionCount >= 1) {
        qualifiedTestMethodsCount++;
        totalAssertions += methodAssertionCount;
      }
    }

    // Qualifying criteria: >= 3 test methods each with non-trivial assertion
    if (qualifiedTestMethodsCount >= 3) {
      findings.push({
        skillSlug: 'unit-tests-meaningful-assertions',
        detectorName: 'unit-tests-meaningful-assertions',
        detectorVersion: '1.0.0',
        filePath: file.filePath,
        startLine: type.startLine,
        endLine: type.endLine,
        matchedPattern: `Test class ${type.name} with ${qualifiedTestMethodsCount} verified test methods and ${totalAssertions} assertions`,
        keyAttributes: {
          testClassName: type.name,
          testMethodsCount: testMethods.length,
          qualifiedTestMethodsCount,
          totalAssertions,
          hasMocks,
        },
        whatThisShows:
          'Contains unit test methods with non-trivial assertions validating non-test code execution and outputs.',
        whatThisDoesNotProve: 'Does not prove test coverage, boundary condition verification, or production behavior.',
      });
    }
  }

  return findings;
}
