# SVM Context Reference

Every TinySol program runs with a read-only context constructed by the Swaputer Kernel. The context identifies the signed actor, immediate caller, EVM route, World, execution buy, block, and remaining SVM budget.

Programs can read these values directly. They are reserved language expressions, not function arguments or mutable state.

## Complete reference

### Caller and program identity

| Expression | TinySol type | Stateful root execution | Nested SVM execution |
| --- | --- | --- | --- |
| `msg.sender` | `account` | SVM Account ID derived from the Action signer | Program ID of the immediate calling program |
| `this.id` | `account` | Program ID being called or deployed | Program ID currently executing |
| `tx.actor` | `account` | SVM Account ID derived from `VMEnvelope.actor` | Preserved from the root Action |

At the root, `msg.sender == tx.actor`. After program A calls program B, B observes `msg.sender == A's Program ID` while `tx.actor` remains the original user.

```solidity
function directUserCall() external {
    require(msg.sender == tx.actor);
}

function onlyTrustedProgram(account trusted) external {
    require(msg.sender == trusted);
}
```

### EVM route identity

| Expression | Type | Source | Notes |
| --- | --- | --- | --- |
| `tx.router` | `address` | Actual EVM router bound to the signed Action | Preserved across nested calls |
| `tx.executor` | `address` | `VMEnvelope.authorizedExecutor` | Zero means the Action did not require a particular executor |
| `tx.recipient` | `address` | `VMEnvelope.recipient` | Receives net World tokens; it is not an SVM token recipient |

For an application-mediated transaction, bind the EVM application as executor in the signature and enforce it in the program:

```solidity
address trustedExecutor;
address zeroAddress;

constructor(address executor_) {
    require(executor_ != zeroAddress);
    trustedExecutor = executor_;
}

function executeApplicationAction() external {
    require(tx.executor == trustedExecutor);
}
```

`tx.executor` is not the wallet, `tx.router`, or immediate SVM caller. It is the EVM application address the actor explicitly authorized to submit the Action.

### World and execution order

| Expression | Type | Meaning |
| --- | --- | --- |
| `world.id` | `bytes32` | World containing the executing program |
| `world.executionHeight` | `uint256` | World execution height assigned to this operation |

For a stateful CALL or DEPLOY, `world.executionHeight` is the next height and is committed only if the outer transaction succeeds. Every nested call and Event in that root operation sees the same height. For an EVM `Kernel.staticCall`, it is the current committed height and does not change.

Use `(world.id, world.executionHeight)` to order successful World executions. Do not use height as randomness: users can observe pending transactions, builders can choose ordering, and reverted executions never commit a height.

### Execution buy

| Expression | Type | Meaning |
| --- | --- | --- |
| `buy.ethIn` | `uint256` | Exact ETH input of the ETH → World-token buy that opened execution |
| `buy.grossTokenOut` | `uint256` | World-token output before the SVM byte-execution burn |
| `buy.tickAfter` | `int256` | Uniswap pool tick immediately after that buy |

These values describe the Swaputer execution buy, not the EVM application's complete `msg.value`.

For example, a reserve deposit may receive:

```text
EVM msg.value = backing ETH + execution ETH
buy.ethIn     = execution ETH only
```

The reserve keeps the backing ETH and sends only the execution amount into the Swaputer Router. TinySol has no `msg.value` expression and cannot access the reserve's ETH balance.

`buy.grossTokenOut` is measured before execution fees. The net World-token amount delivered to `tx.recipient` is calculated after the actual byte burn and must still satisfy the signed `minNetTokenOut`.

Pool tick is market context, not a secure price oracle. If an application uses `buy.tickAfter`, it must consider manipulation, liquidity depth, slippage limits, and same-transaction price movement.

### EVM block context

| Expression | Type | Meaning |
| --- | --- | --- |
| `block.number` | `uint256` | Containing EVM block number |
| `block.timestamp` | `uint256` | Containing EVM block timestamp |

The Hook captures both values for the root execution and the Kernel preserves them across nested calls. They are appropriate for deadlines and coarse state transitions, not randomness or precise wall-clock guarantees.

TinySol does not expose `block.chainid`. The Action's EIP-712 domain binds the EVM chain ID, Kernel, World, and protocol version. Applications should load these values from a verified deployment manifest.

### SVM execution metering

| Expression | Type | Meaning |
| --- | --- | --- |
| `gas.bytePrice` | `uint256` | World-token price per executed SVM byte |
| `gas.bytesUsed` | `uint256` | Cumulative executed bytes at this point |
| `gas.bytesRemaining` | `uint256` | Root `byteGasLimit` minus cumulative bytes used |

All root and nested frames share one byte budget. A nested call does not receive a fresh allowance. Reading the metering context itself also advances execution, so `gas.bytesUsed` should be treated as an observation rather than an exact future fee prediction.

```text
maximum token exposure = byteGasLimit × gas.bytePrice
actual token burn      = final executed bytes × gas.bytePrice
net World-token output = buy.grossTokenOut - actual token burn
```

If execution exceeds the signed limit, or the buy cannot cover maximum exposure plus `minNetTokenOut`, the complete EVM transaction reverts.

## Context by invocation mode

### Root CALL

The user signs a CALL Action. The root program observes:

```text
msg.sender = tx.actor = Kernel.eoaAccountId(Action signer)
this.id    = target Program ID
tx.router  = actual signed Router
tx.executor = authorizedExecutor
tx.recipient = signed World-token recipient
world.executionHeight = next World height
```

### Root DEPLOY

The user signs a DEPLOY Action whose target is a package hash. During the constructor:

```text
msg.sender = tx.actor = deployer's SVM Account ID
this.id    = newly derived Program ID
```

The Program ID, constructor storage, creator nonce, and deployment Event commit together. A failed constructor leaves no program and does not consume the creator nonce or Action nonce.

### Nested `call` and `staticcall`

When program A calls program B:

```text
B.msg.sender = A.this.id
B.this.id    = B's Program ID
B.tx.actor   = unchanged root actor
all tx.*, world.*, buy.*, block.* values = preserved
gas.* = shared cumulative meter
```

`staticcall` additionally places the child frame in read-only mode. Any attempted storage write, Event, program creation, or state-changing descendant call fails the complete root execution.

### Nested `create`

When a program creates another program, the parent Program ID becomes the new program's creator and constructor `msg.sender`. The transaction-wide context remains unchanged. The new program, constructor writes, creator nonce, and deployment record roll back if any later step in the root execution fails.

### EVM `Kernel.staticCall`

There is no signed Action or execution buy:

| Expression | Value |
| --- | --- |
| `msg.sender`, `tx.actor` | `Kernel.eoaAccountId(EVM staticCall caller)` |
| `this.id` | queried Program ID |
| `tx.router` | zero address |
| `tx.executor` | EVM staticCall caller |
| `tx.recipient` | zero address |
| `world.id` | requested World ID |
| `world.executionHeight` | current committed height |
| `buy.ethIn`, `buy.grossTokenOut`, `buy.tickAfter` | zero |
| `block.number`, `block.timestamp` | current EVM read context |
| `gas.bytePrice` | World's configured byte price |
| `gas.bytesUsed`, `gas.bytesRemaining` | read execution's current meter |

The call consumes no Action nonce or World height and cannot commit state or Events.

## Authorization recipes

### The signer owns the resource

Use `tx.actor` for balances or permissions that should follow the original user through nested calls:

```solidity
require(balances[tx.actor] >= amount);
balances[tx.actor] = balances[tx.actor] - amount;
```

### Only direct root calls are allowed

```solidity
require(msg.sender == tx.actor);
```

This rejects a nested call because the immediate caller becomes a Program ID.

### Only another SVM program is allowed

```solidity
require(msg.sender == trustedProgramId);
```

This is appropriate for program-to-program capabilities such as an escrow calling `transferFrom` after receiving an allowance.

### Only a particular EVM application is allowed

```solidity
require(tx.executor == trustedApplicationAddress);
```

The EVM application must also reject an envelope unless `authorizedExecutor == address(this)`. Checking on both sides prevents a generic route from invoking a privileged program function.

### Require user and application together

```solidity
require(tx.executor == trustedApplicationAddress);
require(tx.actor == expectedOwner);
```

When `expectedOwner` is supplied in calldata, the EVM application must derive and validate it from the same EVM actor. Never trust an unbound account argument.

## Values that do not exist

Do not assume EVM Solidity globals are available in TinySol. TinySol v1 does not expose:

- EVM `msg.value`, `tx.origin`, `block.chainid`, `blockhash`, `basefee`, or coinbase;
- ETH balances or ERC-20 balances by EVM address;
- arbitrary EVM calls, `delegatecall`, or callbacks;
- randomness, an oracle, or transaction confirmation depth;
- a catchable exception object for failed nested calls.

Pass required business values as typed function arguments, bind them in the Action payload, and validate them in the EVM application. Use an oracle only through an explicitly designed application boundary; never reinterpret block or pool context as trusted randomness or price.

## Review checklist

- Is each authorization decision based on the correct identity: immediate caller, root actor, or EVM executor?
- Are EVM addresses converted with the bound Kernel instead of padded or truncated manually?
- Does a `view` function behave safely when buy and route context are zero under `staticCall`?
- Can a nested program unexpectedly invoke an entry point intended only for users?
- Is `authorizedExecutor` non-zero for privileged application operations?
- Are pool tick and block timestamp treated as manipulable context rather than trusted oracles?
- Does the operation leave enough byte budget for all nested calls and Events?
- Does every failed nested call, payment, or postcondition revert the complete outer transaction?

Continue with [Integrate EVM and SVM](/developers/evm-svm-integration) to use this context across an EVM application boundary, or study the [ETH-Backed SRC20](/patterns/eth-backed-src20) and [Atomic Market](/patterns/atomic-market) patterns.
