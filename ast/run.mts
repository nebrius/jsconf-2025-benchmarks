import { execSync, spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ITERATIONS = 25;

const BASE_DIR = dirname(fileURLToPath(import.meta.url));

const commands = {
  rust: {
    setupCommands: ["RUSTFLAGS=\"-Awarnings\" cargo build --release --quiet"],
    command: "./target/release/ast-rust",
    args: [],
    env: {},
    cwd: join(BASE_DIR, "rust"),
  },
  go: {
    setupCommands: [],
    command: "go",
    args: ["run", "ast.go"],
    env: {},
    cwd: join(BASE_DIR, "go"),
  },
  js: {
    setupCommands: [],
    command: "npx",
    args: ["tsx", "ast.mts"],
    env: {},
    cwd: join(BASE_DIR, "js"),
  },
  c: {
    setupCommands: ["mkdir -p build", "gcc -O3 -o build/ast ast.c"],
    command: "./build/ast",
    args: [],
    env: {},
    cwd: join(BASE_DIR, "c"),
  },
};

type Languages = keyof typeof commands;

const results: Record<Languages, { parse: number; marshal: number }[]> = {
  rust: [],
  go: [],
  js: [],
  c: [],
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
        console.log(`✓ Setup completed`);
      } catch (error) {
        console.error(
          `✗ Setup failed:`,
          error instanceof Error ? error.message : String(error)
        );
        continue;
      }
    }

    // Run main command
    for (let i = 0; i < ITERATIONS; i++) {
      try {
        const result = spawnSync(command.command, command.args, {
          env: { ...process.env, ...command.env },
          cwd: command.cwd,
          stdio: "inherit",
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
          console.log(`✓ ${name} completed successfully`);

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
    const medianMarshal = results[name as Languages]
      .map((r) => r.marshal)
      .sort((a, b) => a - b)[Math.floor(ITERATIONS / 2)]!;
    const medianTotal = results[name as Languages]
      .map((r) => r.parse + r.marshal)
      .sort((a, b) => a - b)[Math.floor(ITERATIONS / 2)]!;
    console.log(`   Parse time:   ${medianParse.toFixed(2)}ms`);
    console.log(`   Marshal time: ${medianMarshal.toFixed(2)}ms`);
    console.log(`   Total time:   ${medianTotal.toFixed(2)}ms`);
  }
}

// Run the benchmarks
await runBenchmarks();

for (const [language, result] of Object.entries(results)) {
  console.log(`\n=== ${language} ===`);
  const medianParse = result.map((r) => r.parse).sort((a, b) => a - b)[
    Math.floor(ITERATIONS / 2)
  ]!;
  const medianMarshal = result.map((r) => r.marshal).sort((a, b) => a - b)[
    Math.floor(ITERATIONS / 2)
  ]!;
  const medianTotal = result
    .map((r) => r.parse + r.marshal)
    .sort((a, b) => a - b)[Math.floor(ITERATIONS / 2)]!;
  console.log(`Parse time:   ${medianParse.toFixed(2)}ms`);
  console.log(`Marshal time: ${medianMarshal.toFixed(2)}ms`);
  console.log(`Total time:   ${medianTotal.toFixed(2)}ms`);
}
