# What Can Be Built

Swaputer is not an asset standard, a bridge, or a marketplace. It is the execution boundary beneath them: a place where liquidity can open an application, signed intent can authorize it, and state can settle in the same transaction.

Applications inside a World share the SVM, accounts, storage model, Events, and atomic settlement path. Their rules remain in immutable program code. That separation lets the protocol provide common guarantees without deciding what every application must be.

## Programmable assets

A program can define issuance, balances, transfers, allowances, distribution rules, and application-specific rights. SRC20 is one standard built from these primitives, but a World can also support points, claims, receipts, positions, or assets whose behavior does not fit a conventional token interface.

The real World token and program-defined assets remain separate. The World token trades in the Uniswap v4 pool and pays for execution; application assets live in SVM state and follow their program's rules.

## Atomic exchanges

Programs can hold assets in escrow, express offers, and settle exchanges against explicit authorization. A flow may use a narrowly bound EVM contract where host-chain custody is required, while the corresponding program maintains SVM-side balances and settlement state.

This model supports fixed-price listings, bilateral swaps, and application-specific exchanges. The important property is not the interface shown by a marketplace. It is that custody, authorization, program state, and Events are checked against known identities and committed atomically.

See [Build an Atomic ETH/SRC20 Market](/patterns/atomic-market) for an executor-bound design that escrows native ETH on the EVM, SRC20 on the SVM, and settles both sides in one transaction.

## Backed representations

An application can represent an externally custodied asset inside the SVM when the custody component, program, Kernel, and World are explicitly bound. A dedicated custody contract can hold the host-chain asset while a program accounts for the corresponding SVM supply.

See [Build an ETH-Backed SRC20](/patterns/eth-backed-src20) for a developer-owned reserve that locks native ETH, mints an application-owned SRC20 representation, and atomically burns it during redemption.

The pattern can extend to other narrowly defined gateways. Its safety depends on the complete backing invariant and binding configuration, not merely on an event name or mint function.

## Games and coordination

Programs can maintain shared state for games, collective decisions, memberships, rewards, and other multi-user systems. Because programs in one World can call one another, an application can compose assets, permissions, markets, and game logic without creating a new execution environment for each feature.

The World supplies a common history and economic entry point. The application decides what players can do, which state transitions are valid, and how assets or rights move between accounts.

Developers can begin with [Build Your First Program](/developers/first-program). See [Security & Trust Model](/protocol/security) for the guarantees and risks shared by every application category.
