import { DetectorFinding } from '@skillproof/shared';
import { ParsedJavaFile } from '../ast/javaAstHelper.js';
import { SymbolIndex } from '../ast/symbolIndex.js';

const BEAN_VALIDATION_CONSTRAINTS = new Set([
  'NotNull',
  'NotBlank',
  'NotEmpty',
  'Size',
  'Min',
  'Max',
  'Email',
  'Pattern',
  'Positive',
  'PositiveOrZero',
  'Negative',
  'NegativeOrZero',
  'Past',
  'PastOrPresent',
  'Future',
  'FutureOrPresent',
  'Digits',
  'DecimalMin',
  'DecimalMax',
]);

export function detectInputValidation(
  file: ParsedJavaFile,
  index: SymbolIndex
): DetectorFinding[] {
  const findings: DetectorFinding[] = [];

  for (const type of file.types) {
    if (type.kind !== 'class' && type.kind !== 'record') continue;

    // 1. Identify Bean Validation constraints on fields or record components
    const constraintsFound: string[] = [];
    for (const f of type.fields) {
      for (const a of f.annotations) {
        if (BEAN_VALIDATION_CONSTRAINTS.has(a.name)) {
          constraintsFound.push(a.name);
        }
      }
    }

    if (constraintsFound.length === 0) {
      continue;
    }

    // 2. Check enforcement: Is this type used as a @Valid or @Validated parameter anywhere in the repo?
    // OR is validator.validate(...) called on it?
    let isEnforced = false;
    let enforcementLocation = '';

    for (const f of index.getAllFiles()) {
      for (const t of f.types) {
        for (const m of t.methods) {
          // Check method parameters for @Valid / @Validated with matching type
          for (const p of m.parameters) {
            const hasValidAnno = p.annotations.some((a) => a.name === 'Valid' || a.name === 'Validated');
            if (hasValidAnno && (p.type === type.name || p.type.endsWith(`.${type.name}`))) {
              isEnforced = true;
              enforcementLocation = `${t.name}.${m.name}(@Valid ${p.name})`;
              break;
            }
          }
          if (isEnforced) break;

          // Check programmatic validator.validate(...)
          if (m.bodyText.includes(`.validate(`) && m.bodyText.includes(type.name)) {
            isEnforced = true;
            enforcementLocation = `${t.name}.${m.name} -> validator.validate()`;
            break;
          }
        }
        if (isEnforced) break;
      }
      if (isEnforced) break;
    }

    if (!isEnforced) {
      continue;
    }

    // Check if error handling exists (e.g. BindingResult or MethodArgumentNotValidException)
    let handlesValidationErrors = false;
    for (const f of index.getAllFiles()) {
      if (
        f.rawContent.includes('MethodArgumentNotValidException') ||
        f.rawContent.includes('ConstraintViolationException') ||
        f.rawContent.includes('BindingResult')
      ) {
        handlesValidationErrors = true;
        break;
      }
    }

    findings.push({
      skillSlug: 'input-validation',
      detectorName: 'input-validation',
      detectorVersion: '1.0.0',
      filePath: file.filePath,
      startLine: type.startLine,
      endLine: type.endLine,
      matchedPattern: `Validation model ${type.name} with constraints [${Array.from(new Set(constraintsFound)).join(
        ', '
      )}] enforced at ${enforcementLocation}`,
      keyAttributes: {
        className: type.name,
        constraints: Array.from(new Set(constraintsFound)),
        enforcedAt: enforcementLocation,
        handlesValidationErrors,
      },
      whatThisShows:
        'Declares Bean Validation constraint annotations on data fields and enforces validation via @Valid or Validator.',
      whatThisDoesNotProve: 'Does not prove validation coverage is complete or covers all malicious payloads and edge cases.',
    });
  }

  return findings;
}
