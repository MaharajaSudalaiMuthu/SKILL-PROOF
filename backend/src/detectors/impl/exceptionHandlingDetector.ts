import { DetectorFinding } from '@skillproof/shared';
import { ParsedJavaFile } from '../ast/javaAstHelper.js';
import { SymbolIndex } from '../ast/symbolIndex.js';

export function detectExceptionHandling(
  file: ParsedJavaFile,
  index: SymbolIndex
): DetectorFinding[] {
  const findings: DetectorFinding[] = [];

  for (const type of file.types) {
    if (type.kind !== 'class') continue;

    const hasAdvice = type.annotations.some(
      (a) => a.name === 'RestControllerAdvice' || a.name === 'ControllerAdvice'
    );
    if (!hasAdvice) continue;

    // Inspect @ExceptionHandler methods
    const handlerMethods = type.methods.filter((m) =>
      m.annotations.some((a) => a.name === 'ExceptionHandler')
    );

    if (handlerMethods.length < 2) {
      continue;
    }

    // Verify structured response return type
    let structuredHandlersCount = 0;
    const handledExceptions: string[] = [];

    for (const hm of handlerMethods) {
      const returnsStructured =
        hm.returnType.includes('ResponseEntity') ||
        hm.returnType.includes('ProblemDetail') ||
        hm.annotations.some((a) => a.name === 'ResponseStatus') ||
        hm.returnType !== 'void';

      if (returnsStructured) {
        structuredHandlersCount++;
      }

      // Record handled exception name
      const anno = hm.annotations.find((a) => a.name === 'ExceptionHandler');
      if (anno) {
        const match = anno.rawText.match(/ExceptionHandler\s*\(\s*([a-zA-Z0-9_.]+(?:\.class)?)/);
        if (match && match[1]) {
          handledExceptions.push(match[1].replace('.class', ''));
        }
      }
    }

    if (structuredHandlersCount < 2) {
      continue;
    }

    // Check custom exception declared in repository and thrown elsewhere
    const customExceptions = index.findCustomExceptions();
    let hasThrownCustomException = false;
    let matchingCustomExceptionName = '';

    for (const exc of customExceptions) {
      // Check if this custom exception is thrown anywhere in any other file (throw new or orElseThrow(() -> new ...))
      const throwRegex = new RegExp(`(?:throw\\s+new|->\\s*new)\\s+${exc.name}\\b`);
      for (const f of index.getAllFiles()) {
        if (f.filePath !== exc.filePath && throwRegex.test(f.rawContent)) {
          hasThrownCustomException = true;
          matchingCustomExceptionName = exc.name;
          break;
        }
      }
      if (hasThrownCustomException) break;
    }

    if (!hasThrownCustomException) {
      continue;
    }

    findings.push({
      skillSlug: 'structured-exception-handling',
      detectorName: 'structured-exception-handling',
      detectorVersion: '1.0.0',
      filePath: file.filePath,
      startLine: type.startLine,
      endLine: type.endLine,
      matchedPattern: `@RestControllerAdvice in ${type.name} with ${handlerMethods.length} handlers and custom exception ${matchingCustomExceptionName}`,
      keyAttributes: {
        className: type.name,
        handlerCount: handlerMethods.length,
        handledExceptions,
        customExceptionThrown: matchingCustomExceptionName,
      },
      whatThisShows:
        'Implements centralized REST exception handling with @ExceptionHandler methods returning structured bodies and custom thrown exceptions.',
      whatThisDoesNotProve: 'Does not prove all application error paths are handled or that internal stack traces are never exposed.',
    });
  }

  return findings;
}
