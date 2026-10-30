import { parse } from 'java-parser';
import { logger } from '../../middleware/pinoLogger.js';

export interface ParsedAnnotation {
  name: string;
  rawText: string;
  startLine: number;
  endLine: number;
}

export interface ParsedParameter {
  name: string;
  type: string;
  annotations: ParsedAnnotation[];
  rawText: string;
}

export interface ParsedField {
  name: string;
  type: string;
  annotations: ParsedAnnotation[];
  startLine: number;
  endLine: number;
  rawText: string;
}

export interface ParsedMethod {
  name: string;
  returnType: string;
  parameters: ParsedParameter[];
  annotations: ParsedAnnotation[];
  bodyText: string;
  startLine: number;
  endLine: number;
  rawText: string;
}

export interface ParsedType {
  name: string;
  kind: 'class' | 'interface' | 'record' | 'enum' | 'annotation';
  packageName: string;
  annotations: ParsedAnnotation[];
  extendsTypes: string[];
  implementsTypes: string[];
  fields: ParsedField[];
  methods: ParsedMethod[];
  startLine: number;
  endLine: number;
  rawText: string;
}

export interface ParsedJavaFile {
  filePath: string;
  packageName: string;
  imports: string[];
  types: ParsedType[];
  rawContent: string;
  hasParseError: boolean;
  parseErrorMessage?: string;
}

/**
 * Extracts slice from source using node.location offsets
 */
function getNodeText(code: string, location?: { startOffset: number; endOffset: number }): string {
  if (!location) return '';
  return code.slice(location.startOffset, location.endOffset + 1);
}

/**
 * Parses annotations from modifier nodes (classModifier, methodModifier, etc.)
 */
function extractAnnotations(
  code: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  modifiers: any[] = []
): ParsedAnnotation[] {
  const annotations: ParsedAnnotation[] = [];
  for (const m of modifiers) {
    const text = getNodeText(code, m.location).trim();
    if (text.startsWith('@')) {
      const match = text.match(/^@([a-zA-Z0-9_.$]+)/);
      if (match && match[1]) {
        annotations.push({
          name: match[1],
          rawText: text,
          startLine: m.location?.startLine ?? 1,
          endLine: m.location?.endLine ?? 1,
        });
      }
    }
  }
  return annotations;
}

/**
 * Splits a type list (like "extends A<X, Y>, B") by comma only at the top level (ignoring commas inside <...> or (...)).
 */
function splitTopLevelComma(text: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '<' || ch === '(') depth++;
    else if (ch === '>' || ch === ')') depth--;
    else if (ch === ',' && depth === 0) {
      parts.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) {
    parts.push(current.trim());
  }
  return parts;
}

/**
 * Parses a single Java file source into structured AST model with line positions.
 */
export function parseJavaFile(filePath: string, source: string): ParsedJavaFile {
  try {
    const cst = parse(source);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ocu = (cst.children as any)?.ordinaryCompilationUnit?.[0];

    if (!ocu) {
      return {
        filePath,
        packageName: '',
        imports: [],
        types: [],
        rawContent: source,
        hasParseError: false,
      };
    }

    // 1. Package declaration
    let packageName = '';
    if (ocu.children.packageDeclaration?.[0]) {
      const rawPkg = getNodeText(source, ocu.children.packageDeclaration[0].location);
      const match = rawPkg.match(/package\s+([a-zA-Z0-9_.]+)\s*;/);
      if (match && match[1]) {
        packageName = match[1];
      }
    }

    // 2. Import declarations
    const imports: string[] = [];
    if (ocu.children.importDeclaration) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const imp of ocu.children.importDeclaration) {
        const rawImp = getNodeText(source, imp.location);
        const match = rawImp.match(/import\s+(?:static\s+)?([a-zA-Z0-9_.*]+)\s*;/);
        if (match && match[1]) {
          imports.push(match[1]);
        }
      }
    }

    // 3. Types (Classes, Interfaces, Records, Enums)
    const types: ParsedType[] = [];
    const typeDecls = ocu.children.typeDeclaration || [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const td of typeDecls) {
      // 3.1 Class
      if (td.children?.classDeclaration?.[0]) {
        const cd = td.children.classDeclaration[0];
        const ncd = cd.children?.normalClassDeclaration?.[0];
        if (ncd) {
          const typeName = getNodeText(source, ncd.children?.typeIdentifier?.[0]?.location).trim();
          const annotations = extractAnnotations(source, cd.children?.classModifier);

          // Superclass
          const extendsTypes: string[] = [];
          if (ncd.children?.superclass?.[0]) {
            const rawSuper = getNodeText(source, ncd.children.superclass[0].location).replace(/^extends\s+/, '').trim();
            if (rawSuper) extendsTypes.push(rawSuper);
          }

          // Interfaces
          const implementsTypes: string[] = [];
          if (ncd.children?.superinterfaces?.[0]) {
            const rawIfaces = getNodeText(source, ncd.children.superinterfaces[0].location).replace(/^implements\s+/, '');
            implementsTypes.push(...splitTopLevelComma(rawIfaces));
          }

          // Body declarations (fields and methods)
          const fields: ParsedField[] = [];
          const methods: ParsedMethod[] = [];
          const bodyDecls = ncd.children?.classBody?.[0]?.children?.classBodyDeclaration || [];

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          for (const bd of bodyDecls) {
            const cmd = bd.children?.classMemberDeclaration?.[0];
            if (!cmd) continue;

            // Methods
            if (cmd.children?.methodDeclaration?.[0]) {
              const md = cmd.children.methodDeclaration[0];
              const mh = md.children?.methodHeader?.[0];
              const mDeclarator = mh?.children?.methodDeclarator?.[0];

              const methodName = mDeclarator?.children?.Identifier?.[0]?.image ??
                getNodeText(source, mDeclarator?.children?.typeIdentifier?.[0]?.location).trim() ??
                '';

              const returnType = mh?.children?.result?.[0] ? getNodeText(source, mh.children.result[0].location).trim() : 'void';
              const mAnnotations = extractAnnotations(source, md.children?.methodModifier);
              const bodyText = md.children?.methodBody?.[0] ? getNodeText(source, md.children.methodBody[0].location) : '';
              const rawMethodText = getNodeText(source, md.location);

              // Parameters
              const parameters: ParsedParameter[] = [];
              const rawParams = mDeclarator ? getNodeText(source, mDeclarator.location) : '';
              const paramRegex = /(?:@(?:[a-zA-Z0-9_.$]+)(?:\([^)]*\))?\s+)*([a-zA-Z0-9_<>[\],.?\s]+)\s+([a-zA-Z0-9_]+)(?:,|$)/g;
              // Extract parameters inside parens
              const parenMatch = rawParams.match(/\((.*)\)/s);
              if (parenMatch && parenMatch[1]?.trim()) {
                const paramListStr = parenMatch[1];
                let pMatch;
                while ((pMatch = paramRegex.exec(paramListStr)) !== null) {
                  if (pMatch[1] && pMatch[2]) {
                    const pFull = pMatch[0];
                    const pAnnotations: ParsedAnnotation[] = [];
                    const pAnnoMatches = pFull.matchAll(/@([a-zA-Z0-9_.$]+)/g);
                    for (const pa of pAnnoMatches) {
                      if (pa[1]) {
                        pAnnotations.push({
                          name: pa[1],
                          rawText: pa[0],
                          startLine: md.location?.startLine ?? 1,
                          endLine: md.location?.endLine ?? 1,
                        });
                      }
                    }
                    parameters.push({
                      type: pMatch[1].trim(),
                      name: pMatch[2].trim(),
                      annotations: pAnnotations,
                      rawText: pMatch[0].trim(),
                    });
                  }
                }
              }

              methods.push({
                name: methodName,
                returnType,
                parameters,
                annotations: mAnnotations,
                bodyText,
                startLine: md.location?.startLine ?? 1,
                endLine: md.location?.endLine ?? 1,
                rawText: rawMethodText,
              });
            }

            // Fields
            if (cmd.children?.fieldDeclaration?.[0]) {
              const fd = cmd.children.fieldDeclaration[0];
              const fAnnotations = extractAnnotations(source, fd.children?.fieldModifier);
              const fType = fd.children?.unannType?.[0] ? getNodeText(source, fd.children.unannType[0].location).trim() : '';
              const fDeclarators = fd.children?.variableDeclaratorList?.[0] ? getNodeText(source, fd.children.variableDeclaratorList[0].location).trim() : '';
              const fName = fDeclarators.split('=')[0]?.trim() ?? '';

              fields.push({
                name: fName,
                type: fType,
                annotations: fAnnotations,
                startLine: fd.location?.startLine ?? 1,
                endLine: fd.location?.endLine ?? 1,
                rawText: getNodeText(source, fd.location),
              });
            }
          }

          types.push({
            name: typeName,
            kind: 'class',
            packageName,
            annotations,
            extendsTypes,
            implementsTypes,
            fields,
            methods,
            startLine: cd.location?.startLine ?? 1,
            endLine: cd.location?.endLine ?? 1,
            rawText: getNodeText(source, cd.location),
          });
        }
      }

      // 3.2 Interface
      if (td.children?.interfaceDeclaration?.[0]) {
        const id = td.children.interfaceDeclaration[0];
        const nid = id.children?.normalInterfaceDeclaration?.[0];
        if (nid) {
          const typeName = getNodeText(source, nid.children?.typeIdentifier?.[0]?.location).trim();
          const annotations = extractAnnotations(source, id.children?.interfaceModifier);

          const extendsTypes: string[] = [];
          const extNode = nid.children?.interfaceExtends?.[0] || nid.children?.extendsInterfaces?.[0];
          if (extNode) {
            const rawExt = getNodeText(source, extNode.location).replace(/^extends\s+/, '');
            extendsTypes.push(...splitTopLevelComma(rawExt));
          }

          types.push({
            name: typeName,
            kind: 'interface',
            packageName,
            annotations,
            extendsTypes,
            implementsTypes: [],
            fields: [],
            methods: [],
            startLine: id.location?.startLine ?? 1,
            endLine: id.location?.endLine ?? 1,
            rawText: getNodeText(source, id.location),
          });
        }
      }

      // 3.3 Record (Java 16+)
      if (td.children?.recordDeclaration?.[0]) {
        const rd = td.children.recordDeclaration[0];
        const typeName = getNodeText(source, rd.children?.typeIdentifier?.[0]?.location).trim();
        const annotations = extractAnnotations(source, rd.children?.classModifier);

        // Record components as fields
        const fields: ParsedField[] = [];
        if (rd.children?.recordHeader?.[0]) {
          const rawHeader = getNodeText(source, rd.children.recordHeader[0].location);
          const componentRegex = /(@[a-zA-Z0-9_.$]+(?:\([^)]*\))?\s+)*([a-zA-Z0-9_<>[\],.?]+)\s+([a-zA-Z0-9_]+)(?:,|$)/g;
          let cMatch;
          while ((cMatch = componentRegex.exec(rawHeader)) !== null) {
            if (cMatch[2] && cMatch[3]) {
              const cAnnos: ParsedAnnotation[] = [];
              const annoMatches = cMatch[0].matchAll(/@([a-zA-Z0-9_.$]+)/g);
              for (const a of annoMatches) {
                if (a[1]) {
                  cAnnos.push({
                    name: a[1],
                    rawText: a[0],
                    startLine: rd.location?.startLine ?? 1,
                    endLine: rd.location?.endLine ?? 1,
                  });
                }
              }
              fields.push({
                name: cMatch[3].trim(),
                type: cMatch[2].trim(),
                annotations: cAnnos,
                startLine: rd.location?.startLine ?? 1,
                endLine: rd.location?.endLine ?? 1,
                rawText: cMatch[0].trim(),
              });
            }
          }
        }

        types.push({
          name: typeName,
          kind: 'record',
          packageName,
          annotations,
          extendsTypes: [],
          implementsTypes: [],
          fields,
          methods: [],
          startLine: rd.location?.startLine ?? 1,
          endLine: rd.location?.endLine ?? 1,
          rawText: getNodeText(source, rd.location),
        });
      }
    }

    return {
      filePath,
      packageName,
      imports,
      types,
      rawContent: source,
      hasParseError: false,
    };
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    logger.warn({ filePath, errorMsg }, 'Java parse error encountered; file skipped safely without failing analysis.');
    return {
      filePath,
      packageName: '',
      imports: [],
      types: [],
      rawContent: source,
      hasParseError: true,
      parseErrorMessage: errorMsg,
    };
  }
}
