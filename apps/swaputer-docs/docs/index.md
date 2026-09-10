# What is Swaputer?

> Swaputer turns a Uniswap v4 liquidity pool into a programmable onchain world.

Blockchains usually ask liquidity and applications to live beside one another. A token trades in one system, while the logic that gives it purpose runs somewhere else. Swaputer brings those two layers into one atomic environment.

Uniswap gives assets a market. Hooks let protocols extend what happens at the edge of a swap. Swaputer uses that edge to introduce a deterministic execution layer: when a user buys a World token, the same transaction can deploy or call an SVM program. The swap, program state, execution fee, and emitted Events settle together.

Liquidity becomes more than infrastructure around an application. It becomes the doorway into a shared execution environment.

## From a pool to a World

Each World is an independent execution environment defined by a Uniswap v4 pool, the Swaputer Hook, a Kernel, the SVM, and a fixed set of parameters. It has its own programs, accounts, state, and execution history.

- **The pool is the entry point.** Users enter a World through an ETH → token swap.
- **The Hook connects liquidity and computation.** Only protocol-compliant buys may carry a program Action.
- **The SVM hosts applications.** Programs can own state, call one another, and emit Events.
- **The World token pays for execution.** Fees are metered by bytes actually executed and burned from the tokens bought in that transaction.

![A Swaputer World connects a Uniswap v4 pool to the Kernel, SVM, programs, state, and Events.](/images/protocol-overview.svg)

## One atomic loop

1. A user selects a World and signs an Action to deploy or call a program.
2. An exact-input ETH → World token swap produces real token output.
3. The Hook verifies the swap direction, execution budget, and signed bindings.
4. The SVM executes the program and produces state changes and Events.
5. The protocol burns World tokens for the bytes actually executed and sends the remainder to the recipient.

The swap, execution, fee burn, and state transition share one atomic boundary. If the program reverts, the entire transaction reverts. No partial state remains, and no execution fee is charged in isolation.

## Why Uniswap v4 Hooks

Swaputer does not bolt liquidity onto an application after deployment. It is built directly into the swap lifecycle.

- **Atomic execution.** Asset exchange and program execution do not settle in separate transactions.
- **A market from day one.** Every World token begins with native price discovery, and the token → ETH exit path never enters the SVM.
- **Open composability.** Applications share a World's accounts, programs, and state boundary without deploying a new execution layer for every app.

## The protocol loop

A World begins with liquidity. Liquidity gives the World token an open market and creates the entry path for execution. Each executable buy can carry a signed Action into the SVM. Programs turn that execution into persistent state, assets, markets, and other applications. Execution is paid for in the same World token, linking demand for computation back to the market through a transparent burn.

```text
Liquidity → executable entry → programs and state → token-denominated execution → liquidity
```

This loop is the core of Swaputer. The protocol does not prescribe what the World must become. It provides the boundary in which liquidity, computation, and application state can evolve together.

## Protocol primitives

| Primitive | Definition |
| --- | --- |
| **World** | An isolated environment defined by a pool, Hook, Kernel, and immutable execution parameters |
| **Action** | An EIP-712 message in which an actor authorizes a deployment or program call |
| **SVM** | The virtual machine that executes deterministic programs and maintains World state |
| **Program** | An immutable application unit identified by a 32-byte Program ID |
| **Events** | Versioned records committed with execution results for clients and indexers to consume |

The complete vocabulary is defined in [Concepts & Terminology](/protocol/glossary).

## What can be built

Swaputer is an execution protocol rather than a single application. SRC20 assets, atomic markets, collateral-backed representations such as sETH, games, and coordination systems can all be implemented as programs inside a World.

These applications share the protocol's execution and settlement guarantees, but their business rules remain in immutable program code. See [What Can Be Built](/protocol/use-cases) for the application design space and the guarantees each category can inherit.

## Protocol boundaries

- Only exact-input ETH → World token buys can trigger stateful execution.
- Selling the real World token does not enter the SVM. Programs cannot block exits or add a sell tax.
- Program state is isolated by `worldId`. A reverted root execution commits no state, nonce, fee burn, or Events.
- SRC20, the sETH bridge, and the market are applications built on the protocol—not special cases embedded in the Kernel.
- A World's execution identity is determined by onchain components, fixed parameters, and code hashes—not by a name shown in a frontend.

## Where to go next

To understand the protocol and its design:

- [Core Model](/protocol/overview): Worlds, assets, and application boundaries
- [Execution & Settlement](/protocol/execution): Actions, swaps, metering, and atomicity
- [Security & Trust Model](/protocol/security): immutable boundaries, authorization, and residual risk

To start building:

- [Developer Quickstart](/developers/quickstart): install, compile, and verify the toolchain
- [Build Your First Program](/developers/first-program): go from TinySol source to deployment, calls, and reads
- [Actions & Signatures](/developers/actions): construct a valid onchain execution intent
