# Integrate EVM and SVM

Use this guide when one application operation must combine EVM custody or contract state with an SVM program transition. The reusable mechanism is an executor-bound Action: the user signs the exact SVM intent, an EVM application validates it, and the Swaputer execution path makes both domains succeed or fail together.

## What you will build

```text
User
  │ calls application + supplies ETH
  ▼
EVM application contract
  │ validates custody state and signed VMEnvelope
  ▼
Swaputer Router → PoolManager → Hook → Kernel → SVM program
  │                                                │
  └──────────── one EVM transaction ───────────────┘
```

This pattern is appropriate when an operation must:

- hold, release, or pay native ETH;
- update an EVM order, position, or application record;
- require one particular EVM contract to mediate an SVM call;
- compare an SVM return value with an EVM liability;
- roll both domains back if either side fails.

For ordinary program calls with no EVM application state, use the direct-client route described in [Execution & Settlement](/protocol/execution). For reads, call `Kernel.staticCall` directly.

## Prerequisites

Before implementing this boundary, understand:

- [Swaputer Architecture in 5 Minutes](/architecture);
- [Actions & Signatures](/developers/actions);
- [SVM Context Reference](/developers/svm-context);
- [Verify a Deployment](/developers/deployments).

Use one verified release manifest for the chain, Router, PoolManager, Hook, Kernel, World, VM version, and code hashes.

## Choose which VM owns each fact

| EVM application owns | SVM program owns |
| --- | --- |
| Native ETH custody and payments | SRC20 balances, allowances, minting, and burning |
| EVM order or vault status | Program-specific state machines |
| Reentrancy protection | SVM program-to-program authorization |
| Envelope validation against application state | Authorization using `tx.actor`, `tx.executor`, and `msg.sender` |
| Calls to other EVM contracts | SVM storage, nested calls, and Events |

Assign one source of truth per fact. If both VMs track related totals, enforce their relationship after every transition. For example, an EVM reserve owns its ETH liability while an SVM token owns total supply; the integration checks that the two remain equal.

ETH does not enter the SVM. An SRC20 does not become an ERC-20. An SVM Program ID is a 32-byte `account`, not an EVM contract address.

## Identity mapping

| Value | Domain and type | Meaning |
| --- | --- | --- |
| `envelope.actor` | EVM `address` | Address recovered from the EIP-712 signature |
| `Kernel.eoaAccountId(envelope.actor)` | SVM `account` | Root actor exposed as `tx.actor` |
| `envelope.authorizedExecutor` | EVM `address` | Application contract permitted to submit the Action |
| `tx.executor` | EVM `address` in TinySol | Same executor preserved across the SVM call tree |
| `msg.sender` in TinySol | SVM `account` | Root actor at entry; immediate Program ID in nested calls |
| `envelope.recipient` | EVM `address` | Recipient of net World-token output, not an SRC20 recipient |

Convert EVM participants through the bound Kernel whenever a payload expects an SVM account:

```ts
const actorId = await kernel.eoaAccountId(actorAddress);
const recipientId = await kernel.eoaAccountId(recipientAddress);
```

Do not pad, truncate, or cast addresses manually.

## Bind the application on both sides

The user sets the EVM application in `authorizedExecutor`. The application requires the same address in the submitted envelope, and the TinySol program enforces it independently:

```solidity
address trustedApplication;
address zeroAddress;

constructor(address application_) {
    require(application_ != zeroAddress);
    trustedApplication = application_;
}

function privilegedOperation(uint256 amount) external returns (uint256) {
    require(tx.executor == trustedApplication);
    require(amount > 0);
    // Apply the SVM transition.
    return amount;
}
```

`tx.actor` answers who authorized the operation. `tx.executor` answers which EVM application may submit it. `msg.sender` answers which SVM account or program called the current function. These are separate security boundaries.

## Build the signed Action

Encode the exact program function and arguments:

```ts
const payload = concat([
  id("privilegedOperation(uint256)").slice(0, 10),
  abi.encode(["uint256"], [amount])
]);
```

Then build the executor-bound Action:

```ts
const actorId = await kernel.eoaAccountId(actorAddress);

const action = {
  op: 2,
  worldId,
  actor: actorAddress,
  targetOrCodeHash: programId,
  payloadHash: keccak256(payload),
  byteGasLimit,
  minNetTokenOut,
  exactEthAmountIn: vmEthAmount,
  sqrtPriceLimitX96,
  recipient: worldTokenRecipient,
  router: swaputerRouterAddress,
  authorizedExecutor: applicationAddress,
  nonce: await kernel.nonces(worldId, actorId),
  deadline
};
```

The wallet signs the typed Action. The submitted `VMEnvelope` carries the raw `payload` and signature. The Kernel reconstructs `payloadHash`, `exactEthAmountIn`, `sqrtPriceLimitX96`, and the actual Router binding before recovering the signer.

## Validate the complete intent on EVM

Signature validity proves that the actor authorized an Action. It does not prove that the Action matches the application order or custody request. Before changing liability, validate:

- operation is `CALL`;
- World and Program ID equal immutable application bindings;
- actor equals the expected user;
- recipient equals the application-defined World-token recipient;
- authorized executor is exactly `address(this)`;
- payload length, selector, and every ABI argument match application state;
- amount, expiry, order status, and recipient are valid;
- `msg.value` is split correctly between application value and SVM execution value;
- byte limit and deadline are reasonable for the operation.

```solidity
function _validateCall(
    SwapVMKernel.VMEnvelope calldata envelope,
    address expectedActor,
    bytes32 expectedProgram,
    address expectedRecipient,
    bytes memory expectedPayload
) internal view {
    if (envelope.op != SwapVMKernel.RootOp.CALL) revert InvalidEnvelope();
    if (envelope.worldId != worldId) revert InvalidEnvelope();
    if (envelope.actor != expectedActor) revert InvalidEnvelope();
    if (envelope.targetOrCodeHash != expectedProgram) revert InvalidEnvelope();
    if (envelope.recipient != expectedRecipient) revert InvalidEnvelope();
    if (envelope.authorizedExecutor != address(this)) revert InvalidEnvelope();
    if (keccak256(envelope.payload) != keccak256(expectedPayload)) {
        revert InvalidEnvelope();
    }
}
```

Checking only the selector is unsafe: a payload with the expected function but a substituted amount or recipient is a different financial instruction.

## Execute and verify a postcondition

Send only the execution funding to the Router:

```solidity
function _runVM(
    uint128 vmEthAmount,
    uint160 sqrtPriceLimitX96,
    SwapVMKernel.VMEnvelope calldata envelope
) internal returns (uint256 result) {
    (, bytes32 word, uint32 length) =
        router.buyVMExactInputWithResult{value: vmEthAmount}(
            worldId,
            sqrtPriceLimitX96,
            envelope
        );

    if (length != 32) revert InvalidProgramResult();
    return uint256(word);
}
```

For outputs up to 32 bytes, the Router returns the raw word. For longer outputs it returns `keccak256(fullOutput)` plus the original length. A financial integration should make its SVM entry point return one scalar postcondition and require `length == 32`.

Compare that result with the EVM expectation before releasing assets. Examples include new total supply, escrowed token balance, or application sequence number.

## Handle execution ETH and refunds

`vmEthAmount` funds the ETH → World-token execution buy. It is separate from deposits, prices, and other EVM liabilities.

The Router refunds unused native input to its immediate caller. In this path the caller is the EVM application, so accept ETH only from the bound Router:

```solidity
receive() external payable {
    if (msg.sender != address(router)) revert OnlyRouterRefund(msg.sender);
}
```

Measure actual Router spend and forward only the proven unused amount according to an explicit refund policy. Never count execution refunds as backing or application revenue.

## Preserve atomicity

Use a reentrancy guard and checks-effects-interactions:

1. validate the application state and complete envelope;
2. update the EVM status or liability;
3. execute the SVM Action through the Router;
4. validate its returned postcondition;
5. transfer ETH or call the remaining EVM dependency;
6. assert final EVM solvency;
7. emit the application event.

If any later step reverts, earlier EVM writes, the swap, SVM storage, nonce, execution height, World-token burn, and Events all roll back.

A successful outer EVM receipt means the enclosed SVM execution committed. There is no second SVM confirmation transaction. The containing EVM block remains subject to the application's chain-confirmation and reorganization policy.

## Deployment cycle

The SVM program should know its trusted EVM application, while the application should bind the Program ID and package hash. Resolve that cycle deterministically:

1. compile the TinySol program and calculate the package hash;
2. derive its future Program ID from World, creator, creator nonce, and package hash;
3. build the EVM application creation code containing that Program ID and hash;
4. derive the application address with `CREATE2`;
5. deploy the SVM program with the predicted EVM address;
6. verify the SVM code hash and stored executor;
7. deploy the EVM application at the predicted address;
8. verify both directions onchain.

Do not use a temporary controller followed by a mutable admin update. Store Router, Kernel, World, Program IDs, package hashes, and counterpart addresses immutably unless the application explicitly designs and discloses a different trust model.

## Client workflow

```text
load verified release
  → read identities, nonces, and application state
  → encode exact payload
  → quote execution buy
  → simulate SVM and outer EVM call
  → disclose decoded intent
  → sign executor-bound Action
  → submit application transaction
  → reconcile receipt and refresh both domains
```

The full client lifecycle, transaction states, and retry rules are in [Build a Swaputer Client](/developers/frontend-integration).

## Integration checklist

- One verified release supplies every protocol address and code hash.
- EVM addresses are converted through the bound Kernel.
- The application and program enforce the same non-zero executor.
- Every envelope field and payload argument is validated.
- Application ETH and execution ETH use separate accounting buckets.
- The SVM operation returns a narrow postcondition that EVM verifies.
- Router refunds cannot enter through an unrestricted receive path.
- A failed SVM call, return check, or ETH payment reverts the whole operation.
- Events are used for history, never authorization.
- The exact outer call is simulated before signing.
- Transaction hashes survive UI reloads and unresolved receipts are never blindly retried.
- Independent review is completed before accepting assets of value.

## Apply the pattern

- [Build an ETH-Backed SRC20](/patterns/eth-backed-src20) applies the boundary to deposits, minting, burning, and redemption.
- [Build an Atomic ETH/SRC20 Market](/patterns/atomic-market) applies it to EVM ETH custody and SVM token escrow.
