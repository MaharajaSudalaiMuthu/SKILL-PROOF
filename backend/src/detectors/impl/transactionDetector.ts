import { DetectorFinding } from '@skillproof/shared';
import { ParsedJavaFile } from '../ast/javaAstHelper.js';
import { SymbolIndex } from '../ast/symbolIndex.js';

export function detectTransaction(
  file: ParsedJavaFile,
  _index: SymbolIndex
): DetectorFinding[] {
  const findings: DetectorFinding[] = [];

  for (const type of file.types) {
    if (type.kind !== 'class') continue;

    // Must be a NON-controller class
    const isController = type.annotations.some(
      (a) => a.name === 'RestController' || a.name === 'Controller'
    );
    if (isController) continue;

    const hasClassTransactional = type.annotations.some((a) => a.name === 'Transactional');
    const classAnno = type.annotations.find((a) => a.name === 'Transactional');

    // Persistence write keywords
    const writeKeywords = [
      '.save(',
      '.saveAll(',
      '.delete(',
      '.deleteById(',
      '.deleteAll(',
      '.persist(',
      '.merge(',
      '.executeUpdate(',
    ];

    // Read/persistence operations
    const allPersistenceOps = [
      ...writeKeywords,
      '.find(',
      '.findById(',
      '.findAll(',
      '.createQuery(',
      '.getOne(',
      '.getReferenceById(',
    ];

    for (const method of type.methods) {
      const hasMethodTransactional = method.annotations.some((a) => a.name === 'Transactional');
      const isTransactional = hasClassTransactional || hasMethodTransactional;
      const methodAnno = method.annotations.find((a) => a.name === 'Transactional') || classAnno;

      const usesTemplate = method.bodyText.includes('TransactionTemplate') && method.bodyText.includes('.execute(');

      if (!isTransactional && !usesTemplate) {
        continue;
      }

      // Check for persistence writes or >= 2 persistence ops
      const body = method.bodyText;
      const hasWrite = writeKeywords.some((kw) => body.includes(kw));
      const opCount = allPersistenceOps.filter((kw) => body.includes(kw)).length;

      if (hasWrite || opCount >= 2 || usesTemplate) {
        // Record key attributes
        const annoText = methodAnno?.rawText ?? '';
        const isReadOnly = annoText.includes('readOnly = true');
        const propagationMatch = annoText.match(/propagation\s*=\s*Propagation\.([A-Z_]+)/);
        const isolationMatch = annoText.match(/isolation\s*=\s*Isolation\.([A-Z_]+)/);
        const rollbackMatch = annoText.match(/rollbackFor\s*=\s*([A-Za-z0-9_.]+(?:\.class)?)/);

        findings.push({
          skillSlug: 'transaction-management',
          detectorName: 'transaction-management',
          detectorVersion: '1.0.0',
          filePath: file.filePath,
          startLine: method.startLine,
          endLine: method.endLine,
          matchedPattern: `@Transactional method ${type.name}.${method.name} with database persistence operations`,
          keyAttributes: {
            className: type.name,
            methodName: method.name,
            hasWrite,
            opCount,
            readOnly: isReadOnly,
            propagation: propagationMatch ? propagationMatch[1] : 'REQUIRED',
            isolation: isolationMatch ? isolationMatch[1] : 'DEFAULT',
            rollbackFor: rollbackMatch ? rollbackMatch[1] : null,
            usesTemplate,
          },
          whatThisShows:
            'Applies explicit transaction boundaries around database persistence mutations or multi-step operations.',
          whatThisDoesNotProve: 'Does not prove correct transaction boundaries or concurrency isolation under high load.',
        });
      }
    }
  }

  return findings;
}
