# Swaputer Architecture in 5 Minutes

This page gives developers the shortest accurate mental model of Swaputer. It explains what a World contains, how a state change reaches the SVM, which assets live on each side, and where atomicity begins and ends.

## The system at a glance

```text
                         one Swaputer World

User or EVM app
       │ signed Action + exact ETH input
       ▼
Verified Router → Uniswap v4 PoolManager → Swaputer Hook
                                                │
                                                ▼
                                      Kernel → SVM programs
                                         │          │
                                         │          ├─ program storage
                                         │          ├─ nested calls
                                         │          └─ Events
                                         ▼
                               nonce, fee burn, receipt
```

A World binds one Uniswap v4 pool to one Hook, Kernel, World token, SVM state namespace, execution height, and byte-gas price. A program deployed in one World cannot read or mutate another World's program storage.

## Two asset layers

| Asset | Where it lives | What controls it |
| --- | --- | --- |
| World token | EVM ERC-20 and Uniswap v4 pool | ERC-20 and pool rules |
| SRC20 or another program asset | SVM program storage | Immutable program code |
| Native ETH | EVM | Wallets and EVM contracts |

The World token pays for SVM execution. An SRC20 is application state inside the SVM. They are not the same token type, and a Program ID is not an ERC-20 address.

## One state-changing execution

1. The actor chooses a DEPLOY or CALL operation.
2. The client encodes the package or program calldata.
3. The actor signs an EIP-712 Action binding the World, target, payload, Router, execution budget, recipient, nonce, and deadline.
4. An exact-input ETH → World-token buy enters the World.
5. The Hook passes the signed envelope and buy context to the Kernel.
6. The Kernel verifies the signature and nonce, then executes the root program and nested calls.
7. Executed bytes determine the World-token burn.
8. Program writes, deployments, nonce, execution height, fee burn, and Events commit together.

If any step fails, the complete EVM transaction reverts.

## Three ways to interact

| Intent | Path | Result |
| --- | --- | --- |
| Direct state change | User → verified Router → PoolManager → Hook → Kernel | Signed SVM DEPLOY or CALL |
| EVM-coordinated state change | User → application contract → Swaputer Router → PoolManager → Hook → Kernel | EVM custody or state changes atomically with SVM execution |
| Read-only query | Client or contract → `Kernel.staticCall` | SVM output with no Action, swap, nonce, fee burn, or state change |

Users do not call the Kernel directly to change state. The state-changing path must pass through the World buy and Hook. Users also do not always call the Swaputer Router directly: an application contract may do so when EVM logic is part of the operation.

## Identity model

| Identity | Domain | Purpose |
| --- | --- | --- |
| EVM actor address | EVM | Signs the Action |
| SVM actor Account ID | SVM | `Kernel.eoaAccountId(actor)`; exposed as `tx.actor` |
| Program ID | SVM | Identifies immutable deployed program code and storage |
| Authorized executor | EVM | Optional contract allowed to submit an application-mediated Action |
| Immediate caller | SVM | Exposed as `msg.sender`; changes during nested calls |

At the root, `msg.sender == tx.actor`. In a nested call, `msg.sender` becomes the calling Program ID while `tx.actor` remains the original signer.

## Execution economics

```text
maximum exposure = byteGasLimit × byteGasPrice
actual fee       = executedBytes × byteGasPrice
net output       = gross World-token output - actual fee
```

The Action caps execution with `byteGasLimit` and protects output with `minNetTokenOut` and `sqrtPriceLimitX96`. SVM byte fees are paid in the World token bought by that transaction. The outer transaction still pays normal EVM gas.

## What can compose

Programs in the same World can:

- own isolated storage;
- call or read another SVM program;
- create a program from a registered package;
- emit Events into the root execution receipt;
- use the signed actor, executor, buy, block, World, and meter context.

SVM programs cannot call arbitrary EVM contracts or move native ETH. An EVM application contract is required when a flow must hold ETH, call another EVM protocol, or coordinate host-chain state.

## Atomicity boundary

Included in the same rollback boundary:

- EVM application state changed in the transaction;
- native ETH transfers made by that transaction;
- the ETH → World-token swap;
- SVM storage and deployments;
- Action nonce and World execution height;
- World-token execution burn;
- Kernel receipt and program Events.

Not guaranteed by atomicity:

- fair market prices or sufficient liquidity;
- correctness of application code or frontend decoding;
- offchain indexer availability;
- future chain reorganizations;
- safety of mutable administrators or upgrades added by an application.

## Continue learning

- [Core Model](/protocol/overview) defines Worlds and asset boundaries.
- [Execution & Settlement](/protocol/execution) explains the complete transaction lifecycle.
- [Build Your First Program](/developers/first-program) walks through a deploy, call, and read.
- [SVM Context Reference](/developers/svm-context) defines every context expression.
- [Integrate EVM and SVM](/developers/evm-svm-integration) covers application contracts and executor-bound Actions.
