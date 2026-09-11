# Actions & Signatures

Swaputer authorizes stateful DEPLOY and CALL operations with EIP-712 Actions. An Action is more than program calldata: it commits to the program intent, swap input, execution budget, settlement recipient, and submission authority.

## Operations

| `op` | Name | Target |
| --- | --- | --- |
| `1` | DEPLOY | `targetOrCodeHash` is the `ProgramPackage` hash |
| `2` | CALL | `targetOrCodeHash` is a deployed Program ID |

NOP has no signed Action. A plain NOP buy uses a dedicated Router entry point and executes the canonical one-byte STOP program.

## EIP-712 domain

```ts
const domain = {
  name: "Swaputer",
  version: "1.2",
  chainId,
  verifyingContract: kernelAddress,
  salt: worldId
};
```

A signature cannot be replayed across chains, Kernels, or Worlds. A protocol version change also changes the domain version.

## Typed data

```ts
export const VM_ACTION_TYPES = {
  VMAction: [
    { name: "op", type: "uint8" },
    { name: "worldId", type: "bytes32" },
    { name: "actor", type: "address" },
    { name: "targetOrCodeHash", type: "bytes32" },
    { name: "payloadHash", type: "bytes32" },
    { name: "byteGasLimit", type: "uint32" },
    { name: "minNetTokenOut", type: "uint128" },
    { name: "exactEthAmountIn", type: "uint128" },
    { name: "sqrtPriceLimitX96", type: "uint160" },
    { name: "recipient", type: "address" },
    { name: "router", type: "address" },
    { name: "authorizedExecutor", type: "address" },
    { name: "nonce", type: "uint64" },
    { name: "deadline", type: "uint64" }
  ]
};
```

## Field reference

| Field | Meaning |
| --- | --- |
| `worldId` | Target World; must match the Router call |
| `actor` | SVM authority; must match the recovered signer |
| `targetOrCodeHash` | Package hash for DEPLOY, or Program ID for CALL |
| `payloadHash` | Keccak hash of the raw envelope payload |
| `byteGasLimit` | Maximum byte budget for this SVM execution |
| `minNetTokenOut` | Minimum World tokens the recipient receives after the actual execution burn |
| `exactEthAmountIn` | Exact ETH input authorized for the buy and bound to `msg.value` |
| `sqrtPriceLimitX96` | Uniswap v4 swap price boundary |
| `recipient` | EVM address that receives the net World token output |
| `router` | Router address whose execution path is authorized by the signature |
| `authorizedExecutor` | Required submitter; zero address permits any relayer |
| `nonce` | Actor's next Action nonce in this World |
| `deadline` | Expiration time as Unix seconds |

## Typed Action vs. envelope

The signed object and onchain envelope are not identical:

- The typed Action contains `payloadHash`; the envelope carries the raw `payload`.
- The Router call supplies `exactEthAmountIn` through `msg.value`.
- `sqrtPriceLimitX96` is an explicit Router argument.
- The current execution supplies the `router` binding.

The Kernel recomputes each value before recovering the signer. Changing the envelope, `msg.value`, or any bound Router argument invalidates the signature or fails a binding check.

## Routing modes

State-changing SVM operations must enter through the World's ETH → World-token buy, but the user does not always call the Swaputer Router directly. The `router` and `authorizedExecutor` fields must describe the path that will actually submit the transaction:

- **Direct state change:** the user submits through a verified compatible router. A direct client can use the official Uniswap Universal Router, its `V4_SWAP` command, and the complete envelope in `hookData`. Bind `router` to that Universal Router and set `authorizedExecutor` to the zero address when no application contract is required.
- **Application-mediated state change:** the user calls a vault, market, or other EVM application. That contract calls the Swaputer Router. Bind `router` to the Swaputer Router and `authorizedExecutor` to the application contract.
- **Read-only query:** call `Kernel.staticCall` directly. It requires no Action, swap, Router interaction, or execution fee, and cannot change state.

The two state-changing paths reach the same Hook, Kernel, and SVM; they are not separate execution environments. Both router addresses and their runtime code hashes must come from the same verified release manifest as the World. A client must never sign for one route and submit through the other.

## Actor, executor, relayer, and recipient

These roles may be the same address or separated by the application:

- **Actor:** the signer and SVM authority.
- **Authorized executor:** the application address the actor permits to submit an executor-bound transaction.
- **Relayer:** the address that sends the transaction. Submission is allowed only when the executor is zero or matches the relayer.
- **Recipient:** the address that receives the net World token output.

Changing the recipient, executor, or relayer does not change the actor. Programs reading `tx.actor`, `tx.executor`, and `tx.recipient` receive the context signed by the actor and fixed by the Kernel.

## Nonces and retries

Read the Action nonce from:

```text
Kernel.nonces(worldId, Kernel.eoaAccountId(actor))
```

A successful execution increments the nonce. Any revert rolls it back. The exact same unexpired transaction can be resubmitted with the original nonce. Once another Action from the same actor succeeds, clients must fetch the new nonce, simulate again, and request a new signature.

The `creatorNonce` used to derive Program IDs is a separate counter. Never use it as the Action nonce.

## Execution budget

Before requesting a signature, calculate:

```text
maximumTokenExposure = byteGasLimit × byteGasPrice
estimatedActualBurn  = estimatedExecutedBytes × byteGasPrice
estimatedNetOutput   = grossTokenOutput - estimatedActualBurn
```

`byteGasLimit` is a cap, not a flat fee. A successful execution burns only for bytes actually executed. The entire transaction reverts if execution exceeds the limit, the gross output cannot cover the authorized budget, or the net output falls below `minNetTokenOut`.

## Wallet disclosure

A wallet or application should present the following in plain language before asking for a signature:

- target World and Program ID or package hash;
- operation and decoded function or constructor arguments;
- ETH input, minimum net World token output, and price limit;
- maximum World token exposure and estimated burn;
- recipient, executor, nonce, and deadline;
- current chain, Kernel, and Router identity.

Do not ask users to approve an opaque hexadecimal payload without a decoded intent.

## Common failures

| Error | Typical cause |
| --- | --- |
| `EnvelopeWorldMismatch` | The envelope and Router call reference different Worlds |
| `ActorSignatureMismatch` | The recovered signer is not the declared actor |
| `InvalidNonce` | The nonce has already been consumed or client state is stale |
| `ActionExpired` | The deadline has passed |
| `UnauthorizedExecutor` | The submitter is not the executor authorized by the signature |
| `NetOutputBelowMinimum` | Actual net World token output is below the user's floor |
| `OUT_OF_BYTE_GAS` | The executed path exceeds the byte limit |

Treat any failure as a signal to refresh state and simulate again—not as a reason to request signatures in a blind retry loop.
