import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { logger } from '../middleware/pinoLogger.js';

export interface ProjectScanResult {
  primaryLanguage: string;
  languages: string[];
  frameworks: string[];
  allFiles: string[];
  sourceFiles: string[];
  testFiles: string[];
  configFiles: string[];
  totalFiles: number;
  totalLines: number;
  languageBreakdown: Record<string, number>;
}

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'build',
  'dist',
  'target',
  '.gradle',
  '.mvn',
  'vendor',
  'bin',
  'out',
  '__pycache__',
  '.pytest_cache',
  '.venv',
  'venv',
  'env',
  '.next',
  '.nuxt',
  'coverage',
  '.idea',
  '.vscode',
  '.settings',
  '.turbo',
  '.svn',
  '.hg',
]);

const EXCLUDED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.webp',
  '.woff', '.woff2', '.ttf', '.eot',
  '.zip', '.tar', '.gz', '.tgz', '.jar', '.war', '.class',
  '.pyc', '.pyo', '.exe', '.dll', '.so', '.dylib',
  '.pdf', '.mp4', '.mp3', '.wav', '.db', '.sqlite', '.sqlite3',
  '.map',
]);

const EXCLUDED_FILENAMES = new Set([
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'cargo.lock',
  'poetry.lock',
]);

const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  '.ts': 'TypeScript',
  '.tsx': 'TypeScript',
  '.js': 'JavaScript',
  '.jsx': 'JavaScript',
  '.mjs': 'JavaScript',
  '.cjs': 'JavaScript',
  '.py': 'Python',
  '.java': 'Java',
  '.go': 'Go',
  '.rs': 'Rust',
  '.rb': 'Ruby',
  '.php': 'PHP',
  '.cs': 'C#',
  '.cpp': 'C++',
  '.c': 'C',
  '.h': 'C/C++ Header',
  '.hpp': 'C++ Header',
  '.kt': 'Kotlin',
  '.kts': 'Kotlin',
  '.scala': 'Scala',
  '.swift': 'Swift',
  '.sql': 'SQL',
  '.html': 'HTML',
  '.css': 'CSS',
  '.scss': 'SCSS',
  '.json': 'JSON',
  '.yaml': 'YAML',
  '.yml': 'YAML',
  '.toml': 'TOML',
  '.xml': 'XML',
  '.properties': 'Properties',
};

const SOURCE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.java', '.go', '.rs', '.rb', '.php',
  '.cs', '.cpp', '.c', '.cc', '.cxx', '.h', '.hpp', '.kt', '.kts',
  '.scala', '.swift', '.sql',
  '.html', '.htm', '.css', '.scss', '.sass', '.less', '.vue',
]);

export async function scanProjectWorkspace(workspacePath: string): Promise<ProjectScanResult> {
  // If top-level .zip archive exists (e.g. files (1).zip in user submission), unpack it
  try {
    const topEntries = await fs.promises.readdir(workspacePath);
    for (const entry of topEntries) {
      if (entry.toLowerCase().endsWith('.zip')) {
        const zipFullPath = path.join(workspacePath, entry);
        try {
          execFileSync('unzip', ['-o', '-q', zipFullPath, '-d', workspacePath]);
          logger.info({ entry, workspacePath }, 'Auto-unpacked embedded zip archive in workspace');
        } catch (unzipErr) {
          logger.warn({ zipFullPath, unzipErr }, 'Notice: Failed to auto-unpack zip in workspace');
        }
      }
    }
  } catch {}

  const allFiles: string[] = [];
  const sourceFiles: string[] = [];
  const testFiles: string[] = [];
  const configFiles: string[] = [];
  const languageLineCounts: Record<string, number> = {};
  let totalLines = 0;

  async function walk(currentDir: string): Promise<void> {
    let entries: fs.Dirent[] = [];
    try {
      entries = await fs.promises.readdir(currentDir, { withFileTypes: true });
    } catch (err) {
      logger.warn({ currentDir, err }, 'Failed to read directory during project scan');
      return;
    }

    for (const entry of entries) {
      const entryName = entry.name;
      if (entryName.startsWith('.') && entryName !== '.env.example') {
        if (entry.isDirectory()) continue;
      }

      const fullPath = path.join(currentDir, entryName);
      const relativePath = path.relative(workspacePath, fullPath).replace(/\\/g, '/');

      if (entry.isDirectory()) {
        if (!EXCLUDED_DIRS.has(entryName.toLowerCase())) {
          await walk(fullPath);
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entryName).toLowerCase();
        if (EXCLUDED_EXTENSIONS.has(ext) || EXCLUDED_FILENAMES.has(entryName.toLowerCase())) {
          continue;
        }

        allFiles.push(relativePath);

        // Classify test files
        const lowerRel = relativePath.toLowerCase();
        const isTest =
          lowerRel.includes('/test/') ||
          lowerRel.includes('/tests/') ||
          lowerRel.includes('/__tests__/') ||
          lowerRel.includes('.test.') ||
          lowerRel.includes('.spec.') ||
          entryName.endsWith('Test.java') ||
          entryName.endsWith('Tests.java') ||
          entryName.startsWith('test_') ||
          entryName.endsWith('_test.go');

        if (isTest) {
          testFiles.push(relativePath);
        }

        // Config & manifest files
        if (
          entryName === 'package.json' ||
          entryName === 'pom.xml' ||
          entryName === 'build.gradle' ||
          entryName === 'requirements.txt' ||
          entryName === 'pyproject.toml' ||
          entryName === 'go.mod' ||
          entryName === 'Cargo.toml' ||
          entryName === 'tsconfig.json' ||
          entryName === 'schema.prisma' ||
          entryName.endsWith('.properties') ||
          entryName.endsWith('.yml') ||
          entryName.endsWith('.yaml')
        ) {
          configFiles.push(relativePath);
        }

        // Count lines and map language
        if (SOURCE_EXTENSIONS.has(ext)) {
          sourceFiles.push(relativePath);

          try {
            const stat = await fs.promises.stat(fullPath);
            if (stat.size < 5 * 1024 * 1024) { // Under 5MB
              const content = await fs.promises.readFile(fullPath, 'utf8');
              const lines = content.split('\n').length;
              totalLines += lines;
              const lang = EXTENSION_LANGUAGE_MAP[ext] || 'Other';
              languageLineCounts[lang] = (languageLineCounts[lang] || 0) + lines;
            }
          } catch {
            // Non-critical file read error
          }
        }
      }
    }
  }

  await walk(workspacePath);

  // Framework detection
  const detectedFrameworks = new Set<string>();

  // 1. Inspect package.json
  const packageJsonPath = path.join(workspacePath, 'package.json');
  if (fs.existsSync(packageJsonPath)) {
    try {
      const pkg = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf8'));
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

      if (deps['express']) detectedFrameworks.add('Express');
      if (deps['@nestjs/core']) detectedFrameworks.add('NestJS');
      if (deps['fastify']) detectedFrameworks.add('Fastify');
      if (deps['react']) detectedFrameworks.add('React');
      if (deps['@angular/core']) detectedFrameworks.add('Angular');
      if (deps['vue']) detectedFrameworks.add('Vue');
      if (deps['next']) detectedFrameworks.add('Next.js');
      if (deps['tailwindcss']) detectedFrameworks.add('Tailwind CSS');
      if (deps['bootstrap']) detectedFrameworks.add('Bootstrap');
      if (deps['mongoose']) detectedFrameworks.add('Mongoose (MongoDB)');
      if (deps['prisma'] || deps['@prisma/client']) detectedFrameworks.add('Prisma ORM');
      if (deps['typeorm']) detectedFrameworks.add('TypeORM');
      if (deps['sequelize']) detectedFrameworks.add('Sequelize');
      if (deps['jest'] || deps['@types/jest']) detectedFrameworks.add('Jest');
      if (deps['vitest']) detectedFrameworks.add('Vitest');
      if (deps['mocha']) detectedFrameworks.add('Mocha');
    } catch {
      // Ignored
    }
  }

  // 2. Inspect Python requirements / pyproject.toml / Pipfile / setup.py
  const pyManifests = ['requirements.txt', 'pyproject.toml', 'Pipfile', 'setup.py'];
  let pyContent = '';
  for (const m of pyManifests) {
    const mPath = path.join(workspacePath, m);
    if (fs.existsSync(mPath)) {
      try {
        pyContent += (await fs.promises.readFile(mPath, 'utf8')) + '\n';
      } catch {}
    }
  }

  if (pyContent) {
    const lower = pyContent.toLowerCase();
    if (lower.includes('fastapi')) detectedFrameworks.add('FastAPI');
    if (lower.includes('flask')) detectedFrameworks.add('Flask');
    if (lower.includes('django')) detectedFrameworks.add('Django');
    if (lower.includes('sqlalchemy')) detectedFrameworks.add('SQLAlchemy');
    if (lower.includes('pytest')) detectedFrameworks.add('Pytest');
    if (lower.includes('pydantic')) detectedFrameworks.add('Pydantic');
    if (lower.includes('torch') || lower.includes('pytorch')) detectedFrameworks.add('PyTorch');
    if (lower.includes('tensorflow')) detectedFrameworks.add('TensorFlow');
    if (lower.includes('keras')) detectedFrameworks.add('Keras');
    if (lower.includes('scikit-learn') || lower.includes('sklearn')) detectedFrameworks.add('scikit-learn');
    if (lower.includes('pandas')) detectedFrameworks.add('Pandas');
    if (lower.includes('numpy')) detectedFrameworks.add('NumPy');
    if (lower.includes('opencv') || lower.includes('cv2')) detectedFrameworks.add('OpenCV');
    if (lower.includes('transformers')) detectedFrameworks.add('Hugging Face Transformers');
    if (lower.includes('matplotlib') || lower.includes('seaborn')) detectedFrameworks.add('Data Visualization');
    if (lower.includes('xgboost') || lower.includes('lightgbm')) detectedFrameworks.add('XGBoost / LightGBM');
  }

  // 3. Inspect Java pom.xml / build.gradle
  const pomPath = path.join(workspacePath, 'pom.xml');
  const gradlePath = path.join(workspacePath, 'build.gradle');
  let javaBuildContent = '';
  if (fs.existsSync(pomPath)) {
    try {
      javaBuildContent += (await fs.promises.readFile(pomPath, 'utf8')) + '\n';
    } catch {}
  }
  if (fs.existsSync(gradlePath)) {
    try {
      javaBuildContent += (await fs.promises.readFile(gradlePath, 'utf8')) + '\n';
    } catch {}
  }
  if (javaBuildContent) {
    if (javaBuildContent.includes('spring-boot')) detectedFrameworks.add('Spring Boot');
    if (javaBuildContent.includes('spring-data-jpa') || javaBuildContent.includes('hibernate')) detectedFrameworks.add('Hibernate / JPA');
    if (javaBuildContent.includes('spring-security')) detectedFrameworks.add('Spring Security');
    if (javaBuildContent.includes('junit')) detectedFrameworks.add('JUnit');
  }

  // 4. Inspect PHP composer.json
  const composerPath = path.join(workspacePath, 'composer.json');
  if (fs.existsSync(composerPath)) {
    try {
      const compContent = await fs.promises.readFile(composerPath, 'utf8');
      if (compContent.includes('laravel/framework')) detectedFrameworks.add('Laravel');
      if (compContent.includes('symfony/')) detectedFrameworks.add('Symfony');
    } catch {}
  }

  // 5. Inspect C/C++ CMakeLists.txt or Makefile
  if (fs.existsSync(path.join(workspacePath, 'CMakeLists.txt'))) detectedFrameworks.add('CMake');
  if (fs.existsSync(path.join(workspacePath, 'Makefile'))) detectedFrameworks.add('Make / C/C++ Build');

  // 6. Inspect Go go.mod / Rust Cargo.toml
  const goModPath = path.join(workspacePath, 'go.mod');
  if (fs.existsSync(goModPath)) {
    try {
      const mod = await fs.promises.readFile(goModPath, 'utf8');
      if (mod.includes('gin-gonic/gin')) detectedFrameworks.add('Gin');
      if (mod.includes('gofiber/fiber')) detectedFrameworks.add('Fiber');
    } catch {}
  }
  const cargoPath = path.join(workspacePath, 'Cargo.toml');
  if (fs.existsSync(cargoPath)) {
    try {
      const cargo = await fs.promises.readFile(cargoPath, 'utf8');
      if (cargo.includes('actix-web')) detectedFrameworks.add('Actix-Web');
      if (cargo.includes('axum')) detectedFrameworks.add('Axum');
      if (cargo.includes('tokio')) detectedFrameworks.add('Tokio');
    } catch {}
  }

  // Determine languages sorted by line count
  const sortedLangs = Object.entries(languageLineCounts).sort((a, b) => b[1] - a[1]);
  const languages = sortedLangs.map(([l]) => l);
  const primaryLanguage = languages[0] || 'Unknown';

  return {
    primaryLanguage,
    languages,
    frameworks: Array.from(detectedFrameworks),
    allFiles: allFiles.sort(),
    sourceFiles: sourceFiles.sort(),
    testFiles: testFiles.sort(),
    configFiles: configFiles.sort(),
    totalFiles: allFiles.length,
    totalLines,
    languageBreakdown: languageLineCounts,
  };
}
