# Developer Quickstart

This page covers the shortest path from TinySol source to a verifiable artifact set. For your first onchain deployment, continue to [Build Your First Program](/developers/first-program).

## Prerequisites

- Node.js 22 or later
- npm

::: info Public compiler release
`@swaputer-labs/tinysol@0.4.0` is available from the public npm registry. It includes language v1.1
syntax such as `T[<=N]`, `bytes<N>`, `string<N>`, multidimensional arrays, struct mapping fields,
and `break`/`continue`. The examples below pin the exact compiler version so a later release cannot
change generated packages unexpectedly.
:::

Create a project and install the compiler locally:

```sh
npm init -y
npm install --save-dev @swaputer-labs/tinysol@0.4.0
```

Create `Counter.tiny.sol`:

```solidity
contract Counter {
  uint256 value;

  constructor(uint256 initialValue) {
    value = initialValue;
  }

  function increment(uint256 amount) external returns (uint256) {
    value = value + amount;
    return value;
  }

  function get() external view returns (uint256) {
    return value;
  }
}
```

## Check the source

Check the minimal Counter program:

```sh
npx tinysol check --input Counter.tiny.sol
```

`check` runs lexing, parsing, name resolution, and type checking. It does not produce a deployable package.

## Compile the full artifact set

```sh
mkdir -p build/counter

npx tinysol compile \
  --input Counter.tiny.sol \
  --output build/counter/Counter.svm \
  --abi build/counter/Counter.abi.json \
  --events build/counter/Counter.events.json \
  --storage-layout build/counter/Counter.storage.json \
  --manifest build/counter/Counter.manifest.json \
  --assembly build/counter/Counter.svasm \
  --source-map build/counter/Counter.map.json
```

The compiler writes all seven files atomically. A failed check leaves no partial artifact set. Existing targets are never overwritten silently; pass `--force` when replacement is intentional.

## Validate the package

```sh
npx tinysol validate \
  --input build/counter/Counter.svm

npx tinysol inspect \
  --input build/counter/Counter.svm

npx tinysol hash \
  --input build/counter/Counter.svm
```

Before deployment, retain the `.svm` package, ABI, Events descriptor, storage layout, and manifest. Integrations should verify that:

- the package hash matches the manifest;
- the ABI hash matches the package header;
- the ISA identity is supported by the target World;
- the package, constructor arguments, and execution context used for simulation match the data presented for signature.

## Simulate and estimate fees

```sh
npx tinysol simulate --input simulation.json
npx tinysol estimate --input estimate.json
```

The simulator does not query an RPC endpoint. Its input must explicitly provide a snapshot of the target World's packages, programs, storage, creator nonce, transaction context, and block context.

A successful simulation returns bytes executed, return data, storage changes, deployment changes, and Events. Fee estimation also returns maximum World token exposure, estimated burn, and estimated net output. Do not request a signature after a failed simulation or when the input snapshot is incomplete.

## Next steps

1. Follow [Build Your First Program](/developers/first-program) to deploy and call Counter.
2. Use [Build a Swaputer Client](/developers/frontend-integration) to implement quoting, signing, submission, and transaction reconciliation.
3. Read [Actions & Signatures](/developers/actions) to understand every EIP-712 binding.
4. Use [Verify a Deployment](/developers/deployments) to authenticate the target World.
5. See [npm Tooling Packages](/developers/tooling-packages) for the compiler API, receipt codec, and read-only transaction verifier.
6. See [TinySol](/developers/tinysol) for the complete current syntax and bounded ABI rules.

::: warning Consistency requirement
A successful compilation does not guarantee successful onchain execution. Before signing, refresh the nonce, price limit, buy amount, and World state, then simulate or set a conservative budget against that same input set.
:::
