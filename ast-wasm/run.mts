import { execSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { copyFileSync } from "node:fs";

const ITERATIONS = 25;

const BASE_DIR = dirname(fileURLToPath(import.meta.url));

const commands = {
  go: {
    setupCommands: [
      `GOOS=js GOARCH=wasm go build -o main.wasm main.go`,
    ],
    command: "npx",
    args: ["tsx", "ast.mts"],
    env: {},
    cwd: join(BASE_DIR, "go"),
  },
  rust: {
    setupCommands: [
      `RUSTFLAGS=\"-Awarnings\" wasm-pack build --quiet --target nodejs --out-dir pkg`,
    ],
    command: "npx",
    args: ["tsx", "ast.mts"],
    env: {},
    cwd: join(BASE_DIR, "rust"),
  },
  c: {
    setupCommands: [
      `emcc wasm_ast.c -o wasm_ast.js \
-s EXPORTED_FUNCTIONS='["_generateAst", "_malloc", "_free"]' \
-s EXPORTED_RUNTIME_METHODS='["UTF8ToString", "stringToUTF8"]' \
-s MODULARIZE=1 \
-s EXPORT_ES6=1 \
-s ENVIRONMENT=node \
-s ALLOW_MEMORY_GROWTH=1 \
-O3 \
-s NO_EXIT_RUNTIME=1`,
    ],
    command: "npx",
    args: ["tsx", "ast.mts"],
    env: {},
    cwd: join(BASE_DIR, "c"),
  },
  // Include original js for comparison
  js: {
    setupCommands: [],
    command: "npx",
    args: ["tsx", "ast.mts"],
    env: {},
    cwd: join(BASE_DIR, "../ast/js"),
  },
};

type Languages = keyof typeof commands;

const results: Record<Languages, { parse: number; marshal: number }[]> = {
  go: [],
  rust: [],
  c: [],
  js: [],
};

async function runBenchmarks() {
  for (const [name, command] of Object.entries(commands)) {
    console.log(`\n=== Benchmarking ${name} ===`);

    // Run setup commands
    for (const setupCommand of command.setupCommands) {
      console.log(`Running setup: ${setupCommand}`);
      try {
        execSync(setupCommand, {
          cwd: command.cwd,
          stdio: "inherit",
        });
      } catch (error) {
        console.error(
          `✗ Setup failed:`,
          error instanceof Error ? error.message : String(error)
        );
        process.exit(1);
      }
    }
    console.log(`✓ Setup completed`);

    // Run main command
    for (let i = 0; i < ITERATIONS; i++) {
      try {
        const result = spawnSync(command.command, command.args, {
          env: { ...process.env, ...command.env },
          cwd: command.cwd,
          stdio: ["inherit", "pipe", "inherit"],
        });

        if (result.error) {
          console.error(`✗ Command failed:`, result.error.message);
        } else if (result.status !== 0) {
          console.error(`✗ Command exited with code ${result.status}`);
          if (result.stdout) {
            console.error("stdout:", result.stdout.toString());
          }
          if (result.stderr) {
            console.error("stderr:", result.stderr.toString());
          }
        } else {
          console.log(`✓ ${name} iteration ${i + 1} completed successfully`);

          // Parse and pretty print JSON results
          try {
            const output = result.stdout.toString().trim();
            const parsedResult = JSON.parse(output);
            results[name as Languages].push(parsedResult);
          } catch (parseError) {
            console.error(`✗ Failed to parse JSON output from ${name}:`);
            console.error("Raw output:", result.stdout.toString());
            console.error(
              "Parse error:",
              parseError instanceof Error
                ? parseError.message
                : String(parseError)
            );
          }
        }
      } catch (error) {
        console.error(
          `✗ Error running ${name}:`,
          error instanceof Error ? error.message : String(error)
        );
      }
    }
    console.log(`📊 Result median values for ${name}:`);
    const medianParse = results[name as Languages]
      .map((r) => r.parse)
      .sort((a, b) => a - b)[Math.floor(ITERATIONS / 2)]!;
    console.log(`   Parse time:   ${medianParse.toFixed(2)}ms`);
  }
}

// Run the benchmarks
await runBenchmarks();

console.log(`\n=== FINAL COMPARISON ===`);
for (const [language, result] of Object.entries(results)) {
  console.log(`\n=== ${language.toUpperCase()} ===`);
  const medianParse = result.map((r) => r.parse).sort((a, b) => a - b)[
    Math.floor(ITERATIONS / 2)
  ]!;
  console.log(`Parse time:   ${medianParse.toFixed(2)}ms`);
}
