# Execution & Settlement

A stateful Swaputer operation is triggered by one signed Action and one exact-input ETH → World token buy.

![A signed Action and ETH input pass through the Hook, Kernel, and SVM before all results settle atomically.](/images/world-transaction-flow.svg)

## Execution flow

1. The actor signs a DEPLOY or CALL Action.
2. The Router named in the signature submits the Action and buy request to the PoolManager.
3. The Hook validates the pool, swap direction, output, and execution budget.
4. The Kernel validates the signature, nonce, and every signed binding.
5. The SVM executes the root program and any nested calls.
6. State, the World token burn, and Events are committed atomically.

## What an Action binds

An Action is signed as EIP-712 typed data and binds:

- identity: `worldId`, actor, operation, and target Program ID or code hash;
- input: payload hash and exact ETH input;
- budget: `byteGasLimit`, minimum net World token output, and price limit;
- routing: recipient, router, and optional executor;
- replay protection: nonce and deadline.

The relayer submitting a transaction, its recipient, and its authorized executor may all differ from the actor. None of those roles inherit the actor's SVM authority.

See [Actions & Signatures](/developers/actions) for the complete typed data schema, domain, and retry rules.

## How an application reaches the SVM

Every state-changing DEPLOY or CALL must enter through the World's exact-input ETH → World-token buy. The Hook opens SVM execution after the swap and the Kernel commits the result. Users cannot call the Kernel directly to change SVM state.

This requirement does not mean a user must always call the Swaputer Router directly. There are three entry modes:

| Operation | Call path | Action binding |
| --- | --- | --- |
| Direct state change | User → verified router → PoolManager → Hook → Kernel | Bind the actual router; `authorizedExecutor` may be zero |
| EVM application flow | User → application contract → Swaputer Router → PoolManager → Hook → Kernel | Bind the Swaputer Router and require the application contract as `authorizedExecutor` |
| Read-only query | User, frontend, or contract → `Kernel.staticCall` | No signed Action, swap, executor binding, or World-token burn |

A direct client can use the verified Uniswap Universal Router and place the signed envelope in the v4 swap's `hookData`. A contract-mediated application uses the second pattern when it must coordinate EVM custody or application state with the SVM transition.

Both state-changing paths reach the same Hook, Kernel, and SVM. They differ only in who submits the swap and whether the user's signature requires a particular EVM application executor.

## Execution metering

SVM execution is metered in the World token:

```text
maximumTokenExposure = byteGasLimit × byteGasPrice
vmGasBurn            = executedBytes × byteGasPrice
netTokenOutput       = grossTokenOutput - vmGasBurn
```

`byteGasPrice` is fixed when the World is created, while `byteGasLimit` is authorized by the actor. The constructor, root call, and nested calls share one execution meter. Only instruction bytes actually executed are charged.

The underlying transaction still consumes network gas. Byte metering defines the execution fee paid in the World token; it does not replace EVM gas.

## Atomicity and exit

The swap, program state, deployments, nonce, execution height, World token burn, and Events all settle in one Ethereum transaction. If any stage fails, every result reverts.

A World token → ETH sell is always a regular Uniswap v4 swap and never enters the SVM. Programs cannot pause sells, add their own sell tax, or alter the real World token's ERC-20 behavior.

Atomic settlement does not remove liquidity, slippage, MEV, malicious-program, or client-interpretation risk. See [Security & Trust Model](/protocol/security) for the complete boundary.
