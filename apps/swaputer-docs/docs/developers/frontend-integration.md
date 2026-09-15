# Build a Swaputer Client

This guide describes the common client lifecycle for deploying or calling an SVM program. It applies to browser interfaces, wallets, scripts, and backend transaction builders.

## What the client is responsible for

A client must do more than encode calldata. Before requesting a signature, it must establish the target release, read current state, simulate the exact intent, disclose its meaning, and bind every execution parameter.

```text
verify → read → encode → quote → simulate → disclose → sign → submit → reconcile
```

## 1. Load one verified release

Load the chain, World, Uniswap, Router, Hook, and Kernel configuration from one immutable release manifest. Reject mixed addresses from different releases.

At minimum verify:

- connected `chainId`;
- World ID and sealed World configuration;
- Router, PoolManager, Hook, and Kernel addresses and runtime code hashes;
- protocol version, VM version, and ISA hash;
- `byteGasPrice`, pool fee, and maximum byte limit;
- target Program ID, package hash, ABI hash, and Events descriptor.

Use the official [Ethereum Mainnet addresses](/developers/deployments) and follow the checks in [Security & Trust Model](/protocol/security#verify-before-use).

## 2. Resolve identities and current state

Convert EVM users through the bound Kernel:

```ts
const actorAddress = await signer.getAddress();
const actorId = await kernel.eoaAccountId(actorAddress);
const nonce = await kernel.nonces(worldId, actorId);
```

Do not pad or truncate an address into a Program ID or SVM Account ID. `creatorNonce` predicts deployments; the Action `nonce` protects signed operations from replay. They are different counters.

For a CALL, verify the target before encoding a financial instruction:

```ts
const deployedHash = await kernel.programCodeHash(worldId, programId);
if (deployedHash !== expectedPackageHash) {
  throw new Error("Unexpected SVM program identity");
}
```

## 3. Encode the exact operation

TinySol uses ordinary ABI words. The `account` source type is encoded as `bytes32`.

```ts
const recipientId = await kernel.eoaAccountId(recipientAddress);
const payload = concat([
  id("transfer(bytes32,uint256)").slice(0, 10),
  abi.encode(["bytes32", "uint256"], [recipientId, amount])
]);
```

For DEPLOY, the payload is:

```text
uint32_be(packageLength) || ProgramPackageV1 || abiEncodedConstructorArguments
```

Use the compiler-produced ABI rather than maintaining a handwritten selector list. Display the decoded function and arguments before signing.

## 4. Quote the execution buy

A state-changing operation needs an exact-input ETH → World-token buy. The quote must cover:

```text
byteGasLimit × byteGasPrice + minNetTokenOut
```

Choose:

- `exactEthAmountIn`: ETH entering the execution buy;
- `byteGasLimit`: maximum SVM bytes authorized;
- `minNetTokenOut`: minimum World tokens delivered after the actual burn;
- `sqrtPriceLimitX96`: pool price boundary;
- `deadline`: short but usable expiry.

Do not treat a quote as permanent. Refresh it when the pool, nonce, program state, or deadline changes.

## 5. Simulate the same intent

The local TinySol simulator requires an explicit snapshot of packages, programs, storage, creator nonces, World context, buy context, and block context. It returns executed bytes, output, storage changes, deployments, and Events.

For a direct program operation, simulate the root DEPLOY or CALL. For a vault, market, or other EVM application, also perform an EVM `eth_call` of the outer application function so envelope validation, ETH accounting, Router execution, returned postconditions, and final payment are exercised together.

Reject signing when:

- simulation fails;
- the state snapshot is incomplete;
- the target code hash differs;
- the estimated output violates `minNetTokenOut`;
- the operation requires a much larger byte limit than expected;
- decoded intent differs from what the interface displays.

## 6. Build and disclose the Action

The complete typed Action is documented in [Actions & Signatures](/developers/actions). A signing screen should show:

- chain, World, Kernel, Router, and Program ID;
- DEPLOY or decoded CALL;
- actor and SVM recipient account;
- EVM World-token recipient;
- authorized executor, including a clear warning when non-zero;
- execution ETH and any separate application ETH;
- maximum World-token exposure and estimated actual burn;
- minimum output, price limit, nonce, and deadline.

Never ask a user to approve only an opaque payload hash.

## 7. Sign and assemble the envelope

The EIP-712 signature binds `payloadHash`, while the submitted envelope carries the raw payload. It also binds values reconstructed from the actual route: ETH input, Router, and price limit.

```ts
const signature = await signer.signTypedData(domain, VM_ACTION_TYPES, action);

const envelope = {
  op: action.op,
  worldId: action.worldId,
  actor: action.actor,
  targetOrCodeHash: action.targetOrCodeHash,
  payload,
  byteGasLimit: action.byteGasLimit,
  minNetTokenOut: action.minNetTokenOut,
  nonce: action.nonce,
  deadline: action.deadline,
  recipient: action.recipient,
  authorizedExecutor: action.authorizedExecutor,
  signature
};
```

Do not modify the quote or payload after signing.

## 8. Submit through the intended path

| Intent | Submission path |
| --- | --- |
| Direct state change | Submit the signed Action through the verified compatible Router bound in the signature |
| EVM application state change | Call the application contract; it validates the envelope and calls the bound Swaputer Router |
| Read only | Call `Kernel.staticCall` directly with no Action or swap |

The signed `router` must equal the actual state-changing route. For an application flow, `authorizedExecutor` must equal the application contract and the program should enforce the same address through `tx.executor`.

## 9. Reconcile the transaction

Submission is not confirmation. Preserve the transaction hash immediately, wait for the release manifest's confirmation policy, and verify:

- receipt exists and `status == 1`;
- transaction and receipt point to the same block hash;
- the block at that height is still canonical;
- expected Kernel `Events` and application logs are present;
- post-transaction program code or state matches the expected result.

A successful outer EVM receipt means the enclosed SVM state committed. A reverted receipt means the swap, SVM writes, Action nonce, execution height, fee burn, and EVM application changes all rolled back.

## Safe retry state machine

Use explicit client states:

```text
draft → simulated → awaiting signature → submitted → included → confirmed
                                      ↘ rejected
submitted → unresolved → reconciled as confirmed or reverted
confirmed → orphaned only after a detected reorganization
```

If confirmation polling fails, do not describe the transaction as failed and do not ask the user to retry immediately. Query the saved hash through another RPC endpoint and compare the current Action nonce.

- If the receipt succeeded, refresh state; the nonce was consumed.
- If the receipt reverted, the nonce rolled back; rebuild from current state.
- If status remains unknown, keep the action unresolved and prevent a conflicting blind retry.

## Read program state

```ts
const input = concat([
  id("balanceOf(bytes32)").slice(0, 10),
  abi.encode(["bytes32"], [actorId])
]);

const [output] = await kernel.staticCall(worldId, programId, input, 2_000);
const [balance] = abi.decode(["uint256"], output);
```

Pin a block tag when comparing several EVM and SVM reads. Otherwise a balance, supply, and liability check may accidentally combine different chain states.

## Client security checklist

- Fail closed on chain, manifest, runtime hash, World, or program identity mismatch.
- Keep RPC URLs and secrets out of public manifests and error telemetry.
- Decode every signature request into human-readable intent.
- Distinguish execution ETH from deposits, prices, and other application value.
- Simulate the exact route and arguments that will be submitted.
- Preserve transaction hashes across reloads and wallet disconnects.
- Treat indexers as read models, not authorization sources.
- Re-read nonces and critical state directly from the verified Kernel before signing.
- Handle wallet rejection, replacement, timeout, revert, and reorganization as different states.

Continue with [Integrate EVM and SVM](/developers/evm-svm-integration) when the client must coordinate a signed SVM transition with an EVM application contract.
