import fs from "fs";
import path from "path";
import { ProjectScanResult } from "../ingestion/projectScanner.js";
import { logger } from "../middleware/pinoLogger.js";

export type FindingCategory =
  | "FUNCTION_LOGIC"
  | "CLASS_DESIGN"
  | "DATA_STRUCTURE"
  | "ALGORITHM_LOGIC"
  | "FLOW_CONTROL"
  | "IO_OPERATION"
  | "MODULE_IMPORT"
  | "REACT_COMPONENT"
  | "FRONTEND_UI"
  | "AI_ML_MODEL"
  | "ERROR_HANDLING"
  | "SECURITY_AUTH"
  | "API_ROUTE"
  | "DATA_MODEL"
  | "DATABASE_QUERY"
  | "TEST_SUITE"
  | "ARCHITECTURE";

export interface CodeFinding {
  id: string;
  category: FindingCategory;
  title: string;
  filePath: string;
  startLine: number;
  endLine: number;
  codeSnippet: string;
  primaryIdentifier: string;
  secondaryInfo?: string;
  correctAnswer: string;
  distractors: string[];
  explanation: string;
}

export interface InspectionSummary {
  findings: CodeFinding[];
  categoriesCount: Record<string, number>;
  totalAnalyzedFiles: number;
  primaryLanguage: string;
  frameworks: string[];
}

export async function inspectWorkspaceCode(
  workspacePath: string,
  scanResult: ProjectScanResult
): Promise<InspectionSummary> {
  const findings: CodeFinding[] = [];
  const categoriesCount: Record<string, number> = {};

  function addFinding(f: CodeFinding) {
    const exists = findings.some(
      (existing) =>
        existing.filePath === f.filePath &&
        existing.startLine === f.startLine &&
        existing.primaryIdentifier === f.primaryIdentifier
    );
    if (!exists) {
      findings.push(f);
      categoriesCount[f.category] = (categoriesCount[f.category] || 0) + 1;
    }
  }

  // Iterate over all discovered source files
  for (const relPath of scanResult.sourceFiles) {
    const fullPath = path.join(workspacePath, relPath);
    let fileContent = "";
    try {
      fileContent = await fs.promises.readFile(fullPath, "utf8");
    } catch {
      continue;
    }

    const lines = fileContent.split("\n");
    const ext = path.extname(relPath).toLowerCase();
    const simpleFileName = path.basename(relPath);

    // 1. AI, MACHINE LEARNING & DATA SCIENCE LOGIC (Python / R)
    for (let i = 0; i < lines.length; i++) {
      const line = (lines[i] || "").trim();
      if (!line || line.startsWith("#")) continue;

      // Model Training: model.fit(X, y) or estimator.fit(X_train, y_train)
      const fitMatch = line.match(/([a-zA-Z0-9_]+)\.fit\s*\(([^)]+)\)/);
      if (fitMatch && fitMatch[1] && fitMatch[2]) {
        const modelVar = fitMatch[1];
        const fitArgs = fitMatch[2];
        const snippet = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 5)).join("\n");
        addFinding({
          id: `ml-fit-${findings.length + 1}`,
          category: "AI_ML_MODEL",
          title: `Model Training on '${modelVar}' in ${simpleFileName}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: Math.min(lines.length, i + 5),
          codeSnippet: snippet,
          primaryIdentifier: `${modelVar}.fit(${fitArgs})`,
          secondaryInfo: `Args: (${fitArgs})`,
          correctAnswer: `It fits and optimizes model '${modelVar}' using training dataset arguments (${fitArgs}).`,
          distractors: [
            `It performs unsupervised dimensionality reduction using Principal Component Analysis without labels.`,
            `It dumps unquantized raw tensors directly to an S3 cold storage bucket without fitting weights.`,
            `It starts a distributed multi-GPU gradient parameter synchronization server across nodes.`,
          ],
          explanation: `In ${relPath}:${i + 1}, .fit(${fitArgs}) executes machine learning model training on '${modelVar}'.`,
        });
        continue;
      }

      // Model Inference: model.predict(X) or clf.predict_proba(X)
      const predictMatch = line.match(/([a-zA-Z0-9_]+)\.(predict|predict_proba)\s*\(([^)]+)\)/);
      if (predictMatch && predictMatch[1] && predictMatch[3]) {
        const modelVar = predictMatch[1];
        const predArgs = predictMatch[3];
        const snippet = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 4)).join("\n");
        addFinding({
          id: `ml-pred-${findings.length + 1}`,
          category: "AI_ML_MODEL",
          title: `Inference via '${modelVar}' in ${simpleFileName}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: Math.min(lines.length, i + 4),
          codeSnippet: snippet,
          primaryIdentifier: `${modelVar}.${predictMatch[2]}(${predArgs})`,
          secondaryInfo: `Prediction Input: ${predArgs}`,
          correctAnswer: `It generates predictions or classification probabilities using trained estimator '${modelVar}'.`,
          distractors: [
            `It computes cross-entropy validation loss without generating target inferences.`,
            `It applies random data augmentation filters to input audio signals.`,
            `It resets model weights to randomized Gaussian distribution values.`,
          ],
          explanation: `In ${relPath}:${i + 1}, .predict() computes model inferences on provided features '${predArgs}'.`,
        });
        continue;
      }

      // Estimator Initialization: clf = RandomForestClassifier(...) or LinearRegression()
      const mlEstimator = line.match(/([a-zA-Z0-9_]+)\s*=\s*(RandomForestClassifier|RandomForestRegressor|LinearRegression|LogisticRegression|SVC|SVR|KMeans|GradientBoostingClassifier|DecisionTreeClassifier|XGBClassifier)\s*\(([^)]*)\)/);
      if (mlEstimator && mlEstimator[1] && mlEstimator[2]) {
        const varName = mlEstimator[1];
        const algoName = mlEstimator[2];
        const hyperParams = mlEstimator[3] || "default hyperparameters";
        const snippet = lines.slice(i, Math.min(lines.length, i + 5)).join("\n");
        addFinding({
          id: `ml-est-${findings.length + 1}`,
          category: "AI_ML_MODEL",
          title: `ML Algorithm '${algoName}' in ${simpleFileName}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: Math.min(lines.length, i + 5),
          codeSnippet: snippet,
          primaryIdentifier: algoName,
          secondaryInfo: `Hyperparameters: ${hyperParams}`,
          correctAnswer: `It initializes a '${algoName}' machine learning estimator configured with ${hyperParams}.`,
          distractors: [
            `It deploys a serverless ONNX runtime inference microservice container.`,
            `It initializes an in-memory Redis message broker cache for embeddings.`,
            `It converts continuous numerical features into discrete one-hot encoded vectors.`,
          ],
          explanation: `In ${relPath}:${i + 1}, '${varName}' instantiates the '${algoName}' learning algorithm.`,
        });
        continue;
      }

      // PyTorch / Neural Network: class Model(nn.Module): or nn.Sequential(...)
      const torchModule = line.match(/^class\s+([a-zA-Z0-9_]+)\s*\((?:nn\.Module|torch\.nn\.Module)\):/);
      if (torchModule && torchModule[1]) {
        const netName = torchModule[1];
        const snippet = lines.slice(i, Math.min(lines.length, i + 8)).join("\n");
        addFinding({
          id: `ml-nn-${findings.length + 1}`,
          category: "AI_ML_MODEL",
          title: `Neural Network Architecture '${netName}' in ${simpleFileName}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: Math.min(lines.length, i + 8),
          codeSnippet: snippet,
          primaryIdentifier: netName,
          secondaryInfo: "PyTorch nn.Module Deep Learning Architecture",
          correctAnswer: `It defines neural network architecture '${netName}' subclassing PyTorch's nn.Module.`,
          distractors: [
            `It defines an asynchronous database connection pool worker thread.`,
            `It compiles C++ CUDA kernels into dynamic shared library binaries.`,
            `It parses JSON configuration files into flat associative arrays.`,
          ],
          explanation: `In ${relPath}:${i + 1}, class '${netName}' defines deep learning layers and forward computation.`,
        });
        continue;
      }

      // Dataset Loading & Splitting: pd.read_csv("...") or train_test_split(...)
      const splitMatch = line.match(/train_test_split\s*\(([^)]+)\)/);
      if (splitMatch && splitMatch[1]) {
        const snippet = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 4)).join("\n");
        addFinding({
          id: `ml-split-${findings.length + 1}`,
          category: "AI_ML_MODEL",
          title: `Dataset Partitioning in ${simpleFileName}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: Math.min(lines.length, i + 4),
          codeSnippet: snippet,
          primaryIdentifier: "train_test_split",
          secondaryInfo: splitMatch[1],
          correctAnswer: `It partitions dataset arrays into segregated training and validation subsets.`,
          distractors: [
            `It normalizes numerical features using z-score standardization.`,
            `It aggregates tabular rows by category to calculate group mean metrics.`,
            `It drops duplicate dataframe records and imputes missing NaN values.`,
          ],
          explanation: `In ${relPath}:${i + 1}, train_test_split separates training features from testing labels.`,
        });
        continue;
      }
    }

    // 2. API ROUTES & ENDPOINTS (Express, FastAPI, Flask, Spring, Django, Koa, Laravel, ASP.NET)
    for (let i = 0; i < lines.length; i++) {
      const line = (lines[i] || "").trim();
      if (!line) continue;

      // Express / Router: router.get("/api/products", ...) or app.post(...)
      const expressRoute = line.match(/(?:router|app)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/i);
      if (expressRoute && expressRoute[1] && expressRoute[2]) {
        const verb = expressRoute[1].toUpperCase();
        const routePath = expressRoute[2];
        const snippet = lines.slice(i, Math.min(lines.length, i + 6)).join("\n");
        addFinding({
          id: `route-${findings.length + 1}`,
          category: "API_ROUTE",
          title: `API Route [${verb}] ${routePath}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: Math.min(lines.length, i + 6),
          codeSnippet: snippet,
          primaryIdentifier: `${verb} ${routePath}`,
          secondaryInfo: `Method: ${verb}, Path: ${routePath}`,
          correctAnswer: `It registers an HTTP endpoint handling [${verb} ${routePath}] on the configured router.`,
          distractors: [
            `It configures an unauthenticated WebSocket heartbeat broadcast channel.`,
            `It starts a background BullMQ queue worker processing asynchronous jobs.`,
            `It serves static public assets directly from the filesystem directory.`,
          ],
          explanation: `In ${relPath}:${i + 1}, the router maps HTTP ${verb} requests targeting '${routePath}'.`,
        });
        continue;
      }

      // FastAPI / Flask / Python routes: @app.get("/items") or @app.route("/predict", methods=["POST"])
      const pyRoute = line.match(/@(?:app|router|bp)\.(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/i) ||
                      line.match(/@(?:app|bp)\.route\s*\(\s*['"`]([^'"`]+)['"`]/i);
      if (pyRoute) {
        const verb = (pyRoute[1] || "GET").toUpperCase();
        const routePath = pyRoute[2] || pyRoute[1];
        const snippet = lines.slice(i, Math.min(lines.length, i + 6)).join("\n");
        addFinding({
          id: `route-${findings.length + 1}`,
          category: "API_ROUTE",
          title: `API Route [${verb}] ${routePath}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: Math.min(lines.length, i + 6),
          codeSnippet: snippet,
          primaryIdentifier: `${verb} ${routePath}`,
          secondaryInfo: `Method: ${verb}, Path: ${routePath}`,
          correctAnswer: `It registers an HTTP endpoint handling [${verb} ${routePath}] using route decorators.`,
          distractors: [
            `It defines a Celery scheduled background task executed periodically via cron.`,
            `It opens an unencrypted TCP socket for binary data transmission.`,
            `It defines a custom WSGI middleware intercepting incoming request headers.`,
          ],
          explanation: `In ${relPath}:${i + 1}, the decorator configures an endpoint for ${verb} '${routePath}'.`,
        });
        continue;
      }

      // Java Spring REST mappings: @GetMapping("/api/pets")
      const springRoute = line.match(/@(GetMapping|PostMapping|PutMapping|DeleteMapping|PatchMapping|RequestMapping)\s*(\(\s*(?:value\s*=\s*)?["']([^"']+)["'])?/i);
      if (springRoute && springRoute[1]) {
        const verb = springRoute[1].replace("Mapping", "").toUpperCase();
        const routePath = springRoute[3] || "/";
        const snippet = lines.slice(i, Math.min(lines.length, i + 6)).join("\n");
        addFinding({
          id: `route-${findings.length + 1}`,
          category: "API_ROUTE",
          title: `Spring REST Endpoint [${verb}] ${routePath}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: Math.min(lines.length, i + 6),
          codeSnippet: snippet,
          primaryIdentifier: `${verb} ${routePath}`,
          secondaryInfo: `Spring Annotation: @${springRoute[1]}`,
          correctAnswer: `It exposes an HTTP endpoint handling [${verb} ${routePath}] with request binding.`,
          distractors: [
            `It registers a JMS queue listener polling enterprise message brokers.`,
            `It configures an unbuffered reactive Netty event loop thread pool.`,
            `It configures a Spring Batch job step for scheduled batch migrations.`,
          ],
          explanation: `In ${relPath}:${i + 1}, Spring maps HTTP ${verb} requests to this controller handler.`,
        });
        continue;
      }

      // PHP Laravel routes: Route::get('/users', ...);
      const phpRoute = line.match(/Route::(get|post|put|delete|patch)\s*\(\s*['"`]([^'"`]+)['"`]/i);
      if (phpRoute && phpRoute[1] && phpRoute[2]) {
        const verb = phpRoute[1].toUpperCase();
        const routePath = phpRoute[2];
        const snippet = lines.slice(i, Math.min(lines.length, i + 5)).join("\n");
        addFinding({
          id: `route-${findings.length + 1}`,
          category: "API_ROUTE",
          title: `Laravel Route [${verb}] ${routePath}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: Math.min(lines.length, i + 5),
          codeSnippet: snippet,
          primaryIdentifier: `${verb} ${routePath}`,
          correctAnswer: `It defines a Laravel routing endpoint handling HTTP ${verb} requests to '${routePath}'.`,
          distractors: [
            `It defines an Artisan CLI terminal command executable via command line.`,
            `It registers an event listener triggered on database transaction commit.`,
            `It publishes a Blade view template caching compile bundle.`,
          ],
          explanation: `In ${relPath}:${i + 1}, Route::${phpRoute[1]} maps requests to '${routePath}'.`,
        });
        continue;
      }
    }

    // 3. DATABASE MODELS & PERSISTENCE (Mongoose, SQLAlchemy, Django ORM, JPA/Hibernate, Prisma, SQL)
    for (let i = 0; i < lines.length; i++) {
      const line = (lines[i] || "").trim();
      if (!line) continue;

      // Mongoose: mongoose.model("Product", ProductSchema)
      const mongooseModel = line.match(/(?:export\s+const\s+)?([a-zA-Z0-9_]+)\s*=\s*mongoose\.model\s*\(\s*['"`]([a-zA-Z0-9_]+)['"`]/i) ||
                            line.match(/mongoose\.model\s*\(\s*['"`]([a-zA-Z0-9_]+)['"`]/i);
      if (mongooseModel) {
        const modelName = mongooseModel[2] || mongooseModel[1] || "Document";
        const snippet = lines.slice(Math.max(0, i - 5), Math.min(lines.length, i + 4)).join("\n");
        addFinding({
          id: `model-${findings.length + 1}`,
          category: "DATA_MODEL",
          title: `Mongoose Model ${modelName}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: i + 1,
          codeSnippet: snippet,
          primaryIdentifier: modelName,
          secondaryInfo: "Mongoose ODM Document Model",
          correctAnswer: `It defines the Mongoose data schema and persistence model for '${modelName}'.`,
          distractors: [
            `It establishes a raw Redis pub/sub message broadcast channel.`,
            `It creates an ephemeral in-memory SQLite temporary database.`,
            `It configures an external Elasticsearch indexing webhook.`,
          ],
          explanation: `In ${relPath}:${i + 1}, mongoose.model compiles the schema into the '${modelName}' model.`,
        });
        continue;
      }

      // SQLAlchemy / Django / Python ORM: class Order(Base): or class Item(models.Model):
      const pyModel = line.match(/^class\s+([a-zA-Z0-9_]+)\s*\(([^)]*(?:Base|models\.Model|db\.Model)[^)]*)\):/i);
      if (pyModel && pyModel[1]) {
        const modelName = pyModel[1];
        const snippet = lines.slice(i, Math.min(lines.length, i + 8)).join("\n");
        addFinding({
          id: `model-${findings.length + 1}`,
          category: "DATA_MODEL",
          title: `ORM Data Model ${modelName}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: Math.min(lines.length, i + 8),
          codeSnippet: snippet,
          primaryIdentifier: modelName,
          secondaryInfo: `ORM Base: ${pyModel[2]}`,
          correctAnswer: `It defines the database schema and ORM entity mapping for '${modelName}'.`,
          distractors: [
            `It sets up an asynchronous thread synchronization mutex.`,
            `It creates an in-memory mock placeholder for stub testing.`,
            `It downloads external assets over an unencrypted FTP socket.`,
          ],
          explanation: `In ${relPath}:${i + 1}, class '${modelName}' defines an ORM persistence entity.`,
        });
        continue;
      }

      // Java JPA / Hibernate: @Entity or @Table
      if (line.startsWith("@Entity") || line.startsWith("@Table")) {
        const nextLines = lines.slice(i, Math.min(lines.length, i + 6)).join("\n");
        const classMatch = nextLines.match(/public\s+class\s+([a-zA-Z0-9_]+)/);
        if (classMatch && classMatch[1]) {
          const entityName = classMatch[1];
          addFinding({
            id: `model-${findings.length + 1}`,
            category: "DATA_MODEL",
            title: `JPA Entity ${entityName}`,
            filePath: relPath,
            startLine: i + 1,
            endLine: Math.min(lines.length, i + 8),
            codeSnippet: nextLines,
            primaryIdentifier: entityName,
            secondaryInfo: "JPA / Hibernate Entity",
            correctAnswer: `It defines the JPA/Hibernate database persistence entity for '${entityName}'.`,
            distractors: [
              `It acts as a build script hook for Maven compilation.`,
              `It creates an ephemeral in-memory caching token.`,
              `It mounts a static WebDAV volume over NFS.`,
            ],
            explanation: `In ${relPath}:${i + 1}, @Entity designates '${entityName}' as a persistent database entity.`,
          });
          continue;
        }
      }

      // SQL Table Definition: CREATE TABLE table_name (...)
      const sqlTable = line.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?([a-zA-Z0-9_]+)/i);
      if (sqlTable && sqlTable[1]) {
        const tableName = sqlTable[1];
        const snippet = lines.slice(i, Math.min(lines.length, i + 8)).join("\n");
        addFinding({
          id: `sql-table-${findings.length + 1}`,
          category: "DATA_MODEL",
          title: `SQL Table Schema '${tableName}' in ${simpleFileName}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: Math.min(lines.length, i + 8),
          codeSnippet: snippet,
          primaryIdentifier: tableName,
          correctAnswer: `It defines relational database table schema and column constraints for '${tableName}'.`,
          distractors: [
            `It executes a stored procedure compiling dynamic binary byte arrays.`,
            `It drops and purges table records without schema validation.`,
            `It configures an unindexed full-text materialized view.`,
          ],
          explanation: `In ${relPath}:${i + 1}, CREATE TABLE declares structure and column constraints for '${tableName}'.`,
        });
        continue;
      }
    }

    // 4. FRONTEND UI & STYLING (React, HTML, CSS, DOM)
    // HTML semantic tags & forms
    if (ext === ".html" || ext === ".htm") {
      for (let i = 0; i < lines.length; i++) {
        const line = (lines[i] || "").trim();
        const htmlTag = line.match(/<(form|canvas|table|nav|main|section|article|header|footer|button|input)\b([^>]*)>/i);
        if (htmlTag && htmlTag[1]) {
          const tagName = htmlTag[1].toLowerCase();
          const snippet = lines.slice(i, Math.min(lines.length, i + 6)).join("\n");
          addFinding({
            id: `html-tag-${findings.length + 1}`,
            category: "FRONTEND_UI",
            title: `HTML Element <${tagName}> in ${simpleFileName}`,
            filePath: relPath,
            startLine: i + 1,
            endLine: Math.min(lines.length, i + 6),
            codeSnippet: snippet,
            primaryIdentifier: `<${tagName}>`,
            correctAnswer: `It renders semantic HTML structure using element '<${tagName}>' for user interaction or layout.`,
            distractors: [
              `It initiates an asynchronous WebAssembly bytecode runtime compilation.`,
              `It binds a native desktop window manager event loop hook.`,
              `It opens an unbuffered raw TCP stream pipe to the web server.`,
            ],
            explanation: `In ${relPath}:${i + 1}, the <${tagName}> element organizes user interface structure.`,
          });
          break;
        }
      }
    }

    // CSS selectors & layout
    if (ext === ".css" || ext === ".scss" || ext === ".sass" || ext === ".less") {
      for (let i = 0; i < lines.length; i++) {
        const line = (lines[i] || "").trim();
        const cssRule = line.match(/^([.#a-zA-Z0-9_\-\s,>:+]+)\s*\{/);
        if (cssRule && cssRule[1] && !cssRule[1].startsWith("@")) {
          const selector = cssRule[1].trim();
          const snippet = lines.slice(i, Math.min(lines.length, i + 6)).join("\n");
          addFinding({
            id: `css-rule-${findings.length + 1}`,
            category: "FRONTEND_UI",
            title: `CSS Style Rule '${selector}' in ${simpleFileName}`,
            filePath: relPath,
            startLine: i + 1,
            endLine: Math.min(lines.length, i + 6),
            codeSnippet: snippet,
            primaryIdentifier: selector,
            correctAnswer: `It applies styling rules, positioning, or visual layout targeting selector '${selector}'.`,
            distractors: [
              `It executes dynamic JavaScript expression evaluation in the browser.`,
              `It establishes an encrypted TLS handshake certificate with the CDN.`,
              `It compiles server-side templating expressions into static HTML.`,
            ],
            explanation: `In ${relPath}:${i + 1}, CSS selector '${selector}' styles UI presentation.`,
          });
          break;
        }
      }
    }

    // React components & hooks
    if (ext === ".tsx" || ext === ".jsx" || ext === ".js" || ext === ".ts") {
      for (let i = 0; i < lines.length; i++) {
        const line = (lines[i] || "").trim();
        const hookMatch = line.match(/const\s*\[([a-zA-Z0-9_]+),\s*set[a-zA-Z0-9_]+\]\s*=\s*useState/);
        if (hookMatch && hookMatch[1]) {
          const stateName = hookMatch[1];
          const snippet = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 4)).join("\n");
          addFinding({
            id: `react-${findings.length + 1}`,
            category: "REACT_COMPONENT",
            title: `React State '${stateName}' in ${simpleFileName}`,
            filePath: relPath,
            startLine: i + 1,
            endLine: Math.min(lines.length, i + 4),
            codeSnippet: snippet,
            primaryIdentifier: stateName,
            secondaryInfo: "useState hook",
            correctAnswer: `It manages local reactive component state for '${stateName}' using React's useState hook.`,
            distractors: [
              `It persists state globally across browser windows using WebSockets.`,
              `It mutates the DOM tree directly bypassing React's virtual DOM.`,
              `It registers a service worker for offline web caching.`,
            ],
            explanation: `In ${relPath}:${i + 1}, the useState hook initializes reactive state for '${stateName}'.`,
          });
          break;
        }

        // React useEffect hook
        if (line.startsWith("useEffect(") || line.startsWith("React.useEffect(")) {
          const snippet = lines.slice(i, Math.min(lines.length, i + 6)).join("\n");
          addFinding({
            id: `react-effect-${findings.length + 1}`,
            category: "REACT_COMPONENT",
            title: `React Lifecycle Effect in ${simpleFileName}`,
            filePath: relPath,
            startLine: i + 1,
            endLine: Math.min(lines.length, i + 6),
            codeSnippet: snippet,
            primaryIdentifier: "useEffect",
            correctAnswer: `It synchronizes component lifecycle side-effects, subscriptions, or data fetching.`,
            distractors: [
              `It pauses client JavaScript execution until server ping responses arrive.`,
              `It performs synchronous blocking database queries on the UI thread.`,
              `It registers background worker threads for WebGL shader compilation.`,
            ],
            explanation: `In ${relPath}:${i + 1}, useEffect coordinates component side effects on render/mount.`,
          });
          break;
        }

        // Vanilla DOM event listener: element.addEventListener("click", ...)
        const domEvent = line.match(/addEventListener\s*\(\s*['"`]([a-zA-Z0-9_]+)['"`]/);
        if (domEvent && domEvent[1]) {
          const evt = domEvent[1];
          const snippet = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 4)).join("\n");
          addFinding({
            id: `dom-evt-${findings.length + 1}`,
            category: "FRONTEND_UI",
            title: `DOM Event Listener '${evt}' in ${simpleFileName}`,
            filePath: relPath,
            startLine: i + 1,
            endLine: Math.min(lines.length, i + 4),
            codeSnippet: snippet,
            primaryIdentifier: `addEventListener('${evt}')`,
            correctAnswer: `It binds an interactive event listener responding to client '${evt}' actions.`,
            distractors: [
              `It establishes an unauthenticated peer-to-peer WebRTC connection.`,
              `It executes a cryptographic proof-of-work algorithm in WebAssembly.`,
              `It forces an immediate page reload clearing all local session cookies.`,
            ],
            explanation: `In ${relPath}:${i + 1}, addEventListener attaches a handler for '${evt}' events.`,
          });
          break;
        }
      }
    }

    // 5. C & C++ SPECIFIC LOGIC (structs, pointers, memory, main)
    if (ext === ".c" || ext === ".cpp" || ext === ".cc" || ext === ".h" || ext === ".hpp") {
      for (let i = 0; i < lines.length; i++) {
        const line = (lines[i] || "").trim();

        // C / C++ struct definition
        const cStruct = line.match(/^(?:typedef\s+)?struct\s+([a-zA-Z0-9_]+)?\s*\{/);
        if (cStruct) {
          const structName = cStruct[1] || "Struct";
          const snippet = lines.slice(i, Math.min(lines.length, i + 8)).join("\n");
          addFinding({
            id: `c-struct-${findings.length + 1}`,
            category: "CLASS_DESIGN",
            title: `C/C++ Struct '${structName}' in ${simpleFileName}`,
            filePath: relPath,
            startLine: i + 1,
            endLine: Math.min(lines.length, i + 8),
            codeSnippet: snippet,
            primaryIdentifier: structName,
            correctAnswer: `It declares compound data layout structure '${structName}' grouping member variables.`,
            distractors: [
              `It configures an unbuffered socket listener for raw ICMP packets.`,
              `It defines a preprocessor macro expanding recursive token substitutions.`,
              `It maps virtual memory addresses directly to hardware video RAM buffers.`,
            ],
            explanation: `In ${relPath}:${i + 1}, struct '${structName}' encapsulates compound state in C/C++.`,
          });
          continue;
        }

        // C memory allocation: malloc, calloc, free
        if (line.includes("malloc(") || line.includes("calloc(") || line.includes("free(")) {
          const isAlloc = line.includes("malloc") || line.includes("calloc");
          const snippet = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 4)).join("\n");
          addFinding({
            id: `c-mem-${findings.length + 1}`,
            category: "ALGORITHM_LOGIC",
            title: `Memory Management in ${simpleFileName}`,
            filePath: relPath,
            startLine: i + 1,
            endLine: Math.min(lines.length, i + 4),
            codeSnippet: snippet,
            primaryIdentifier: isAlloc ? "Dynamic Memory Allocation (malloc)" : "Memory Deallocation (free)",
            correctAnswer: `It manages heap memory allocation/deallocation via '${isAlloc ? "malloc" : "free"}' to manage memory lifecycle.`,
            distractors: [
              `It triggers an automatic garbage collection sweep managed by the JVM runtime.`,
              `It compresses memory pages using zlib before paging to disk.`,
              `It locks memory pages in physical RAM using mlock() system calls.`,
            ],
            explanation: `In ${relPath}:${i + 1}, dynamic memory management allocates/frees heap memory manually.`,
          });
          break;
        }
      }
    }

    // 6. CLASSES & OBJECT-ORIENTED DESIGN (Python, JS, TS, Java, C++, PHP, C#)
    for (let i = 0; i < lines.length; i++) {
      const line = (lines[i] || "").trim();

      // Python class
      const pyClass = line.match(/^class\s+([a-zA-Z0-9_]+)(\(([^)]*)\))?:/);
      if (pyClass && pyClass[1]) {
        const className = pyClass[1];
        const baseClass = pyClass[3] ? ` inheriting from ${pyClass[3]}` : "";
        const snippet = lines.slice(i, Math.min(lines.length, i + 8)).join("\n");

        addFinding({
          id: `cls-${findings.length + 1}`,
          category: "CLASS_DESIGN",
          title: `Class ${className}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: Math.min(lines.length, i + 8),
          codeSnippet: snippet,
          primaryIdentifier: className,
          secondaryInfo: baseClass,
          correctAnswer: `It defines class '${className}'${baseClass} to manage domain state and behavior.`,
          distractors: [
            `It registers a global event emitter for operating system signals.`,
            `It creates an ephemeral in-memory SQLite temporary database.`,
            `It acts as an abstract stub mock that raises NotImplementedError.`,
          ],
          explanation: `In ${relPath}:${i + 1}, class '${className}' encapsulates game/application state and methods.`,
        });
        continue;
      }

      // JS / TS / Java / C++ / PHP / C# class
      const generalClass = line.match(/^(?:export\s+)?(?:default\s+)?(?:public\s+|private\s+|abstract\s+)?class\s+([a-zA-Z0-9_]+)/);
      if (generalClass && generalClass[1]) {
        const className = generalClass[1];
        const snippet = lines.slice(i, Math.min(lines.length, i + 8)).join("\n");

        addFinding({
          id: `cls-${findings.length + 1}`,
          category: "CLASS_DESIGN",
          title: `Class ${className}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: Math.min(lines.length, i + 8),
          codeSnippet: snippet,
          primaryIdentifier: className,
          correctAnswer: `It defines class '${className}' encapsulating core application components.`,
          distractors: [
            `It acts as a build script hook for Webpack/Babel transpilation.`,
            `It declares an unhandled error catch-all handler.`,
            `It defines a unit test stub without assertions.`,
          ],
          explanation: `In ${relPath}:${i + 1}, class '${className}' organizes domain models and behaviors.`,
        });
        continue;
      }
    }

    // 7. FUNCTIONS, METHODS & PARAMETERS
    for (let i = 0; i < lines.length; i++) {
      const line = (lines[i] || "").trim();

      // Python function: def choose_category(): or def is_won(self):
      const pyFunc = line.match(/^def\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\):/);
      if (pyFunc && pyFunc[1]) {
        const funcName = pyFunc[1];
        const params = pyFunc[2] || "";
        const snippet = lines.slice(i, Math.min(lines.length, i + 7)).join("\n");

        let actionDesc = `implements logic taking parameters (${params || "none"})`;
        if (funcName.includes("difficulty")) actionDesc = `handles difficulty level configuration and settings`;
        else if (funcName.includes("category")) actionDesc = `prompts for or retrieves selectable word categories`;
        else if (funcName.includes("guess")) actionDesc = `processes and validates player letter guesses`;
        else if (funcName.includes("hint")) actionDesc = `manages remaining hints and reveals word clues`;
        else if (funcName.includes("score") || funcName.includes("point")) actionDesc = `calculates, records, or updates player scores`;
        else if (funcName.includes("play") || funcName.includes("round")) actionDesc = `controls the active gameplay loop for a round`;
        else if (funcName.includes("won") || funcName.includes("lost")) actionDesc = `checks victory or defeat conditions`;
        else if (funcName.includes("train") || funcName.includes("fit")) actionDesc = `executes training iterations on provided data`;
        else if (funcName.includes("predict")) actionDesc = `generates output predictions from input features`;

        addFinding({
          id: `fn-${findings.length + 1}`,
          category: "FUNCTION_LOGIC",
          title: `Function ${funcName}() in ${simpleFileName}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: Math.min(lines.length, i + 7),
          codeSnippet: snippet,
          primaryIdentifier: funcName,
          secondaryInfo: `Parameters: (${params || "none"})`,
          correctAnswer: `It ${actionDesc} with signature '${funcName}(${params})'.`,
          distractors: [
            `It immediately terminates the program using sys.exit(1).`,
            `It parses command-line arguments passed via sys.argv.`,
            `It downloads external assets over an insecure HTTP connection.`,
          ],
          explanation: `In ${relPath}:${i + 1}, def ${funcName}(${params}) ${actionDesc}.`,
        });
        continue;
      }

      // JS / TS functions: function foo(x), const bar = (x) =>, export async function
      const jsFunc = line.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)/) ||
                     line.match(/^(?:export\s+)?const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\(([^)]*)\)\s*=>/);
      if (jsFunc) {
        const funcName = jsFunc[1];
        const params = jsFunc[2] || "";
        if (funcName && !funcName.startsWith("_") && !funcName.startsWith("set")) {
          const snippet = lines.slice(i, Math.min(lines.length, i + 7)).join("\n");
          addFinding({
            id: `fn-${findings.length + 1}`,
            category: "FUNCTION_LOGIC",
            title: `Function ${funcName}() in ${simpleFileName}`,
            filePath: relPath,
            startLine: i + 1,
            endLine: Math.min(lines.length, i + 7),
            codeSnippet: snippet,
            primaryIdentifier: funcName,
            secondaryInfo: `Parameters: (${params})`,
            correctAnswer: `It defines function '${funcName}' taking parameters (${params || "none"}).`,
            distractors: [
              `It creates an unbound WebWorker thread for background hashing.`,
              `It mutates global window object properties directly.`,
              `It acts as a placeholder stub that throws NotImplementedError.`,
            ],
            explanation: `In ${relPath}:${i + 1}, function '${funcName}' implements business logic taking (${params}).`,
          });
          continue;
        }
      }

      // Java / C++ / C / C# methods: public void play() or int calculate(int a, int b)
      const cMethod = line.match(/^(?:public|private|protected|static|inline|\s)*([a-zA-Z0-9_<>[\\], *&]+)\s+([a-zA-Z0-9_]+)\s*\(([^)]*)\)\s*(?:const)?\s*\{/);
      if (cMethod && cMethod[2] && !["if", "while", "for", "switch", "catch"].includes(cMethod[2])) {
        const retType = cMethod[1]!.trim();
        const methodName = cMethod[2]!;
        const params = cMethod[3] || "";
        const snippet = lines.slice(i, Math.min(lines.length, i + 7)).join("\n");
        addFinding({
          id: `fn-${findings.length + 1}`,
          category: "FUNCTION_LOGIC",
          title: `Method ${methodName}() in ${simpleFileName}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: Math.min(lines.length, i + 7),
          codeSnippet: snippet,
          primaryIdentifier: methodName,
          secondaryInfo: `Returns ${retType}`,
          correctAnswer: `It defines function/method '${methodName}' returning '${retType}' with parameters (${params || "none"}).`,
          distractors: [
            `It registers a finalizer method called before JVM garbage collection.`,
            `It sets up a thread synchronization mutex across separate OS processes.`,
            `It serializes object state into an uncompressed binary bytecode dump.`,
          ],
          explanation: `In ${relPath}:${i + 1}, '${methodName}' defines a method returning ${retType}.`,
        });
        continue;
      }
    }

    // 8. DATA STRUCTURES & STATE
    for (let i = 0; i < lines.length; i++) {
      const line = (lines[i] || "").trim();

      const dsMatch = line.match(/^([a-zA-Z0-9_]+)\s*=\s*(\{|\[)/i);
      if (dsMatch && dsMatch[1]) {
        const varName = dsMatch[1];
        if (varName.length > 2 && !varName.startsWith("_v") && !varName.startsWith("const")) {
          const isDict = dsMatch[2] === "{";
          const snippet = lines.slice(i, Math.min(lines.length, i + 8)).join("\n");
          addFinding({
            id: `ds-${findings.length + 1}`,
            category: "DATA_STRUCTURE",
            title: `Data Structure '${varName}' in ${simpleFileName}`,
            filePath: relPath,
            startLine: i + 1,
            endLine: Math.min(lines.length, i + 8),
            codeSnippet: snippet,
            primaryIdentifier: varName,
            secondaryInfo: isDict ? "Dictionary / Key-Value Map" : "List / Array Collection",
            correctAnswer: `It initializes a ${isDict ? "dictionary mapping key-value data" : "list collection storing elements"} for '${varName}'.`,
            distractors: [
              `It opens a persistent binary file stream to disk.`,
              `It parses XML configuration from standard input.`,
              `It clears in-memory heap memory to force garbage collection.`,
            ],
            explanation: `In ${relPath}:${i + 1}, '${varName}' defines a ${isDict ? "dictionary" : "list"} data structure.`,
          });
          continue;
        }
      }
    }

    // 9. LOOPS & EXECUTION FLOW CONTROL
    for (let i = 0; i < lines.length; i++) {
      const line = (lines[i] || "").trim();

      const whileMatch = line.match(/^while\s+(.+):/);
      if (whileMatch && whileMatch[1]) {
        const condition = whileMatch[1].trim();
        const snippet = lines.slice(i, Math.min(lines.length, i + 6)).join("\n");
        addFinding({
          id: `flow-${findings.length + 1}`,
          category: "FLOW_CONTROL",
          title: `While Loop in ${simpleFileName}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: Math.min(lines.length, i + 6),
          codeSnippet: snippet,
          primaryIdentifier: `while ${condition}`,
          secondaryInfo: `Condition: ${condition}`,
          correctAnswer: `It repeatedly executes application steps as long as '${condition}' evaluates to true.`,
          distractors: [
            `It forks a parallel background worker thread for each loop iteration.`,
            `It executes exactly once and triggers an unconditional crash.`,
            `It polls an external network server over WebSocket for heartbeat frames.`,
          ],
          explanation: `In ${relPath}:${i + 1}, the while loop maintains iterative execution governed by '${condition}'.`,
        });
        continue;
      }

      const forMatch = line.match(/^for\s+(.+)\s+in\s+(.+):/) ||
                       line.match(/^for\s*\((?:let|const|var|int|size_t)\s+([a-zA-Z0-9_]+)\s*(?:of|in|;|=)([^)]*)\)/);
      if (forMatch) {
        const item = forMatch[1];
        const iter = forMatch[2];
        const snippet = lines.slice(i, Math.min(lines.length, i + 6)).join("\n");
        addFinding({
          id: `flow-${findings.length + 1}`,
          category: "FLOW_CONTROL",
          title: `For Loop in ${simpleFileName}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: Math.min(lines.length, i + 6),
          codeSnippet: snippet,
          primaryIdentifier: `for ${item} in ${iter}`,
          correctAnswer: `It iterates over '${iter}' binding sequence elements to '${item}'.`,
          distractors: [
            `It performs a binary tree search across unordered memory pointers.`,
            `It deletes elements from '${iter}' in reverse order.`,
            `It schedules asynchronous promises concurrently on the microtask queue.`,
          ],
          explanation: `In ${relPath}:${i + 1}, the for loop sequentially processes elements from '${iter}'.`,
        });
        continue;
      }
    }

    // 10. INPUT / OUTPUT & PERSISTENCE
    for (let i = 0; i < lines.length; i++) {
      const line = (lines[i] || "").trim();

      if (line.includes("input(") || line.includes("print(") || line.includes("open(") || line.includes("json.dump") || line.includes("json.load") || line.includes("printf(") || line.includes("std::cout") || line.includes("console.log")) {
        let ioType = "Terminal Output";
        let desc = "prints status, data, or messages to the user console";
        if (line.includes("input(") || line.includes("scanf(") || line.includes("std::cin")) {
          ioType = "User Input";
          desc = "prompts the user and reads text input from standard input";
        } else if (line.includes("open(") || line.includes("fopen(") || line.includes("json.")) {
          ioType = "File Persistence";
          desc = "reads or writes data to a persistent file stream";
        }

        const snippet = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 4)).join("\n");
        addFinding({
          id: `io-${findings.length + 1}`,
          category: "IO_OPERATION",
          title: `${ioType} in ${simpleFileName}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: Math.min(lines.length, i + 4),
          codeSnippet: snippet,
          primaryIdentifier: ioType,
          correctAnswer: `It ${desc}.`,
          distractors: [
            `It streams raw audio frames to an external sound card driver.`,
            `It opens an unencrypted FTP socket connection to an external server.`,
            `It executes a raw SQL transaction commit.`,
          ],
          explanation: `In ${relPath}:${i + 1}, the application performs ${ioType} to interact with user or storage.`,
        });
        break;
      }
    }

    // 11. EXCEPTION & ERROR HANDLING
    for (let i = 0; i < lines.length; i++) {
      const line = (lines[i] || "").trim();
      if (line.startsWith("try:") || line.startsWith("try {") || line.includes("catch (") || line.includes("except ")) {
        const snippet = lines.slice(i, Math.min(lines.length, i + 7)).join("\n");
        addFinding({
          id: `err-${findings.length + 1}`,
          category: "ERROR_HANDLING",
          title: `Exception Handling in ${simpleFileName}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: Math.min(lines.length, i + 7),
          codeSnippet: snippet,
          primaryIdentifier: "try/catch/except block",
          correctAnswer: `It wraps operations in defensive error handling to catch runtime exceptions gracefully.`,
          distractors: [
            `It suppresses critical kernel faults and forces an operating system panic.`,
            `It restarts the entire machine whenever an error occurs.`,
            `It converts all exceptions into empty string variables.`,
          ],
          explanation: `In ${relPath}:${i + 1}, defensive error handling catches exceptions to prevent unhandled application crashes.`,
        });
        break;
      }
    }

    // 12. TEST SUITES & VERIFICATION
    const isTestPath = relPath.includes("test") || relPath.includes("spec") || relPath.includes("__tests__");
    if (isTestPath) {
      for (let i = 0; i < lines.length; i++) {
        const line = (lines[i] || "").trim();
        if (!line) continue;

        // JS / TS test: describe("...", ...) or it("...", ...) or test("...", ...)
        const jsTest = line.match(/(?:describe|it|test)\s*\(\s*['"`]([^'"`]+)['"`]/i);
        if (jsTest && jsTest[1]) {
          const testName = jsTest[1];
          const snippet = lines.slice(i, Math.min(lines.length, i + 6)).join("\n");
          addFinding({
            id: `test-${findings.length + 1}`,
            category: "TEST_SUITE",
            title: `Test Case: ${testName.slice(0, 40)}`,
            filePath: relPath,
            startLine: i + 1,
            endLine: Math.min(lines.length, i + 6),
            codeSnippet: snippet,
            primaryIdentifier: testName,
            correctAnswer: `It executes automated test assertions verifying: '${testName}'.`,
            distractors: [
              `It initializes a low-level binary socket listener on port 8080.`,
              `It launches an external sub-process running bash shell commands.`,
              `It creates an ephemeral in-memory SQLite temporary database.`,
            ],
            explanation: `In ${relPath}:${i + 1}, the test verifies expected software behavior for '${testName}'.`,
          });
          continue;
        }

        // Python test: def test_health_check_returns_ok():
        const pyTest = line.match(/^def\s+(test_[a-zA-Z0-9_]+)\s*\(([^)]*)\):/i);
        if (pyTest && pyTest[1]) {
          const testName = pyTest[1];
          const snippet = lines.slice(i, Math.min(lines.length, i + 6)).join("\n");
          addFinding({
            id: `test-${findings.length + 1}`,
            category: "TEST_SUITE",
            title: `Python Test: ${testName}`,
            filePath: relPath,
            startLine: i + 1,
            endLine: Math.min(lines.length, i + 6),
            codeSnippet: snippet,
            primaryIdentifier: testName,
            correctAnswer: `It executes automated test verification for: '${testName}'.`,
            distractors: [
              `It schedules an asynchronous background cron worker on the system clock.`,
              `It sets up a raw TCP socket listener for binary buffer transfers.`,
              `It converts all exceptions into empty string variables.`,
            ],
            explanation: `In ${relPath}:${i + 1}, '${testName}' asserts application behavior using Pytest/unittest.`,
          });
          continue;
        }
      }
    }

    // 13. MODULE IMPORTS & DEPENDENCIES
    for (let i = 0; i < Math.min(lines.length, 60); i++) {
      const line = (lines[i] || "").trim();
      if (!line) continue;

      // Python imports: import os, from words import WordBank
      const pyImp = line.match(/^(from\s+([a-zA-Z0-9_.]+)\s+import\s+([a-zA-Z0-9_, *]+)|import\s+([a-zA-Z0-9_, ]+))/);
      if (pyImp) {
        const mod = (pyImp[2] || pyImp[4] || "").trim();
        const importedItems = (pyImp[3] || pyImp[4] || "").trim();
        if (mod && !mod.startsWith("__")) {
          const snippet = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 3)).join("\n");
          addFinding({
            id: `imp-${findings.length + 1}`,
            category: "MODULE_IMPORT",
            title: `Module Import in ${simpleFileName}`,
            filePath: relPath,
            startLine: i + 1,
            endLine: i + 1,
            codeSnippet: snippet,
            primaryIdentifier: mod,
            secondaryInfo: importedItems,
            correctAnswer: `It imports '${importedItems}' from '${mod}' to provide modular functionality.`,
            distractors: [
              `It launches an external sub-process running bash shell commands.`,
              `It initializes a low-level binary socket listener on port 8080.`,
              `It dynamically recompiles Python bytecode to C extensions.`,
            ],
            explanation: `In ${relPath}:${i + 1}, the import statement loads '${importedItems}' from module '${mod}'.`,
          });
        }
        continue;
      }

      // JS / TS imports: import React from 'react' or const express = require('express')
      const jsImp = line.match(/^import\s+([^;]+)\s+from\s+['"`]([^'"`]+)['"`]/) ||
                    line.match(/const\s+([^=]+)\s*=\s*require\s*\(['"`]([^'"`]+)['"`]\)/);
      if (jsImp && jsImp[2]) {
        const importedItems = (jsImp[1] || "").trim();
        const mod = jsImp[2].trim();
        const snippet = lines.slice(Math.max(0, i - 1), Math.min(lines.length, i + 3)).join("\n");
        addFinding({
          id: `imp-${findings.length + 1}`,
          category: "MODULE_IMPORT",
          title: `Module Dependency in ${simpleFileName}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: i + 1,
          codeSnippet: snippet,
          primaryIdentifier: mod,
          secondaryInfo: importedItems,
          correctAnswer: `It imports module '${mod}' into ${simpleFileName} for application logic.`,
          distractors: [
            `It registers a native WebAssembly binary compiler.`,
            `It installs an unverified global npm package at runtime.`,
            `It configures an unbuffered TCP stream pipe.`,
          ],
          explanation: `In ${relPath}:${i + 1}, the file imports module dependencies from '${mod}'.`,
        });
        continue;
      }

      // C / C++ include: #include <stdio.h> or #include "header.h"
      const cInc = line.match(/^#include\s+[<"]([^>"]+)[>"]/);
      if (cInc && cInc[1]) {
        const header = cInc[1];
        addFinding({
          id: `imp-${findings.length + 1}`,
          category: "MODULE_IMPORT",
          title: `Header Include in ${simpleFileName}`,
          filePath: relPath,
          startLine: i + 1,
          endLine: i + 1,
          codeSnippet: line,
          primaryIdentifier: header,
          correctAnswer: `It includes standard/project header '${header}'.`,
          distractors: [
            `It invokes a runtime macro expander daemon.`,
            `It forks a child process.`,
            `It registers a kernel signal hook.`,
          ],
          explanation: `In ${relPath}:${i + 1}, header '${header}' is included for compilation.`,
        });
      }
    }
  }

  logger.info(
    {
      totalFindings: findings.length,
      categoriesCount,
      primaryLanguage: scanResult.primaryLanguage,
    },
    "Universal multi-language code inspection completed."
  );

  return {
    findings,
    categoriesCount,
    totalAnalyzedFiles: scanResult.sourceFiles.length,
    primaryLanguage: scanResult.primaryLanguage,
    frameworks: scanResult.frameworks,
  };
}
