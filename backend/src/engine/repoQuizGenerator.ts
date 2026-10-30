import { IEvidenceRecord } from "../models/EvidenceRecord.js";
import { IFileAttribution } from "../models/FileAttribution.js";
import { IQuizQuestionDoc } from "../models/RepositoryQuizAttempt.js";

interface RawDetails {
  className?: string;
  category?: string;
  primaryIdentifier?: string;
  secondaryInfo?: string;
  correctAnswer?: string;
  distractors?: string[];
  explanation?: string;
  title?: string;
  codeSnippet?: string;
  verbs?: string[];
  usesResponseEntity?: boolean;
  usesResponseStatus?: boolean;
  handlerCount?: number;
  entityName?: string;
  idFieldName?: string;
  persistenceMechanism?: string;
  relationships?: string[];
  fetchTypes?: string[];
  hasCustomQuery?: boolean;
  testClassName?: string;
  testFramework?: string;
  assertionFrameworks?: string[];
  testMethodCount?: number;
  usesMockito?: boolean;
  targetClass?: string;
  validatedMethods?: string[];
  validationAnnotations?: string[];
  hasValidAnnotation?: boolean;
  handlerClass?: string;
  handledExceptions?: string[];
  usesControllerAdvice?: boolean;
  returnsProblemDetail?: boolean;
  configClass?: string;
  hasSecurityFilterChain?: boolean;
  disablesCsrf?: boolean;
  configuredMatchers?: string[];
  transactionalMethods?: string[];
  readOnlyMethods?: string[];
  jwtClass?: string;
  signsToken?: boolean;
  validatesToken?: boolean;
  whatThisShows?: string;
  [key: string]: unknown;
}

function shuffleOptions(
  correctText: string,
  distractors: string[],
  usedOptionsSet: Set<string>
): { options: string[]; correctIndex: number } {
  // Ensure distractors are unique, non-empty, and distinct from the correct text
  const cleanDistractors: string[] = [];
  for (const d of distractors) {
    const trimmed = d.trim();
    if (trimmed && trimmed !== correctText && !cleanDistractors.includes(trimmed)) {
      cleanDistractors.push(trimmed);
    }
  }

  // Fallback realistic contextual distractors if fewer than 3
  const contextualFallbacks = [
    "It initiates an unbuffered low-level socket stream for asynchronous binary frame transfers.",
    "It configures a dedicated worker thread queue to serialize background batch processing.",
    "It acts as a placeholder stub that bypasses runtime processing without persisting state.",
    "It registers an in-memory cache eviction trigger based on a least-recently-used policy.",
    "It converts input arguments into standardized hexadecimal hash digests.",
    "It pauses thread execution until an external operating system event signal fires.",
    "It maps incoming payload attributes to transient unvalidated transfer buffers.",
    "It executes a linear search across unsorted memory structures.",
  ];

  for (const fb of contextualFallbacks) {
    if (cleanDistractors.length >= 3) break;
    if (fb !== correctText && !cleanDistractors.includes(fb) && !usedOptionsSet.has(fb)) {
      cleanDistractors.push(fb);
    }
  }

  const chosenDistractors = cleanDistractors.slice(0, 3);
  const options = [...chosenDistractors, correctText];

  // Fisher-Yates shuffle
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = options[i]!;
    options[i] = options[j]!;
    options[j] = temp;
  }

  const correctIndex = options.indexOf(correctText);

  // Track options to ensure diversity across questions
  for (const opt of options) {
    usedOptionsSet.add(opt);
  }

  return { options, correctIndex };
}

export function generateQuizForRepository(
  repoFullName: string,
  evidenceRecords: IEvidenceRecord[],
  attributions: IFileAttribution[]
): IQuizQuestionDoc[] {
  const questions: IQuizQuestionDoc[] = [];
  const usedOptionsSet = new Set<string>();
  const TARGET_QUESTIONS = 10;
  const MAX_QUESTIONS = 20;

  // Track question categories already added to ensure broad question type coverage
  const categoryCounts: Record<string, number> = {};

  for (const ev of evidenceRecords) {
    if (questions.length >= MAX_QUESTIONS) break;

    const details = (ev.rawDetails || {}) as RawDetails;
    const fileRef = `${ev.filePath || "Source file"}:L${ev.startLine || 1}-L${ev.endLine || 100}`;
    const simpleFileName = (ev.filePath || "").split("/").pop() || "source";

    if (details.category) {
      const cat = details.category;
      const primaryId = details.primaryIdentifier || simpleFileName;
      const snippet = ev.matchedPattern || (typeof details.codeSnippet === "string" ? details.codeSnippet : undefined);
      const customDistractors = Array.isArray(details.distractors) && details.distractors.length >= 3
        ? (details.distractors as string[])
        : [];

      switch (cat) {
        // 1. AI, Machine Learning & Data Science
        case "AI_ML_MODEL": {
          const correctText = details.correctAnswer || `It configures machine learning model/training operations for '${primaryId}'.`;
          const altDistractors = customDistractors.length >= 3 ? customDistractors : [
            `It trains an unsupervised K-Means clustering algorithm optimizing inertia across centroids.`,
            `It computes cross-validation loss without adjusting backpropagation gradient weights.`,
            `It exports raw uncompressed feature tensors to an external distributed cloud storage bucket.`,
          ];
          const shuffled = shuffleOptions(correctText, altDistractors, usedOptionsSet);
          questions.push({
            id: `q-${questions.length + 1}-ml`,
            category: "Machine Learning & AI",
            skillSlug: ev.skillSlug || "transaction-management",
            title: details.title || `Machine Learning Logic in ${simpleFileName}`,
            question: `In ${ev.filePath}, what machine learning task or training behavior is performed by '${primaryId}'?`,
            fileReference: fileRef,
            codeSnippet: snippet,
            options: shuffled.options,
            correctOptionIndex: shuffled.correctIndex,
            explanation: details.explanation || `In ${fileRef}, this code coordinates machine learning model execution.`,
          });
          break;
        }

        // 2. API Routes & Endpoints
        case "API_ROUTE": {
          const correctText = details.correctAnswer || `It registers an HTTP endpoint handling [${primaryId}] on the configured router.`;
          const altDistractors = customDistractors.length >= 3 ? customDistractors : [
            `It configures an unauthenticated WebSocket heartbeat broadcast channel.`,
            `It defines a background message queue listener processing async event tasks.`,
            `It sets up a static file mount streaming raw disk directories over HTTP.`,
          ];
          const shuffled = shuffleOptions(correctText, altDistractors, usedOptionsSet);
          questions.push({
            id: `q-${questions.length + 1}-api-route`,
            category: "API Routes & Endpoints",
            skillSlug: ev.skillSlug || "rest-controller-design",
            title: details.title || `API Route in ${ev.filePath}`,
            question: `Based on ${ev.filePath}, what HTTP route and request method does this handler configure?`,
            fileReference: fileRef,
            codeSnippet: snippet,
            options: shuffled.options,
            correctOptionIndex: shuffled.correctIndex,
            explanation: details.explanation || `In ${fileRef}, the router defines a handler accepting ${primaryId}.`,
          });
          break;
        }

        // 3. Database Models & Persistence
        case "DATA_MODEL": {
          const correctText = details.correctAnswer || `It defines database schema and persistence mapping for the ${primaryId} model/entity.`;
          const altDistractors = customDistractors.length >= 3 ? customDistractors : [
            `It establishes a raw Redis pub/sub replication channel without table schema definition.`,
            `It creates an ephemeral in-memory cache token that expires after 60 seconds.`,
            `It configures an external Elasticsearch indexing webhook for document search.`,
          ];
          const shuffled = shuffleOptions(correctText, altDistractors, usedOptionsSet);
          questions.push({
            id: `q-${questions.length + 1}-data-model`,
            category: "Database & Data Persistence",
            skillSlug: ev.skillSlug || "jpa-hibernate-persistence",
            title: details.title || `Data Model ${primaryId} in ${simpleFileName}`,
            question: `What data persistence entity or schema structure is declared in ${ev.filePath}?`,
            fileReference: fileRef,
            codeSnippet: snippet,
            options: shuffled.options,
            correctOptionIndex: shuffled.correctIndex,
            explanation: details.explanation || `In ${fileRef}, the schema defines fields and table/collection mapping for ${primaryId}.`,
          });
          break;
        }

        // 4. Function Logic & Behavior
        case "FUNCTION_LOGIC": {
          const correctText = details.correctAnswer || `It implements the business function ${primaryId} with parameters ${details.secondaryInfo || "provided"}.`;
          const altDistractors = customDistractors.length >= 3 ? customDistractors : [
            `It immediately aborts execution and logs a fatal error stack trace to standard error.`,
            `It parses operating system command-line arguments passed at binary launch time.`,
            `It sends unencrypted heartbeat packets over an outbound network UDP socket.`,
          ];
          const shuffled = shuffleOptions(correctText, altDistractors, usedOptionsSet);
          questions.push({
            id: `q-${questions.length + 1}-fn-logic`,
            category: "Function & Method Behavior",
            skillSlug: ev.skillSlug || "transaction-management",
            title: details.title || `Function ${primaryId}() in ${simpleFileName}`,
            question: `In ${ev.filePath}, what operation or business logic is implemented by ${primaryId}?`,
            fileReference: fileRef,
            codeSnippet: snippet,
            options: shuffled.options,
            correctOptionIndex: shuffled.correctIndex,
            explanation: details.explanation || `In ${fileRef}, the function implements core application behavior.`,
          });
          break;
        }

        // 5. Object-Oriented Architecture & Classes
        case "CLASS_DESIGN": {
          const correctText = details.correctAnswer || `It defines class/struct '${primaryId}' to manage domain state and behavior.`;
          const altDistractors = customDistractors.length >= 3 ? customDistractors : [
            `It acts as a build script hook for Webpack/Babel compilation.`,
            `It registers a global operating system signal listener for SIGINT.`,
            `It declares an abstract stub mock that throws NotImplementedError on all invocations.`,
          ];
          const shuffled = shuffleOptions(correctText, altDistractors, usedOptionsSet);
          questions.push({
            id: `q-${questions.length + 1}-class-design`,
            category: "Architecture & Class Design",
            skillSlug: ev.skillSlug || "dependency-injection-inversion",
            title: details.title || `Class ${primaryId} in ${simpleFileName}`,
            question: `In ${ev.filePath}, what role does class/struct ${primaryId} fulfill in the application architecture?`,
            fileReference: fileRef,
            codeSnippet: snippet,
            options: shuffled.options,
            correctOptionIndex: shuffled.correctIndex,
            explanation: details.explanation || `In ${fileRef}, class ${primaryId} encapsulates domain state and methods.`,
          });
          break;
        }

        // 6. Data Structures & State
        case "DATA_STRUCTURE": {
          const correctText = details.correctAnswer || `It initializes a data structure or collection for '${primaryId}'.`;
          const altDistractors = customDistractors.length >= 3 ? customDistractors : [
            `It opens a persistent binary file stream to disk without in-memory buffering.`,
            `It parses XML configuration options from standard input.`,
            `It clears memory heap allocations to force immediate garbage collection.`,
          ];
          const shuffled = shuffleOptions(correctText, altDistractors, usedOptionsSet);
          questions.push({
            id: `q-${questions.length + 1}-data-struct`,
            category: "Data Structures & State",
            skillSlug: ev.skillSlug || "jpa-hibernate-persistence",
            title: details.title || `Data Structure '${primaryId}' in ${simpleFileName}`,
            question: `In ${ev.filePath}, how is '${primaryId}' structured and used to manage application data?`,
            fileReference: fileRef,
            codeSnippet: snippet,
            options: shuffled.options,
            correctOptionIndex: shuffled.correctIndex,
            explanation: details.explanation || `In ${fileRef}, '${primaryId}' manages key game or application data.`,
          });
          break;
        }

        // 7. Control Flow & Algorithm Execution
        case "FLOW_CONTROL":
        case "ALGORITHM_LOGIC": {
          const correctText = details.correctAnswer || `It controls iterative application execution using '${primaryId}'.`;
          const altDistractors = customDistractors.length >= 3 ? customDistractors : [
            `It performs a binary tree search across unordered memory pointers.`,
            `It forks a concurrent background child process for each loop iteration.`,
            `It schedules asynchronous promises concurrently on the microtask queue.`,
          ];
          const shuffled = shuffleOptions(correctText, altDistractors, usedOptionsSet);
          questions.push({
            id: `q-${questions.length + 1}-flow-ctrl`,
            category: "Algorithm & Control Flow",
            skillSlug: ev.skillSlug || "transaction-management",
            title: details.title || `Control Flow in ${simpleFileName}`,
            question: `In ${ev.filePath}, how does the loop/control structure '${primaryId}' govern program flow?`,
            fileReference: fileRef,
            codeSnippet: snippet,
            options: shuffled.options,
            correctOptionIndex: shuffled.correctIndex,
            explanation: details.explanation || `In ${fileRef}, the control structure coordinates iterative execution.`,
          });
          break;
        }

        // 8. Input, Output & Persistence
        case "IO_OPERATION": {
          const correctText = details.correctAnswer || `It performs input/output operations interacting with the user or storage.`;
          const altDistractors = customDistractors.length >= 3 ? customDistractors : [
            `It streams raw audio frames to an external sound card driver.`,
            `It opens an unencrypted FTP socket connection to an external remote server.`,
            `It executes a raw SQL transaction commit.`,
          ];
          const shuffled = shuffleOptions(correctText, altDistractors, usedOptionsSet);
          questions.push({
            id: `q-${questions.length + 1}-io-op`,
            category: "Input / Output & Persistence",
            skillSlug: ev.skillSlug || "rest-controller-design",
            title: details.title || `I/O Operation in ${simpleFileName}`,
            question: `In ${ev.filePath}, how does the application handle console input, output, or file operations?`,
            fileReference: fileRef,
            codeSnippet: snippet,
            options: shuffled.options,
            correctOptionIndex: shuffled.correctIndex,
            explanation: details.explanation || `In ${fileRef}, the program executes I/O operations to interact with user or disk.`,
          });
          break;
        }

        // 9. Frontend UI & React Components
        case "FRONTEND_UI":
        case "REACT_COMPONENT": {
          const correctText = details.correctAnswer || `It manages user interface components or reactive state for '${primaryId}'.`;
          const altDistractors = customDistractors.length >= 3 ? customDistractors : [
            `It compiles native WebAssembly binary modules at runtime in the browser.`,
            `It registers a service worker cache intercepting all external network fetches.`,
            `It executes server-side database migrations directly from the client window.`,
          ];
          const shuffled = shuffleOptions(correctText, altDistractors, usedOptionsSet);
          questions.push({
            id: `q-${questions.length + 1}-frontend`,
            category: "Frontend & User Interface",
            skillSlug: ev.skillSlug || "rest-controller-design",
            title: details.title || `Frontend Component '${primaryId}' in ${simpleFileName}`,
            question: `In ${ev.filePath}, how does '${primaryId}' manage user interface presentation or state?`,
            fileReference: fileRef,
            codeSnippet: snippet,
            options: shuffled.options,
            correctOptionIndex: shuffled.correctIndex,
            explanation: details.explanation || `In ${fileRef}, the component binds state and layout to user interface rendering.`,
          });
          break;
        }

        // 10. Testing & Assertions
        case "TEST_SUITE": {
          const correctText = details.correctAnswer || `It runs automated test assertions verifying: "${primaryId}".`;
          const altDistractors = customDistractors.length >= 3 ? customDistractors : [
            `It measures network latency by sending ICMP ping packets to localhost.`,
            `It generates randomized mock load testing payloads without validating behavior.`,
            `It dumps diagnostic heap profiles into an uncompressed binary file.`,
          ];
          const shuffled = shuffleOptions(correctText, altDistractors, usedOptionsSet);
          questions.push({
            id: `q-${questions.length + 1}-test-suite`,
            category: "Testing & Debugging",
            skillSlug: ev.skillSlug || "unit-tests-meaningful-assertions",
            title: details.title || `Test Case in ${simpleFileName}`,
            question: `In test file ${ev.filePath}, what software contract or behavior is asserted by this test?`,
            fileReference: fileRef,
            codeSnippet: snippet,
            options: shuffled.options,
            correctOptionIndex: shuffled.correctIndex,
            explanation: details.explanation || `In ${fileRef}, the test executes assertions verifying expected software behavior.`,
          });
          break;
        }

        // 11. Error Handling & Defensive Checks
        case "ERROR_HANDLING": {
          const correctText = details.correctAnswer || `It catches exceptions or intercepts errors to handle failures gracefully.`;
          const altDistractors = customDistractors.length >= 3 ? customDistractors : [
            `It halts the entire server process whenever any minor input error is encountered.`,
            `It ignores all runtime exceptions and converts error objects into empty strings.`,
            `It writes core dump memory dumps to standard output on every caught warning.`,
          ];
          const shuffled = shuffleOptions(correctText, altDistractors, usedOptionsSet);
          questions.push({
            id: `q-${questions.length + 1}-error-handling`,
            category: "Error & Exception Handling",
            skillSlug: ev.skillSlug || "structured-exception-handling",
            title: details.title || `Exception Handling in ${simpleFileName}`,
            question: `How does ${ev.filePath} handle runtime exceptions or unexpected failures?`,
            fileReference: fileRef,
            codeSnippet: snippet,
            options: shuffled.options,
            correctOptionIndex: shuffled.correctIndex,
            explanation: details.explanation || `In ${fileRef}, defensive error handling prevents unhandled crashes.`,
          });
          break;
        }

        // 12. Modular Architecture & Imports
        case "MODULE_IMPORT":
        case "DEPENDENCY": {
          const correctText = details.correctAnswer || `It imports module dependencies to provide modular functionality.`;
          const altDistractors = customDistractors.length >= 3 ? customDistractors : [
            `It downloads unverified external dependencies over insecure HTTP at runtime.`,
            `It launches an external bash subprocess running arbitrary shell commands.`,
            `It dynamically recompiles binary shared libraries on module invocation.`,
          ];
          const shuffled = shuffleOptions(correctText, altDistractors, usedOptionsSet);
          questions.push({
            id: `q-${questions.length + 1}-module-imp`,
            category: "Dependencies & Ecosystem",
            skillSlug: ev.skillSlug || "build-tool-dependency-graph",
            title: details.title || `Module Import in ${simpleFileName}`,
            question: `In ${ev.filePath}, what dependency or module does this import bring into scope?`,
            fileReference: fileRef,
            codeSnippet: snippet,
            options: shuffled.options,
            correctOptionIndex: shuffled.correctIndex,
            explanation: details.explanation || `In ${fileRef}, the import statement brings '${primaryId}' into package scope.`,
          });
          break;
        }

        default: {
          const correctText = details.correctAnswer || `It implements ${primaryId} as an integral architectural component.`;
          const altDistractors = customDistractors.length >= 3 ? customDistractors : [
            `It acts as an unused deprecated stub slated for deletion.`,
            `It initializes an external VPN tunnel connecting to private network gateways.`,
            `It executes hardware diagnostics testing CPU instruction pipelining.`,
          ];
          const shuffled = shuffleOptions(correctText, altDistractors, usedOptionsSet);
          questions.push({
            id: `q-${questions.length + 1}-arch`,
            category: "Software Architecture",
            skillSlug: ev.skillSlug || "spring-security-configuration",
            title: details.title || `Architecture Component ${primaryId}`,
            question: `What architectural role does ${primaryId} fulfill in ${ev.filePath}?`,
            fileReference: fileRef,
            codeSnippet: snippet,
            options: shuffled.options,
            correctOptionIndex: shuffled.correctIndex,
            explanation: details.explanation || `In ${fileRef}, ${primaryId} organizes application responsibilities.`,
          });
          break;
        }
      }
      continue;
    }

    // Legacy Spring AST findings support
    switch (ev.skillSlug) {
      case "rest-controller-design": {
        const className = details.className || simpleFileName.replace(".java", "");
        const verbs = (details.verbs && details.verbs.length > 0) ? details.verbs : ["GET", "POST"];
        const verbList = verbs.join(", ");

        const q1Correct = `It exposes endpoints accepting HTTP [${verbList}] requests with parameter binding.`;
        const q1Distractors = [
          "It only supports SOAP XML envelopes over JMS message brokers.",
          "It is an unmapped internal service with no public HTTP endpoints exposed.",
          "It only handles raw WebSocket binary frame streaming with no REST verbs.",
        ];
        const q1 = shuffleOptions(q1Correct, q1Distractors, usedOptionsSet);
        questions.push({
          id: `q-${questions.length + 1}-rest-verbs`,
          category: "REST APIs",
          skillSlug: "rest-controller-design",
          title: `REST Controller Routing in ${className}`,
          question: `Based on ${ev.filePath}, which HTTP request methods are handled by the ${className} controller?`,
          fileReference: fileRef,
          codeSnippet: ev.matchedPattern,
          options: q1.options,
          correctOptionIndex: q1.correctIndex,
          explanation: `In ${fileRef}, ${className} is mapped to handle HTTP ${verbList} requests.`,
        });
        break;
      }

      case "jpa-hibernate-persistence": {
        const entityName = details.entityName || simpleFileName.replace(".java", "");
        const idField = details.idFieldName || "id";
        const mechanism = details.persistenceMechanism ? ` via ${details.persistenceMechanism}` : "";
        const q1Correct = `It maps table persistence with '@Id' primary key attribute '${idField}'${mechanism}.`;
        const q1Distractors = [
          "It is an ephemeral in-memory cache without database schema mapping.",
          "It reads fixed static JSON records from the classpath without database integration.",
          "It is a volatile transport DTO excluded from ORM persistence.",
        ];
        const q1 = shuffleOptions(q1Correct, q1Distractors, usedOptionsSet);
        questions.push({
          id: `q-${questions.length + 1}-jpa-entity`,
          category: "Database & Data Persistence",
          skillSlug: "jpa-hibernate-persistence",
          title: `Entity Mapping for ${entityName}`,
          question: `In ${ev.filePath}, how does the ${entityName} class configure its primary identity for persistence?`,
          fileReference: fileRef,
          codeSnippet: ev.matchedPattern,
          options: q1.options,
          correctOptionIndex: q1.correctIndex,
          explanation: `In ${fileRef}, '${entityName}' declares '@Id' on '${idField}' to satisfy entity identity.`,
        });
        break;
      }

      case "unit-tests-meaningful-assertions": {
        const testClass = details.testClassName || simpleFileName.replace(".java", "");
        const framework = details.testFramework || "JUnit";
        const qCorrect = `It uses ${framework} test assertions to verify business invariants.`;
        const qDistractors = [
          "It is a load test benchmark without functional assertion checks.",
          "It generates test fixtures without running assertions.",
          "It only logs test execution times without pass/fail criteria.",
        ];
        const q = shuffleOptions(qCorrect, qDistractors, usedOptionsSet);
        questions.push({
          id: `q-${questions.length + 1}-unit-test`,
          category: "Testing & Debugging",
          skillSlug: "unit-tests-meaningful-assertions",
          title: `Test Verification in ${testClass}`,
          question: `In ${ev.filePath}, how does ${testClass} assert software behavior?`,
          fileReference: fileRef,
          codeSnippet: ev.matchedPattern,
          options: q.options,
          correctOptionIndex: q.correctIndex,
          explanation: `In ${fileRef}, ${testClass} verifies correctness using ${framework} assertions.`,
        });
        break;
      }

      case "input-validation": {
        const targetClass = details.targetClass || simpleFileName.replace(".java", "");
        const qCorrect = `It applies declarative Bean Validation constraints to reject invalid client inputs.`;
        const qDistractors = [
          "It relies entirely on manual try/catch checks in the client browser.",
          "It accepts all payloads unvalidated and sanitizes only on database failure.",
          "It rejects all requests exceeding 256 bytes regardless of structure.",
        ];
        const q = shuffleOptions(qCorrect, qDistractors, usedOptionsSet);
        questions.push({
          id: `q-${questions.length + 1}-validation`,
          category: "Security & Validation",
          skillSlug: "input-validation",
          title: `Payload Validation in ${targetClass}`,
          question: `In ${ev.filePath}, how does the code enforce data integrity for incoming requests?`,
          fileReference: fileRef,
          codeSnippet: ev.matchedPattern,
          options: q.options,
          correctOptionIndex: q.correctIndex,
          explanation: `In ${fileRef}, input validation rules reject malformed payloads.`,
        });
        break;
      }

      case "structured-exception-handling": {
        const handlerClass = details.handlerClass || simpleFileName.replace(".java", "");
        const qCorrect = `It intercepts unhandled errors and maps them to structured HTTP error responses.`;
        const qDistractors = [
          "It writes stack traces to standard error and halts the JVM process.",
          "It returns HTTP 200 OK for all exceptions to avoid alarming clients.",
          "It redirects failed requests to an external search engine query.",
        ];
        const q = shuffleOptions(qCorrect, qDistractors, usedOptionsSet);
        questions.push({
          id: `q-${questions.length + 1}-exception-handler`,
          category: "Error & Exception Handling",
          skillSlug: "structured-exception-handling",
          title: `Global Exception Handling in ${handlerClass}`,
          question: `In ${ev.filePath}, how are exceptions managed by ${handlerClass}?`,
          fileReference: fileRef,
          codeSnippet: ev.matchedPattern,
          options: q.options,
          correctOptionIndex: q.correctIndex,
          explanation: `In ${fileRef}, structured exception handling maps errors to appropriate HTTP responses.`,
        });
        break;
      }

      default:
        break;
    }
  }

  // GUARANTEE: If a repository has source files but fewer than 10 questions were generated from findings,
  // generate verified architectural and implementation questions from the analyzed file attributions.
  if (questions.length > 0 && questions.length < TARGET_QUESTIONS && attributions.length > 0) {
    const existingFileRefs = new Set(questions.map((q) => q.fileReference.split(":")[0]));

    for (const attr of attributions) {
      if (questions.length >= TARGET_QUESTIONS) break;
      const filePath = attr.filePath;
      const baseName = filePath.split("/").pop() || filePath;
      const ext = filePath.split(".").pop()?.toLowerCase();

      // Skip files already heavily quizzed or non-source files
      if (existingFileRefs.has(filePath) && attributions.length > questions.length) {
        continue;
      }

      const fileRef = `${filePath}:L1-L${Math.min(attr.totalLines || 50, 50)}`;
      const totalLines = attr.totalLines || 30;

      let cat = "Code Understanding";
      let roleDesc = `manages core application routines with approximately ${totalLines} lines of implementation`;
      let dist1 = "It acts as a build tool configuration schema without executable code.";
      let dist2 = "It is an unlinked legacy migration file excluded from active compilation.";
      let dist3 = "It serves as an external third-party binary asset.";

      if (baseName.includes("main") || baseName.includes("index") || baseName.includes("app")) {
        cat = "Architecture Understanding";
        roleDesc = `serves as an application entry point coordinating startup and execution flow`;
        dist1 = "It acts solely as an offline unit test fixture.";
        dist2 = "It is an unreferenced temporary scratch file.";
        dist3 = "It stores encrypted user credential hashes.";
      } else if (baseName.includes("game") || baseName.includes("logic") || baseName.includes("service") || baseName.includes("controller")) {
        cat = "Function & Method Behavior";
        roleDesc = `encapsulates business rules, state updates, and domain operations`;
        dist1 = "It defines database table indexing metadata without operational logic.";
        dist2 = "It manages low-level operating system thread scheduling.";
        dist3 = "It is a generated translation dictionary for multi-language locales.";
      } else if (baseName.includes("score") || baseName.includes("player") || baseName.includes("model") || baseName.includes("word") || baseName.includes("hint")) {
        cat = "Data Structures & State";
        roleDesc = `maintains domain state, player data, or collection structures`;
        dist1 = "It establishes a raw WebSocket proxy tunnel to remote services.";
        dist2 = "It compiles client-side assets into optimized CSS bundles.";
        dist3 = "It executes cryptographic SSL certificate verification.";
      }

      const correctText = `It ${roleDesc} in '${baseName}'.`;
      const shuffled = shuffleOptions(correctText, [dist1, dist2, dist3], usedOptionsSet);

      questions.push({
        id: `q-${questions.length + 1}-arch-role`,
        category: cat,
        skillSlug: "spring-security-configuration",
        title: `Component Architecture in ${baseName}`,
        question: `In project file ${filePath}, what architectural role does this module perform?`,
        fileReference: fileRef,
        codeSnippet: `// File: ${filePath} (${totalLines} lines)`,
        options: shuffled.options,
        correctOptionIndex: shuffled.correctIndex,
        explanation: `In ${fileRef}, ${baseName} organizes project capabilities and structure.`,
      });

      existingFileRefs.add(filePath);
    }
  }

  return questions;
}
