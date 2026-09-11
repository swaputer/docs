# Deploy, Call, and Read Programs

Deploying an SVM program does not upload loose bytecode. It registers a verifiable `ProgramPackage`, runs its constructor, and derives a deterministic Program ID.

## Verify artifacts before deployment

A deployment tool should validate all of the following:

- `.svm` package structure and version;
- program package hash;
- ABI hash;
- ISA identity;
- constructor entry point;
- runtime entry point;
- target World and byte limit.

The network, World, Kernel, and selected Router must come from the same release manifest. Never assemble a deployment request from addresses or code hashes taken from different releases. A state change enters through a verified execution Router; a read-only query calls `Kernel.staticCall` directly. See [Actions & Signatures](/developers/actions#routing-modes) before selecting the direct-client or EVM-application route.

## Encode constructor arguments

Deployment clients and SDKs should collect constructor arguments in ABI declaration order. The constructor payload is part of the DEPLOY Action and is committed by the signed `payloadHash`.

The canonical DEPLOY payload is:

```text
uint32_be(packageLength) || ProgramPackageV1 || abiEncodedConstructorArguments
```

`packageLength` is a four-byte big-endian integer. Constructor arguments have no function selector. Every TinySol scalar is encoded as one 32-byte ABI word.

The constructor and any nested calls share the root `byteGasLimit`. A failed deployment leaves no Program ID, storage, or partial Events.

## Call a deployed program

- `CALL` invokes an `external`, non-`view` function and may update state.
- `STATICCALL` invokes a read-only interface and rejects state changes.
- `internal` functions do not appear in the ABI or external dispatch table.
- A failed nested call bubbles up and reverts the root Action.

## Program IDs

A Program ID is a 32-byte SVM account identifier, not an EVM contract address. Frontends and indexers must preserve the type distinction.

The Program ID for a root deployment can be derived before submission:

```text
actorId      = Kernel.eoaAccountId(actor)
creatorNonce = Kernel.creatorNonce(worldId, actorId)
programId    = Kernel.contractAccountId(worldId, actorId, creatorNonce, packageHash)
```

`creatorNonce` is used only to derive program addresses. Action replay protection uses `Kernel.nonces(worldId, actorId)`; the counters are not interchangeable.

After deployment, read the program code hash from the Kernel and compare it with the package hash in the local manifest.

Read-only queries can call `Kernel.staticCall(worldId, programId, calldata, byteLimit)` directly. A static call does not consume an Action nonce, advance execution height, burn World tokens, or emit Events. It still enforces static-write checks and the byte limit.
