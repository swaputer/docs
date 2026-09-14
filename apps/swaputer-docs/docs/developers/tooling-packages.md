# npm Tooling Packages

Swaputer publishes three focused packages under the `@swaputer-labs` scope.
They are public, MIT-licensed, and do not include a wallet or a Base Mainnet
release configuration.

| Package | Current release | Runtime and module boundary | Purpose |
| --- | --- | --- | --- |
| [`@swaputer-labs/tinysol`](https://www.npmjs.com/package/@swaputer-labs/tinysol/v/0.3.2) | `0.3.2` | Node.js `>=22`; ESM-only API and `tinysol` CLI | TinySol compiler, assembler, simulator, fee estimator, and offline CLI |
| [`@swaputer-labs/receipt-codec`](https://www.npmjs.com/package/@swaputer-labs/receipt-codec/v/0.1.2) | `0.1.2` | Node.js `>=20`; ESM-only API | Strict, dependency-free `VMReceiptV1` encoder and decoder |
| [`@swaputer-labs/cli`](https://www.npmjs.com/package/@swaputer-labs/cli/v/0.1.2) | `0.1.2` | Node.js `>=22`; ESM-only API and Node.js CLIs; no browser export | Read-only verifier for Swaputer transactions and receipt payloads |

## Public releases and current source lines

Published identities are immutable. The three source workspaces are not all on the same release
line:

| Package | Public npm identity | Current source/candidate | Effect of TinySol v1.1 |
| --- | --- | --- | --- |
| `@swaputer-labs/tinysol` | `0.3.2` | `0.4.0` prepared, not published | Adds bounded `string<N>`, `bytes<N>`, `T[<=N]`, richer arrays/structs/control flow, and pinned npm-style imports |
| `@swaputer-labs/receipt-codec` | `0.1.2` | `0.1.2` | No format change; `VMReceiptV1` is independent of source-language types |
| `@swaputer-labs/cli` | `0.1.2` | `0.1.3-dev.0` private source | Can verify resulting transactions because it authenticates receipts and program identity, not source syntax |

Do not install an unpublished identity from the registry or replace an existing public version. A
candidate tarball must be prepared, inspected, tested in an empty project, and published under a new
immutable version before public installation instructions change.

## Install the libraries

Pin exact versions in applications and release builds:

```sh
npm install @swaputer-labs/tinysol@0.3.2 \
  @swaputer-labs/receipt-codec@0.1.2
```

The compiler can be called directly from an ES module:

```ts
import { compileTinySol } from "@swaputer-labs/tinysol";

const result = compileTinySol(source, {
  sourceName: "Counter.tiny.sol"
});

console.log(result.codeHash);
console.log(result.packageBytes);
console.log(result.abi);
```

The public `0.3.2` compiler accepts the v1 surface. Repository maintainers testing v1.1 must install
the reviewed local `0.4.0` tarball instead; see [TinySol](/developers/tinysol) for its syntax and
static bounded-ABI rules.

The receipt codec rejects an invalid or incomplete payload before returning any
records:

```ts
import { decodeVMReceipt } from "@swaputer-labs/receipt-codec";

const receipt = decodeVMReceipt(payload);
console.log(receipt.worldExecution.executedBytes);
```

## Use the Node.js CLIs

Run a pinned TinySol command without a global installation:

```sh
npx @swaputer-labs/tinysol@0.3.2 --help
```

Install the transaction verifier globally, or invoke the pinned package with
`npx`:

```sh
npm install --global @swaputer-labs/cli@0.1.2
swaputer --help

npx @swaputer-labs/cli@0.1.2 --help
```

The verifier is intentionally read-only. It fetches a receipt from an RPC URL
stored in a named environment variable, verifies the configured network,
Kernel, World, outer `Events` envelope, and complete receipt, then emits text or
JSON. It never loads a wallet, signs, or submits a transaction.

`@swaputer-labs/cli@0.1.2` is a Node.js command-line package. It does not expose
a browser entry point. Browser applications should use the public receipt codec
directly and provide their own transport/UI adapter; do not import undocumented
package subpaths.

::: info CLI version display
The npm manifest and registry integrity identify the current package as
`0.1.2`. Its legacy `swaputer --version` output displays `0.1.1`; this is a
display-only defect in that immutable release. Pin and verify the npm package
identity rather than using that output as an integrity check.
:::

## Version and trust boundary

- Commit `package-lock.json` and use `npm ci` for reproducible application builds.
- Treat a compiler upgrade as an artifact change: rebuild and re-verify every package, ABI, source map, and code hash.
- Verify program identity and the active deployment manifest independently of the npm package name.
- Keep RPC credentials in environment variables or a secret manager; never place them in a URL passed on the command line.
