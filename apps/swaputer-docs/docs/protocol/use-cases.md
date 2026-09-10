# What Can Be Built

Swaputer is not an asset standard, a bridge, or a marketplace. It is the execution boundary beneath them: a place where liquidity can open an application, signed intent can authorize it, and state can settle in the same transaction.

Applications inside a World share the SVM, accounts, storage model, Events, and atomic settlement path. Their rules remain in immutable program code. That separation lets the protocol provide common guarantees without deciding what every application must be.

## Programmable assets

A program can define issuance, balances, transfers, allowances, distribution rules, and application-specific rights. SRC20 is one standard built from these primitives, but a World can also support points, claims, receipts, positions, or assets whose behavior does not fit a conventional token interface.

The real World token and program-defined assets remain separate. The World token trades in the Uniswap v4 pool and pays for execution; application assets live in SVM state and follow their program's rules.

## Atomic markets

Programs can hold assets in escrow, express offers, and settle trades against explicit authorization. A market may use a narrowly bound EVM contract where host-chain custody is required, while the corresponding program maintains SVM-side balances and settlement state.

This model supports fixed-price listings, bilateral swaps, and application-specific exchanges. The important property is not the interface shown by a marketplace. It is that custody, authorization, program state, and Events are checked against known identities and committed atomically.

## Backed representations

An application can represent an externally custodied asset inside the SVM when the custody component, program, Kernel, and World are explicitly bound. The sETH bridge demonstrates this pattern: native ETH is held by a dedicated vault while the program accounts for the corresponding SVM supply.

The pattern can extend to other narrowly defined gateways. Its safety depends on the complete backing invariant and binding configuration, not merely on an event name or mint function.

## Games and coordination

Programs can maintain shared state for games, collective decisions, memberships, rewards, and other multi-user systems. Because programs in one World can call one another, an application can compose assets, permissions, markets, and game logic without creating a new execution environment for each feature.

The World supplies a common history and economic entry point. The application decides what players can do, which state transitions are valid, and how assets or rights move between accounts.

## New onchain mechanisms

The most important use cases may not resemble today's token or DeFi interfaces. A developer can combine signed Actions, deterministic programs, persistent state, nested calls, and atomic settlement into mechanisms that are native to the World itself.

Swaputer's role is to keep that design space open while preserving hard boundaries: programs cannot rewrite the real World token, intercept its sell path, escape their storage namespace, or make arbitrary EVM calls.

## Applications prove the protocol

The bridge, SRC20 minter, market, and Studio are useful because they exercise different parts of the protocol. They are reference applications and gateways—not the definition of Swaputer.

| Application | Protocol capability demonstrated |
| --- | --- |
| SRC20 | Program-defined assets, balances, minting policy, and transfers |
| Market | Escrow, authorization, cross-layer binding, and atomic settlement |
| sETH bridge | Backing invariants and a narrowly bound EVM custody component |
| Studio | Reproducible compilation, constructor encoding, deployment, and calls |

Developers can begin with [Build Your First Program](/developers/first-program). Readers evaluating the boundary should continue to [Security & Trust Model](/protocol/security).
