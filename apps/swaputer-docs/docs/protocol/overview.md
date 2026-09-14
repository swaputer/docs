# Core Model

Swaputer binds a liquidity pool, an execution environment, and a state boundary into a World. This page defines the components precisely. For the high-level thesis, begin with [What is Swaputer?](/).

## World

The `worldId` is derived from the bound pool's Pool ID. Every program, account, storage namespace, execution height, and Event is scoped to that `worldId`.

| Component | Responsibility |
| --- | --- |
| Uniswap v4 pool | Swaps between ETH and the World token, with native price discovery |
| Swaputer Hook | Recognizes executable buys and coordinates settlement |
| Kernel | Verifies Actions, runs the SVM, and commits state and Events |
| World token | A real ERC-20 in the pool that also pays for execution |

## Two asset layers

| | World token | Program-defined asset |
| --- | --- | --- |
| Where it lives | EVM and the Uniswap v4 pool | SVM program state |
| How it is acquired | The outer swap | Program-defined minting, transfer, or settlement |
| Rules | ERC-20 and pool semantics | Immutable program code |
| Examples | A World's native token | SRC20, app points, program state |

These assets do not share balance semantics. An SVM program cannot modify the real World token's transfer rules or control its sell path.

## Programs define applications

The Kernel provides execution, storage, calls, metering, and Events. It does not hardcode a particular asset or application model. SRC20 and future applications are implemented as programs, optionally with narrowly bound EVM components.

A program's identity is established by its deployment package, code hash, and ABI. Matching an event name or function selector does not make two programs equivalent.

See [What Can Be Built](/protocol/use-cases) for the application design space.

## Version boundaries

At creation, a World commits to its Hook, Kernel, World token, `byteGasPrice`, and protocol version. A change to the VM, ISA, or security boundary requires a new code identity and a new World. Existing program identities, state, and history remain verifiable within the original World.

See [Security & Trust Model](/protocol/security) for the immutable boundary, client verification requirements, and risks outside the protocol.
