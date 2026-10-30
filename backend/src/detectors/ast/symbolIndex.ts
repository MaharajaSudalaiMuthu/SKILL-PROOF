import { ParsedJavaFile, ParsedType } from './javaAstHelper.js';

export interface DeclaredSymbol {
  name: string;
  packageName: string;
  fqcn: string;
  kind: 'class' | 'interface' | 'record' | 'enum' | 'annotation';
  filePath: string;
  parsedType: ParsedType;
  file: ParsedJavaFile;
}

export class SymbolIndex {
  private symbolsByFqcn = new Map<string, DeclaredSymbol>();
  private symbolsByName = new Map<string, DeclaredSymbol[]>();
  private files: ParsedJavaFile[] = [];

  constructor(files: ParsedJavaFile[]) {
    this.files = files;
    this.buildIndex();
  }

  private buildIndex(): void {
    for (const file of this.files) {
      if (file.hasParseError) continue;

      for (const type of file.types) {
        const fqcn = file.packageName ? `${file.packageName}.${type.name}` : type.name;
        const symbol: DeclaredSymbol = {
          name: type.name,
          packageName: file.packageName,
          fqcn,
          kind: type.kind,
          filePath: file.filePath,
          parsedType: type,
          file,
        };

        this.symbolsByFqcn.set(fqcn, symbol);

        const existing = this.symbolsByName.get(type.name) ?? [];
        existing.push(symbol);
        this.symbolsByName.set(type.name, existing);
      }
    }
  }

  /**
   * Resolves a type name referenced in a file to its declared symbol in the repository.
   */
  resolveType(name: string, fromFile: ParsedJavaFile): DeclaredSymbol | null {
    // 1. Direct FQCN match
    if (name.includes('.')) {
      return this.symbolsByFqcn.get(name) ?? null;
    }

    // 2. Exact import match (e.g. import com.example.model.User;)
    for (const imp of fromFile.imports) {
      if (imp.endsWith(`.${name}`)) {
        const match = this.symbolsByFqcn.get(imp);
        if (match) return match;
      }
    }

    // 3. Same-package resolution
    if (fromFile.packageName) {
      const samePkgFqcn = `${fromFile.packageName}.${name}`;
      const match = this.symbolsByFqcn.get(samePkgFqcn);
      if (match) return match;
    }

    // 4. Wildcard import resolution (e.g. import com.example.model.*;)
    for (const imp of fromFile.imports) {
      if (imp.endsWith('.*')) {
        const pkg = imp.slice(0, -2);
        const wildcardFqcn = `${pkg}.${name}`;
        const match = this.symbolsByFqcn.get(wildcardFqcn);
        if (match) return match;
      }
    }

    // 5. Unambiguous repository-wide single candidate match
    const candidates = this.symbolsByName.get(name) ?? [];
    if (candidates.length === 1 && candidates[0]) {
      return candidates[0];
    }

    return null;
  }

  /**
   * Returns all files indexed.
   */
  getAllFiles(): ParsedJavaFile[] {
    return this.files;
  }

  /**
   * Returns all JPA @Entity types declared in repository.
   */
  findEntities(): DeclaredSymbol[] {
    const entities: DeclaredSymbol[] = [];
    for (const sym of this.symbolsByFqcn.values()) {
      const hasEntity = sym.parsedType.annotations.some(
        (a) => a.name === 'Entity' || a.name === 'jakarta.persistence.Entity' || a.name === 'javax.persistence.Entity'
      );
      if (hasEntity) {
        entities.push(sym);
      }
    }
    return entities;
  }

  /**
   * Returns all Spring Data repositories.
   */
  findSpringDataRepositories(): DeclaredSymbol[] {
    const repos: DeclaredSymbol[] = [];
    const repoKeywords = ['Repository', 'JpaRepository', 'CrudRepository', 'PagingAndSortingRepository'];

    for (const sym of this.symbolsByFqcn.values()) {
      if (sym.kind === 'interface') {
        const extendsRepo = sym.parsedType.extendsTypes.some((ext) =>
          repoKeywords.some((kw) => ext.includes(kw))
        );
        if (extendsRepo) {
          repos.push(sym);
        }
      }
    }
    return repos;
  }

  /**
   * Returns all custom exception types declared in the repository.
   */
  findCustomExceptions(): DeclaredSymbol[] {
    const exceptions: DeclaredSymbol[] = [];
    const exceptionKeywords = ['Exception', 'RuntimeException', 'Throwable', 'Error'];

    for (const sym of this.symbolsByFqcn.values()) {
      const isException = sym.parsedType.extendsTypes.some((ext) =>
        exceptionKeywords.some((kw) => ext.includes(kw))
      );
      if (isException || sym.name.endsWith('Exception')) {
        exceptions.push(sym);
      }
    }
    return exceptions;
  }
}
