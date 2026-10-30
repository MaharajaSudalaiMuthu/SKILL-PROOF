import { DetectorFinding } from '@skillproof/shared';
import { ParsedJavaFile } from '../ast/javaAstHelper.js';
import { SymbolIndex } from '../ast/symbolIndex.js';

export function detectJpaHibernate(
  file: ParsedJavaFile,
  index: SymbolIndex
): DetectorFinding[] {
  const findings: DetectorFinding[] = [];

  for (const type of file.types) {
    if (type.kind !== 'class') continue;

    // 1. Check for @Entity
    const hasEntity = type.annotations.some(
      (a) => a.name === 'Entity' || a.name === 'jakarta.persistence.Entity' || a.name === 'javax.persistence.Entity'
    );
    if (!hasEntity) continue;

    // 2. Check for @Id on at least one field
    const idField = type.fields.find((f) =>
      f.annotations.some((a) => a.name === 'Id' || a.name.endsWith('.Id'))
    );
    if (!idField) continue;

    // 3. Inspect relationships and fetch types
    const relationships: string[] = [];
    const fetchTypes: string[] = [];
    for (const f of type.fields) {
      for (const a of f.annotations) {
        if (['OneToMany', 'ManyToOne', 'ManyToMany', 'OneToOne'].includes(a.name)) {
          relationships.push(a.name);
          if (a.rawText.includes('LAZY')) fetchTypes.push('LAZY');
          if (a.rawText.includes('EAGER')) fetchTypes.push('EAGER');
        }
      }
    }

    // 4. Check for parameterized Spring Data Repository OR EntityManager usage
    const repositories = index.findSpringDataRepositories();
    let matchingRepoName: string | null = null;
    let hasCustomQuery = false;

    for (const repo of repositories) {
      const extendsMatches = repo.parsedType.extendsTypes.some(
        (ext) =>
          ext.includes(`<${type.name},`) ||
          ext.includes(`<${type.name} `) ||
          ext.includes(`<${file.packageName}.${type.name},`)
      );
      if (extendsMatches) {
        matchingRepoName = repo.name;
        // Check for @Query in repository interface
        hasCustomQuery = repo.file.rawContent.includes('@Query');
        break;
      }
    }

    // Check for EntityManager usage on this entity anywhere in the codebase
    let hasEntityManagerUsage = false;
    if (!matchingRepoName) {
      for (const f of index.getAllFiles()) {
        const content = f.rawContent;
        if (
          content.includes('EntityManager') &&
          (content.includes(`.find(${type.name}.class`) ||
            content.includes(`.persist(`) ||
            content.includes(`.merge(`) ||
            content.includes(`from ${type.name}`))
        ) {
          hasEntityManagerUsage = true;
          matchingRepoName = 'EntityManager';
          break;
        }
      }
    }

    // Qualifying criteria: @Entity with @Id AND (matching Repository OR EntityManager)
    if (matchingRepoName || hasEntityManagerUsage) {
      findings.push({
        skillSlug: 'jpa-hibernate-persistence',
        detectorName: 'jpa-hibernate-persistence',
        detectorVersion: '1.0.0',
        filePath: file.filePath,
        startLine: type.startLine,
        endLine: type.endLine,
        matchedPattern: `@Entity ${type.name} with @Id and persistence via ${matchingRepoName}`,
        keyAttributes: {
          entityName: type.name,
          idFieldName: idField.name,
          persistenceMechanism: matchingRepoName,
          relationships,
          fetchTypes,
          hasCustomQuery,
        },
        whatThisShows:
          'Implements JPA entity persistence mapping with primary key @Id and parameterized Spring Data repository or EntityManager.',
        whatThisDoesNotProve: 'Does not prove correct cascade/fetch strategies, N+1 query avoidance, or performance.',
      });
    }
  }

  return findings;
}
