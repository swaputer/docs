import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const docsRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(docsRoot, "../..");

async function text(path) {
  return readFile(resolve(repositoryRoot, path), "utf8");
}

async function json(path) {
  return JSON.parse(await text(path));
}

async function markdownDocuments(directory) {
  const documents = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      documents.push(...await markdownDocuments(path));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      documents.push([path, await readFile(path, "utf8")]);
    }
  }
  return documents;
}

function includes(source, expected, label) {
  assert.ok(source.includes(expected), `${label}: missing ${JSON.stringify(expected)}`);
}

function ordered(source, values, label) {
  let cursor = -1;
  for (const value of values) {
    const next = source.indexOf(value, cursor + 1);
    assert.ok(next > cursor, `${label}: missing or out of order ${JSON.stringify(value)}`);
    cursor = next;
  }
}

const [
  activeRelease,
  eventsRelease,
  kernel,
  cli,
  receiptConstants,
  tinySolPackage,
  receiptPackage,
  cliPackage,
  npmRelease,
  npmPublication,
  docsPackage,
  quickstartPage,
  actionsPage,
  eventsPage,
  toolingPackagesPage
] = await Promise.all([
  json("deployments/active/base-sepolia.json"),
  json("deployments/base-sepolia/swaputer-events-latest.json"),
  text("src/SwapVMKernel.sol"),
  text("tooling/tinysol/src/cli.ts"),
  text("tooling/receipt-codec/src/constants.ts"),
  json("tooling/tinysol/package.json"),
  json("tooling/receipt-codec/package.json"),
  json("tooling/cli/package.json"),
  json(".deps/protocol/.deps/tooling/release/npm/packages.json"),
  json(".deps/protocol/.deps/tooling/release/npm/swaputer-labs-publication.json"),
  json("apps/swaputer-docs/package.json"),
  text("apps/swaputer-docs/docs/developers/quickstart.md"),
  text("apps/swaputer-docs/docs/developers/actions.md"),
  text("apps/swaputer-docs/docs/developers/events-indexing.md"),
  text("apps/swaputer-docs/docs/developers/tooling-packages.md")
]);

assert.equal(activeRelease.schemaVersion, "swaputer-active-release/1");
includes(kernel, 'keccak256("Swaputer")', "Kernel EIP-712 name");
includes(kernel, `keccak256("${activeRelease.release.protocolVersion}")`, "Kernel EIP-712 version");
includes(actionsPage, 'name: "Swaputer"', "Action domain name");
includes(actionsPage, `version: "${activeRelease.release.protocolVersion}"`, "Action domain version");

const actionType = kernel.match(/"VMAction\(([^"]+)\)"/)?.[1];
assert.ok(actionType, "Kernel VMAction type string was not found");
const actionFields = actionType.split(",").map((field) => {
  const [type, name] = field.trim().split(/\s+/u);
  return `{ name: "${name}", type: "${type}" }`;
});
ordered(actionsPage, actionFields, "documented VMAction fields");

includes(
  kernel,
  "event Events(bytes32 indexed worldId, uint64 indexed executionHeight, bytes payload);",
  "Kernel Events declaration"
);
includes(eventsPage, eventsRelease.eventAbi, "documented Events ABI");
includes(eventsPage, eventsRelease.eventTopic, "documented Events topic");

const receiptLimits = [
  ["MAX_RECEIPT_RECORDS", "Receipt records"],
  ["MAX_RECORD_TOPICS", "Topics per record"],
  ["MAX_RECORD_DATA_BYTES", "Data per record"],
  ["MAX_RECEIPT_PAYLOAD_BYTES", "Complete payload"]
];
for (const [constant, label] of receiptLimits) {
  const value = receiptConstants.match(new RegExp(`export const ${constant} = (\\d+)`))?.[1];
  assert.ok(value, `${constant} was not found in generated receipt constants`);
  const rendered = Number(value).toLocaleString("en-US");
  const unit = constant.includes("DATA") || constant.includes("PAYLOAD") ? " bytes" : "";
  includes(eventsPage, `| ${label} | ${rendered}${unit} |`, `${label} limit`);
}

assert.equal(tinySolPackage.private, true);
assert.equal(receiptPackage.private, true);
assert.equal(cliPackage.private, true);
assert.equal(npmRelease.status, "published");
assert.equal(npmPublication.status, "published");
assert.equal(docsPackage.name, "@swaputer/docs");
assert.equal(docsPackage.private, true);
const publishedCli = npmRelease.packages.find((entry) => entry.name === cliPackage.name);
assert.ok(publishedCli, "public CLI release is missing");
includes(quickstartPage, `npm install --save-dev ${tinySolPackage.name}@${tinySolPackage.version}`, "public TinySol install");
includes(eventsPage, `npm install ${receiptPackage.name}@${receiptPackage.version}`, "public receipt codec install");
includes(eventsPage, `npx ${publishedCli.name}@${publishedCli.version} inspect`, "public verifier invocation");
includes(eventsPage, 'from "@swaputer-labs/receipt-codec";', "receipt codec package scope");
assert.ok(!eventsPage.includes('from "@swaputer/receipt-codec";'), "withdrawn codec scope is still imported");
includes(toolingPackagesPage, "is a Node.js command-line package", "CLI runtime boundary");
includes(toolingPackagesPage, "legacy `swaputer --version` output displays `0.1.1`", "CLI display-version notice");
assert.ok(!toolingPackagesPage.includes("@swaputer-labs/cli/browser"), "unpublished CLI browser subpath is documented");

for (const entry of npmRelease.packages) {
  const sourcePackage = [tinySolPackage, receiptPackage, cliPackage].find((candidate) => candidate.name === entry.name);
  assert.ok(sourcePackage, `unknown npm release package ${entry.name}`);
  if (entry.name === cliPackage.name) {
    assert.match(cliPackage.version, /^0\.1\.3-dev\.\d+$/, "private CLI source must remain distinguishable from public 0.1.2");
  } else {
    assert.equal(sourcePackage.version, entry.version, `${entry.name} release version drift`);
  }
  const publication = npmPublication.packages.find((candidate) => candidate.name === entry.name);
  assert.equal(publication?.status, "published", `${entry.name} is not recorded as published`);
  assert.equal(publication?.version, entry.version, `${entry.name} publication version drift`);
  includes(toolingPackagesPage, `${entry.name}@${entry.version}`, `${entry.name} pinned install`);
  includes(toolingPackagesPage, `/package/${entry.name}/v/${entry.version}`, `${entry.name} npm link`);
}

const documentationPages = await markdownDocuments(resolve(docsRoot, "docs"));
for (const [path, source] of documentationPages) {
  assert.doesNotMatch(
    source,
    /\bnpm\s+(?:install|i)\b[^\r\n]*@swaputer\//u,
    `withdrawn public package install is still documented in ${path}`
  );
}

const requiredCompileFlags = [
  "--input", "--output", "--abi", "--events", "--storage-layout", "--manifest", "--assembly", "--source-map"
];
for (const flag of requiredCompileFlags) {
  includes(cli, `required(options, "${flag.slice(2)}")`, `TinySol CLI ${flag}`);
  includes(quickstartPage, flag, `quickstart compile ${flag}`);
}

assert.ok(!eventsPage.includes("@swaputer/indexer"), "legacy TypeScript indexer package is still documented");
assert.ok(!eventsPage.includes("SQLite"), "legacy SQLite storage is still documented");
includes(eventsPage, "services/svm-indexer", "Go indexer path");
includes(eventsPage, "PostgreSQL", "Go indexer storage");

process.stdout.write("Swaputer documentation drift check passed.\n");
