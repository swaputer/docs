# What is Swaputer?

> Swaputer turns a Uniswap v4 liquidity pool into a programmable onchain world.

Swaputer uses a Uniswap v4 Hook to connect liquidity with deterministic program execution. When a user buys a World token, the same transaction can deploy or call an SVM program; the swap, program state, execution fee, and Events settle together.

## From a pool to a World

Each World is an independent execution environment defined by a Uniswap v4 pool, the Swaputer Hook, a Kernel, the SVM, and a fixed set of parameters. It has its own programs, accounts, state, and execution history.

- **The pool is the entry point.** Users enter a World through an ETH → token swap.
- **The Hook connects liquidity and computation.** Only protocol-compliant buys may carry a program Action.
- **The SVM hosts applications.** Programs can own state, call one another, and emit Events.
- **The World token pays for execution.** Fees are metered by bytes actually executed and burned from the tokens bought in that transaction.

![A Swaputer World connects a Uniswap v4 pool to the Kernel, SVM, programs, state, and Events.](/images/protocol-overview-light-v2.svg)

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

Swaputer is an execution protocol rather than a single application. SRC20 assets, atomic exchanges, games, and coordination systems can all be implemented as programs inside a World.

These applications share the protocol's execution and settlement guarantees, but their business rules remain in immutable program code. See [What Can Be Built](/protocol/use-cases) for the application design space and the guarantees each category can inherit.

## Protocol boundaries

- Only exact-input ETH → World token buys can trigger stateful execution.
- Selling the real World token does not enter the SVM. Programs cannot block exits or add a sell tax.
- Program state is isolated by `worldId`. A reverted root execution commits no state, nonce, fee burn, or Events.
- SRC20 and future applications are built on the protocol—not special cases embedded in the Kernel.
- A World's execution identity is determined by onchain components, fixed parameters, and code hashes—not by a name shown in a frontend.

## Where to go next

- [Architecture in 5 Minutes](/architecture) for the complete system model.
- [Address](/developers/deployments) for the official Ethereum Mainnet contracts.
- [Developer Quickstart](/developers/quickstart) and [Build Your First Program](/developers/first-program) to start coding.
- [Integrate EVM and SVM](/developers/evm-svm-integration) for applications that coordinate both execution domains.
- [Security & Trust Model](/protocol/security) before handling assets of value.
