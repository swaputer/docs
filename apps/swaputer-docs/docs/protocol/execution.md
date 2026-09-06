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

Direct DEPLOY and CALL actions from Studio, Minter, or another compatible client can bind the official Uniswap Universal Router and carry the signed envelope in the v4 swap's `hookData`. Application flows that require a specific EVM executor, including markets and sETH, bind the Swaputer Router and that application executor instead.

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
