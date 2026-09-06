# Build Your First Program

This guide uses a Counter to connect the complete path: compile TinySol, encode constructor arguments, derive a Program ID, sign an Action, deploy onchain, call the program, and read its state. Examples use ethers v6. Always source live network parameters from a verified release manifest.

## 1. Write Counter

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

## 2. Compile and verify

Follow the [Developer Quickstart](/developers/quickstart) to produce all seven compiler artifacts, then record the package hash:

```sh
node tooling/tinysol/dist/src/cli.js hash \
  --input build/counter/Counter.svm
```

Every later DEPLOY Action must use this package hash as `targetOrCodeHash`. Changing any byte in the `.svm` file changes both the hash and the resulting Program ID.

## 3. Encode constructor arguments

Counter accepts one `uint256` constructor argument. This example sets the initial value to `5` and builds the canonical DEPLOY payload:

```ts
import { readFileSync } from "node:fs";
import { AbiCoder, concat, hexlify, keccak256, toBeHex } from "ethers";

const abi = AbiCoder.defaultAbiCoder();
const packageBytes = new Uint8Array(readFileSync("build/counter/Counter.svm"));
const codeHash = keccak256(packageBytes);
const constructorArgs = abi.encode(["uint256"], [5n]);

const deployPayload = hexlify(concat([
  toBeHex(packageBytes.length, 4),
  packageBytes,
  constructorArgs
]));
```

The four-byte package length is big-endian. Constructor arguments follow the complete `ProgramPackageV1` and have no function selector.

## 4. Derive the Program ID

You can derive the Program ID before submitting the transaction:

```ts
const actor = await signer.getAddress();
const actorId = await kernel.eoaAccountId(actor);
const creatorNonce = await kernel.creatorNonce(worldId, actorId);
const programId = await kernel.contractAccountId(
  worldId,
  actorId,
  creatorNonce,
  codeHash
);
```

`creatorNonce` is used to derive the Program ID. Signing the Action requires a separate counter:

```ts
const actionNonce = await kernel.nonces(worldId, actorId);
```

## 5. Simulate and set the budget

Before deployment, run the same package and constructor arguments in Studio or the TinySol simulator. The simulation input must describe the current target World snapshot, including:

- `worldId`, execution height, and `byteGasPrice`;
- block and buy context;
- registered packages, programs, storage, and creator nonce;
- the DEPLOY actor, code hash, payload, and byte limit.

At minimum, the signing interface should display:

```text
maximumTokenExposure = byteGasLimit × byteGasPrice
```

Do not request a signature if simulation fails, the state snapshot is incomplete, or the projected net output is below the user's floor.

## 6. Sign the DEPLOY Action

The EIP-712 domain binds the signature to one World and Kernel:

```ts
const domain = {
  name: "Swaputer",
  version: "1.2",
  chainId,
  verifyingContract: kernelAddress,
  salt: worldId
};

const exactEthAmountIn = 10_000_000_000_000n;
const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60);

const action = {
  op: 1, // DEPLOY
  worldId,
  actor,
  targetOrCodeHash: codeHash,
  payloadHash: keccak256(deployPayload),
  byteGasLimit: 20_000,
  minNetTokenOut,
  exactEthAmountIn,
  sqrtPriceLimitX96,
  recipient: actor,
  router: swaputerRouterAddress,
  authorizedExecutor: actor,
  nonce: actionNonce,
  deadline
};

const signature = await signer.signTypedData(domain, VM_ACTION_TYPES, action);
```

See [Actions & Signatures](/developers/actions) for the complete `VM_ACTION_TYPES` definition.

## 7. Deploy through the Swaputer Router

The envelope passed to the Router contains the raw payload, not `payloadHash`:

```ts
const envelope = {
  op: action.op,
  worldId: action.worldId,
  actor: action.actor,
  targetOrCodeHash: action.targetOrCodeHash,
  payload: deployPayload,
  byteGasLimit: action.byteGasLimit,
  minNetTokenOut: action.minNetTokenOut,
  nonce: action.nonce,
  deadline: action.deadline,
  recipient: action.recipient,
  authorizedExecutor: action.authorizedExecutor,
  signature
};

const tx = await swaputerRouter.buyVMExactInput(
  worldId,
  sqrtPriceLimitX96,
  envelope,
  { value: exactEthAmountIn }
);
const receipt = await tx.wait();
```

`msg.value` must equal the signed `exactEthAmountIn`, and the Swaputer Router's price-limit argument must equal the signed value. This example intentionally uses the executor-bound Swaputer Router path. Studio and Minter may instead use the direct Universal Router binding described in [Actions & Signatures](/developers/actions#routing-modes).

## 8. Verify the deployment

After confirmation, do not rely on a success toast alone:

```ts
const deployedHash = await kernel.programCodeHash(worldId, programId);

if (deployedHash.toLowerCase() !== codeHash.toLowerCase()) {
  throw new Error("Program code hash mismatch");
}
```

Also locate the Kernel's `Events(worldId, executionHeight, payload)` in the transaction receipt. Decode it and confirm that the root target and deployment record match the Program ID derived before submission.

## 9. Call `increment`

Runtime calldata is a four-byte selector followed by static ABI arguments:

```ts
import { id } from "ethers";

const incrementPayload = `${id("increment(uint256)").slice(0, 10)}${
  abi.encode(["uint256"], [3n]).slice(2)
}`;
```

Fetch a fresh Action nonce and construct a CALL Action with `op: 2`, `targetOrCodeHash: programId`, and the new `payloadHash`. Simulate, sign, and call `SwaputerRouter.buyVMExactInput` again. Never reuse the DEPLOY nonce, deadline, or signature.

## 10. Read state

Call `get()` directly through the Kernel:

```ts
const getPayload = id("get()").slice(0, 10);
const [output, bytesUsed] = await kernel.staticCall(
  worldId,
  programId,
  getPayload,
  2_000
);
const value = abi.decode(["uint256"], output)[0];
```

With an initial value of `5` and one successful `increment(3)`, the result is `8`. `staticCall` burns no World tokens, consumes no nonce, does not advance execution height, and emits no Events.

## Completion checklist

- The local package hash matches the onchain program code hash.
- The derived Program ID matches the deployment record in Events.
- DEPLOY and CALL each use the actor's latest Action nonce.
- Constructor and function arguments use the exact ABI encoding.
- `msg.value`, price limit, recipient, and executor match the signed values.
- Onchain state and Events confirm the result independently of the UI.
