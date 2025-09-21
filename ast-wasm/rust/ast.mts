import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";

const DIRNAME = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(DIRNAME, "..", "output", "rust");
const fileA = readFileSync(join(DIRNAME, "../example/a.tst"), "utf-8");
const fileB = readFileSync(join(DIRNAME, "../example/b.tst"), "utf-8");
const fileC = readFileSync(join(DIRNAME, "../example/c.tst"), "utf-8");

// Initialize WASM module
let wasmModule: any = null;

async function initWasm() {
  if (wasmModule) return wasmModule;
  
  try {
    // Dynamic import the wasm-pack generated module
    wasmModule = await import("./pkg/ast_wasm.js");
    return wasmModule;
  } catch (error) {
    console.error("Failed to load Rust WASM module:", error);
    throw error;
  }
}

// WASM wrapper function that calls the Rust generate_ast function
async function parse(fileContents: string): Promise<any> {
  const module = await initWasm();
  
  // Call the Rust WASM generate_ast function
  const jsonString = module.generate_ast(fileContents);
  
  if (typeof jsonString !== 'string' || jsonString.startsWith('Error:')) {
    throw new Error(`WASM error: ${jsonString}`);
  }
  
  // Parse the JSON result
  return JSON.parse(jsonString);
}

let parseTotal = 0;
let iteration = 0;

async function parseFile(fileContents: string, outputFilename: string) {
  const start = performance.now();
  const ast = await parse(fileContents);
  const endParse = performance.now();
  const astJson = JSON.stringify(ast, null, "  ");
  writeFileSync(join(OUTPUT_DIR, outputFilename), astJson);
  const durationParse = endParse - start;
  parseTotal += durationParse;
  iteration++;
}

// Main execution
mkdirSync(OUTPUT_DIR, { recursive: true });
await parseFile(fileA, "a.json");
await parseFile(fileB, "b.json");
await parseFile(fileC, "c.json");

const results = {
  parse: parseTotal,
};
console.log(JSON.stringify(results, null, "  "));
