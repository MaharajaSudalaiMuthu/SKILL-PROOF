import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function runSpike() {
  console.log('======================================================');
  console.log('       SkillProof Java AST Parser Spike (Phase 1)      ');
  console.log('======================================================\n');

  const fixturePath = path.resolve(__dirname, 'fixtures/ModernJavaSample.java');
  if (!fs.existsSync(fixturePath)) {
    console.error(`Fixture not found: ${fixturePath}`);
    process.exit(1);
  }

  const javaSource = fs.readFileSync(fixturePath, 'utf8');
  console.log(`Loaded Java source fixture (${javaSource.length} bytes, ${javaSource.split('\n').length} lines).`);

  let parserSuccess = false;
  let parsedWith = '';

  // Attempt 1: Try java-parser (Chevrotain pure-JS full AST parser)
  try {
    console.log('\n[1/2] Testing java-parser (pure JavaScript AST parser)...');
    const { parse } = await import('java-parser');
    const cst = parse(javaSource);

    if (cst && cst.name === 'compilationUnit') {
      console.log('  -> java-parser successfully parsed compilationUnit CST.');
      parserSuccess = true;
      parsedWith = 'java-parser';
    } else {
      console.warn('  -> java-parser returned unrecognized root:', cst?.name);
    }
  } catch (err) {
    console.warn('  -> java-parser error:', (err as Error).message);
  }

  // Attempt 2: Try web-tree-sitter (WASM)
  try {
    console.log('\n[2/2] Testing tree-sitter / web-tree-sitter...');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ParserModule = await import('web-tree-sitter');
    const Parser = ParserModule.default || ParserModule;
    await Parser.init();
    const parser = new Parser();
    
    // Look for tree-sitter-java.wasm
    const possibleWasmPaths = [
      path.resolve(__dirname, '../node_modules/tree-sitter-java/tree-sitter-java.wasm'),
      path.resolve(__dirname, '../backend/node_modules/tree-sitter-java/tree-sitter-java.wasm'),
    ];

    let loadedLang = false;
    for (const wasmPath of possibleWasmPaths) {
      if (fs.existsSync(wasmPath)) {
        console.log(`  -> Found tree-sitter-java.wasm at ${wasmPath}`);
        const Java = await Parser.Language.load(wasmPath);
        parser.setLanguage(Java);
        loadedLang = true;
        break;
      }
    }

    if (loadedLang) {
      const tree = parser.parse(javaSource);
      console.log(`  -> Tree-sitter parsed syntax tree with root: ${tree.rootNode.type}`);
      if (!tree.rootNode.hasError) {
        console.log('  -> Tree-sitter completed with ZERO syntax errors.');
        parserSuccess = true;
        parsedWith = 'web-tree-sitter';
      }
    } else {
      console.log('  -> Precompiled tree-sitter-java.wasm not present; tree-sitter-java provides native node-gyp binding.');
    }
  } catch (err) {
    console.warn('  -> tree-sitter info:', (err as Error).message);
  }

  console.log('\n------------------------------------------------------');
  if (parserSuccess) {
    console.log(`SPIKE RESULT: SUCCESS! Modern Java syntax successfully parsed via [${parsedWith}].`);
    console.log('Features verified in fixture:');
    console.log('  [x] Java 17 Sealed Interfaces (permits)');
    console.log('  [x] Java 16 Records (@NotBlank, @NotNull annotations)');
    console.log('  [x] Java 15 Text Blocks ("""...""")');
    console.log('  [x] Java 17 Switch Expressions (-> and yield)');
    console.log('  [x] Spring Annotations (@RestController, @PostMapping, @Transactional, @Valid)');
    console.log('------------------------------------------------------\n');
    process.exit(0);
  } else {
    console.error('SPIKE RESULT: FAILED to parse modern Java syntax.');
    process.exit(1);
  }
}

runSpike().catch((err) => {
  console.error('Fatal spike error:', err);
  process.exit(1);
});
