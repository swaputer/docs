<!--
Publication gate:
- Do not publish until the Ethereum Mainnet release is explicitly authorized.
- Replace all planned launch language with observed facts from the signed mainnet manifest.
- Add verified contract addresses and transaction links only after post-deployment checks pass.
- Confirm that the public risk disclosure still matches the final release record.
-->

# Built from the Swap Up: Introducing Swaputer

*A swap-native virtual machine for Ethereum, built on Uniswap v4.*

Ethereum made assets programmable. Uniswap made those assets liquid. But in most onchain systems, the market and the application still live beside one another: a token trades in one place, while the logic that gives it purpose runs somewhere else.

Swaputer brings those two layers into a single atomic environment.

At the center of the protocol is the Swaputer Virtual Machine, or SVM: a deterministic execution environment entered through the lifecycle of a Uniswap v4 swap. An exact-input ETH buy can carry a signed instruction to deploy or call a program. The trade, program execution, state transition, execution fee, and emitted events either settle together or revert together.

The result is more than a customized liquidity pool. It is a programmable onchain World, built from the swap up.

Swaputer v1.2 is preparing for an **unaudited experimental** launch on Ethereum mainnet. The protocol is not represented as audited, production-ready, or free of risk. Final contracts, parameters, ownership roles, and launch transactions will be published only after deployment and post-deployment verification are complete.

## The swap becomes an execution path

Most Hooks extend the behavior of a pool. They can change fees, add incentives, enforce conditions, or perform accounting around a trade.

Swaputer uses the Hook boundary differently. It connects the pool to an execution system.

When a user submits a state-changing Swaputer transaction, the flow is:

1. The user authorizes a `DEPLOY` or `CALL` Action with an EIP-712 signature.
2. An exact-input ETH → World-token buy enters the Uniswap v4 PoolManager.
3. The Swaputer Hook validates the World, swap direction, execution budget, price boundary, and signed routing fields.
4. The Kernel verifies the actor, nonce, target, payload, recipient, router, executor, and deadline.
5. The SVM executes the root program and any nested program calls.
6. Program writes, deployments, execution height, token burn, and Events commit with the swap.

If execution fails, the complete Ethereum transaction reverts. There is no partially committed program state and no isolated execution charge without the corresponding result.

This is the protocol's defining property: the swap is not followed by execution. The swap is the path into execution.

## A liquidity pool becomes a World

Every Swaputer World binds a Uniswap v4 pool to a Hook, Kernel, World token, SVM state namespace, execution history, and immutable configuration.

The pool ID becomes the `worldId`. Programs, accounts, storage, Events, and execution height are scoped to that World. A program deployed in one World cannot mutate the state of another.

Within a World:

- the pool provides market access and price discovery;
- the Hook connects eligible buys to program execution;
- the Kernel authenticates Actions and commits state;
- the SVM runs deterministic programs;
- the World token pays for executed instruction bytes;
- Events provide a verifiable history for explorers and indexers.

This creates a shared execution boundary for applications. Developers do not need to deploy a new execution layer for every asset, market, game, or coordination system they build inside the same World.

## Two asset layers, with different rules

Swaputer separates the real World token from assets defined by SVM programs.

The World token is an ERC-20 on Ethereum and the traded asset in the Uniswap v4 pool. It is also the unit used to pay SVM byte-execution fees.

Program-defined assets live in SVM state. An SRC20 balance, a claim, a receipt, a membership, or an application-specific position follows the immutable rules of the program that created it. A Program ID is not an ERC-20 address, and an SVM asset does not share the balance semantics of the World token.

That separation is intentional. Programs cannot rewrite the World token, blacklist its holders, pause its transfers, or intercept its sell path. A World-token → ETH sale remains a regular Uniswap v4 swap and does not enter the SVM.

## Execution paid by execution

SVM execution is metered by the instruction bytes actually executed:

```text
maximum exposure = byteGasLimit × byteGasPrice
actual burn      = executedBytes × byteGasPrice
net output       = gross World-token output - actual burn
```

The user signs a maximum byte budget and a minimum net output. A successful transaction burns only the amount corresponding to the bytes actually executed. The World token bought by the transaction therefore provides both entry into the World and payment for the computation performed there.

Ethereum gas remains separate. Users still pay the host-chain transaction cost in ETH; SVM byte metering defines the execution cost inside the World.

## Programs for a swap-native machine

SVM programs are immutable application units with isolated storage and verifiable identities. They can read and write their own state, call other programs, create programs from registered packages, return data, and emit Events. They cannot make arbitrary calls into Ethereum contracts.

When an application needs native ETH custody or another EVM-side capability, an explicitly bound EVM contract can coordinate with the SVM through an authorized executor. The user's Action binds that executor, the router, the recipient, and the complete call intent. EVM state and SVM state can then share the same Ethereum rollback boundary without giving every SVM program arbitrary host-chain authority.

This model supports two complementary forms of composition:

- native composition among programs inside a World;
- narrowly authorized composition between an EVM application and an SVM program.

The protocol does not prescribe a single application. SRC20 demonstrates program-defined assets, while the broader design space includes atomic exchanges, backed representations, games, registries, coordination systems, and mechanisms that do not fit existing token interfaces.

## What is new in the v1.2 stack

Swaputer v1.2 strengthens the authenticated boundary between users, routers, EVM applications, and SVM programs. Actions bind the actor's intent to one World and one execution path, including the payload, execution cap, price limit, recipient, router, authorized executor, nonce, and deadline.

Programs can access verified transaction context without trusting a frontend. This includes the actor, immediate caller, router, authorized executor, recipient, World identity, execution height, ETH input, gross World-token output, post-swap tick, post-swap liquidity, block context, and remaining execution meter.

The current developer toolchain includes:

- TinySol language v1.1 and `@swaputer-labs/tinysol` 0.4.0;
- a compiler, assembler, validator, simulator, and fee estimator;
- structs, enums, checked integer widths, fixed and bounded collections, bounded bytes and strings, imports, and generated artifacts;
- a strict receipt codec and read-only transaction verifier;
- Studio for writing, compiling, deploying, calling, and reading SVM programs;
- Explore and the protocol indexer for authenticated execution history.

Compiler output includes the program package, ABI, Events descriptor, storage layout, manifest, assembly, and source map. Program identity is verified through its package code hash and ABI identity rather than a name displayed by an interface.

## The planned first World and sPuter

The proposed Ethereum launch introduces **sPuter** as the World token for the first Swaputer World.

The current launch plan specifies:

- token name: `Swaputer`;
- symbol: `sPuter`;
- initial issuance: 10,000 sPuter;
- no mint function after deployment;
- an initial boundary price of 0.0004 ETH per sPuter;
- all initial sPuter allocated across six single-sided Uniswap v4 liquidity positions;
- no initial ETH deposited as pool liquidity;
- a 0.30% Uniswap v4 LP fee;
- a 3% Swaputer protocol fee on buys and sells;
- additional sPuter burn for SVM bytes executed during eligible buys.

The protocol fee controller can change the protocol fee within the contract's onchain range of 0% to 10%. The final fee controller, fee administrator, liquidity-position owner, byte-gas price, allocation commitment, liquidity ranges, and all contract addresses must be disclosed in the verified Ethereum mainnet manifest.

These parameters remain launch inputs until that manifest is produced from observed deployment receipts. They should not be treated as a promise of price, liquidity, value, or return.

## An explicit experimental boundary

The first Swaputer mainnet release is planned as **unaudited experimental** software.

Internal unit, fuzz, invariant, differential, live-chain, and mainnet-fork tests provide engineering evidence. They are not an independent security audit and do not prove that the protocol is secure.

Swaputer Worlds are immutable execution boundaries. They do not have an administrative pause or in-place upgrade path. If a problem is discovered, official interfaces can stop recommending a World and a replacement can be deployed, but the original World cannot be silently patched or frozen.

Users should also account for risks outside the SVM itself, including smart-contract defects, malicious programs, incorrect interfaces or ABI interpretation, liquidity limitations, price impact, MEV, chain reorganizations, RPC or indexer failure, administrative-key compromise, and loss of liquidity-position control.

The initial release will use capped project-owned value and staged public access. No one should deposit funds they cannot afford to lose.

## What comes next

Swaputer begins with a narrow proposition: a swap can be more than an exchange of assets. It can be an authenticated entry into a persistent execution environment.

From that foundation, developers can create programs, assets, and applications that share the same World, economic entry point, and atomic settlement boundary. The most important applications may not resemble the interfaces that already exist. Swaputer's role is to make that design space possible without deciding in advance what every World must become.

The final Ethereum mainnet release manifest, verified contracts, launch transactions, and official interfaces will be announced after every required deployment check is complete.

Until then, developers can study the architecture and begin building with TinySol at [docs.swaputer.com](https://docs.swaputer.com).

Every world begins with a swap.

**Swaputer is built from the swap up.**
