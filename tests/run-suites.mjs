#!/usr/bin/env node
/* THE PROJECT TEST RUNNER.

   Runs all eight suites and reports, for each, the number of assertions
   that ACTUALLY RAN (counted) against the number the suite declares and the
   number this runner expects. Exits non-zero on any failure or any count
   mismatch.

   WHY THE COUNTS MATTER. Each suite used to return a hardcoded `total:`.
   On 15 Oct a batch of assertions silently failed to insert into a suite
   and the run still reported "155/155 PASS": the literal was echoed back,
   nothing counted it. Counting then showed five of the eight declared
   totals had been wrong for weeks, in both directions, while the summed
   totals happened to agree within one. So:

     counted   what ran. The only number to trust.
     declared  the literal the suite still carries, kept as a tripwire for
               assertions that are silently DELETED, which counting alone
               cannot see.
     expected  this runner's own figure. Change it deliberately, never to
               make a red run green.

   NOTE ON THIS PROJECT'S MACHINE: Devon's machine has no node, npm or deno
   installed, so he cannot run this file. It is here for whoever can execute
   it (CI, or any other machine). The browser fallback described in
   tests/README.md is what gets run when there is no node.

   Usage:  node tests/run-suites.mjs
*/
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const repo = join(here, "..");
const shared = join(repo, "public", "app", "shared");
const lib = join(repo, "netlify", "edge-functions", "lib");

/* Two shims, both for things the edge/browser runtimes provide and node
   does not need to be told twice about. Neither is touched by any path
   under test: clarity-chat reads Deno.env only inside handler(). */
if (typeof globalThis.Deno === "undefined") globalThis.Deno = { env: { get: () => undefined } };
if (!globalThis.window) globalThis.window = globalThis;

// The browser-side files are classic scripts that assign to window. Run them
// in this global so window.finnTriggers etc. exist, exactly as a page would.
const loadClassic = (file) => {
  const src = readFileSync(join(shared, file), "utf8");
  // eslint-disable-next-line no-eval
  (0, eval)(src);
};

const registry = await import(join(lib, "finn-field-registry.js"));
const paths    = await import(join(lib, "finn-retrieval-paths.js"));
const merge    = await import(join(lib, "finn-merge.js"));
const linter   = await import(join(lib, "finn-conduct-linter.js"));
const planMod  = await import(join(lib, "finn-plan.js"));
const tokens   = await import(join(lib, "finn-tokens.js"));
const pipeline = await import(join(lib, "finn-capture-pipeline.js"));
// finn-derived.js is one implementation with two importers: an ES module for
// the edge function, and window.finnDerived for the browser. Importing it
// sets both.
const derived  = await import(join(shared, "finn-derived.js"));
const chat     = await import(join(repo, "netlify", "edge-functions", "clarity-chat.js"));

loadClassic("finn-components.js");
loadClassic("finn-triggers.js");
loadClassic("finn-panels.js");
loadClassic("finn-fixtures.js");

const library = JSON.parse(readFileSync(join(shared, "finn-library.json"), "utf8"));

const gateT   = await import(join(here, "finn-gate.tests.js"));
const planT   = await import(join(here, "finn-plan.tests.js"));
const fixT    = await import(join(here, "finn-fixture-household.tests.js"));
const streamT = await import(join(here, "finn-stream.tests.js"));

const SUITES = [
  ["runGateTests",           44,  () => gateT.runGateTests(registry)],
  ["runPathTests",           13,  () => gateT.runPathTests(registry, paths)],
  ["runLinterTests",         16,  () => gateT.runLinterTests(registry, paths, linter, planMod)],
  ["runMergeTests",          12,  () => gateT.runMergeTests(merge)],
  ["runFixtureHousehold",   163,  () => fixT.runFixtureHousehold({
    pipeline, registry, paths, linter,
    derive: derived.derive,
    evaluate: globalThis.window.finnTriggers.evaluate,
    panels: globalThis.window.finnPanels,
    library, plan: planMod, chat,
    browserDerive: globalThis.window.finnDerived && globalThis.window.finnDerived.derive,
  })],
  ["runFinnTriggerFixtures", 16,  () => globalThis.window.runFinnTriggerFixtures()],
  ["runPlanTests",          105,  () => planT.runPlanTests({ plan: planMod, pipeline, tokens })],
  ["runStreamTests",         44,  () => streamT.runStreamTests(chat, tokens)],
];

let countedSum = 0, bad = 0;
const findings = [];
console.log("suite                      counted  declared  expected");
for (const [name, expected, fn] of SUITES) {
  let r;
  try { r = await fn(); }
  catch (err) { r = { pass: false, total: null, declared: null, failures: ["CRASHED: " + (err && (err.stack || err.message))] }; }
  const counted = r.total;
  const declared = r.declared === undefined ? null : r.declared;
  countedSum += counted || 0;
  const countOk = counted === expected;
  const declOk = declared === null || declared === counted;
  if (!r.pass || !countOk) bad++;
  if (!declOk) findings.push({ suite: name, declared, counted, delta: counted - declared });
  console.log(
    name.padEnd(26) + String(counted).padStart(7) + String(declared).padStart(10) + String(expected).padStart(10) +
    (r.pass ? "" : "   FAIL") + (countOk ? "" : "   *** COUNTED != EXPECTED ***") + (declOk ? "" : "   *** DECLARED != COUNTED ***"));
  for (const f of r.failures || []) console.log("    - " + f);
}
console.log("\ncounted total: " + countedSum);
for (const f of findings) {
  console.log(`FINDING: ${f.suite} declares ${f.declared} but ran ${f.counted} (${f.delta > 0 ? "+" : ""}${f.delta}). ` +
    "Resolve it; do not pad to the declared number.");
}
if (bad) { console.error(`\n${bad} suite(s) failed or miscounted.`); process.exit(1); }
if (findings.length) { console.error(`\n${findings.length} declared-count finding(s).`); process.exit(1); }
console.log("\nAll suites passed, every count matched.");
