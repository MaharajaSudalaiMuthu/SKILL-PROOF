import { DetectorFinding } from '@skillproof/shared';
import { ParsedJavaFile } from '../ast/javaAstHelper.js';
import { SymbolIndex } from '../ast/symbolIndex.js';

const HTTP_VERB_ANNOTATIONS: Record<string, string> = {
  GetMapping: 'GET',
  PostMapping: 'POST',
  PutMapping: 'PUT',
  DeleteMapping: 'DELETE',
  PatchMapping: 'PATCH',
};

export function detectRestController(
  file: ParsedJavaFile,
  _index: SymbolIndex
): DetectorFinding[] {
  const findings: DetectorFinding[] = [];

  for (const type of file.types) {
    if (type.kind !== 'class') continue;

    // 1. Check for @RestController or @Controller + @ResponseBody
    const hasRestController = type.annotations.some((a) => a.name === 'RestController');
    const hasController = type.annotations.some((a) => a.name === 'Controller');
    const hasResponseBody =
      type.annotations.some((a) => a.name === 'ResponseBody') ||
      type.methods.some((m) => m.annotations.some((a) => a.name === 'ResponseBody'));

    if (!hasRestController && !(hasController && hasResponseBody)) {
      continue;
    }

    // 2. Inspect handler methods
    const verbsFound = new Set<string>();
    let hasInputBinding = false;
    let hasNonVoidReturn = false;
    let usesResponseEntity = false;
    let usesResponseStatus = false;

    for (const method of type.methods) {
      // Check HTTP verb mappings
      let methodVerb: string | null = null;
      for (const a of method.annotations) {
        if (HTTP_VERB_ANNOTATIONS[a.name]) {
          methodVerb = HTTP_VERB_ANNOTATIONS[a.name] ?? null;
        } else if (a.name === 'RequestMapping') {
          if (a.rawText.includes('RequestMethod.POST')) methodVerb = 'POST';
          else if (a.rawText.includes('RequestMethod.PUT')) methodVerb = 'PUT';
          else if (a.rawText.includes('RequestMethod.DELETE')) methodVerb = 'DELETE';
          else if (a.rawText.includes('RequestMethod.PATCH')) methodVerb = 'PATCH';
          else methodVerb = 'GET';
        }

        if (a.name === 'ResponseStatus') {
          usesResponseStatus = true;
        }
      }

      if (methodVerb) {
        verbsFound.add(methodVerb);

        // Check non-void return
        if (method.returnType && method.returnType !== 'void') {
          hasNonVoidReturn = true;
        }
        if (method.returnType.includes('ResponseEntity')) {
          usesResponseEntity = true;
        }

        // Check input binding
        for (const param of method.parameters) {
          const bindsInput = param.annotations.some(
            (pa) => pa.name === 'PathVariable' || pa.name === 'RequestParam' || pa.name === 'RequestBody'
          );
          if (bindsInput) {
            hasInputBinding = true;
          }
        }
      }
    }

    // Qualifying criteria: >= 2 different HTTP verbs, input binding, non-void return
    if (verbsFound.size >= 2 && hasInputBinding && hasNonVoidReturn) {
      findings.push({
        skillSlug: 'rest-controller-design',
        detectorName: 'rest-controller-design',
        detectorVersion: '1.0.0',
        filePath: file.filePath,
        startLine: type.startLine,
        endLine: type.endLine,
        matchedPattern: `@RestController ${type.name} with ${verbsFound.size} verbs (${Array.from(verbsFound).join(
          ', '
        )}) and input binding`,
        keyAttributes: {
          className: type.name,
          verbs: Array.from(verbsFound),
          usesResponseEntity,
          usesResponseStatus,
          handlerCount: type.methods.length,
        },
        whatThisShows:
          'Implements a Spring REST controller with varied HTTP verbs, request input binding, and non-void return payloads.',
        whatThisDoesNotProve: 'Does not prove API design quality, REST maturity level, or error handling robustness.',
      });
    }
  }

  return findings;
}
