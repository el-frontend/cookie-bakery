// Does any value that must never ship actually appear in dist/?
// Compares the real .env values against the built bundle. Prints verdicts
// only — never a credential.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { loadEnv } from "vite";

const env = loadEnv("production", process.cwd(), "");

const mustNotShip = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_DB_URL",
  "SUPABASE_ACCESS_TOKEN",
];
const mustShip = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) out.push(...walk(path));
    else out.push(path);
  }
  return out;
}

const files = walk("dist");
const blob = files.map((f) => readFileSync(f, "utf8")).join("\n");

let failed = false;

for (const name of mustNotShip) {
  const value = env[name];
  if (!value) {
    console.log(`SKIP  ${name} — not set in .env, nothing to check`);
    continue;
  }
  const leaked = files.filter((f) => readFileSync(f, "utf8").includes(value));
  if (leaked.length) {
    failed = true;
    console.log(`LEAK  ${name} appears in: ${leaked.join(", ")}`);
  } else {
    console.log(`ok    ${name} is absent from the bundle`);
  }
}

for (const name of mustShip) {
  const value = env[name];
  if (!value) {
    failed = true;
    console.log(`MISSING ${name} is not set — the deployed app would fail`);
  } else if (blob.includes(value)) {
    console.log(`ok    ${name} is inlined as expected`);
  } else {
    failed = true;
    console.log(`MISSING ${name} did not reach the bundle`);
  }
}

console.log(failed ? "\nFAILED" : "\nAll checks passed.");
process.exit(failed ? 1 : 0);
