# Concepts & Terminology

Swaputer uses a small set of terms consistently across the protocol, compiler, indexer, explorer, and developer tools.

## World

An isolated protocol instance defined by a Uniswap v4 pool, Swaputer Hook, Kernel, World token, and immutable configuration. Programs, accounts, state, execution height, and Events are scoped to its `worldId`.

## World token

The real ERC-20 paired with ETH in a World's Uniswap v4 pool. It provides market access and pays byte-metered SVM execution fees. It is distinct from assets defined by SVM programs.

## Hook

The Uniswap v4 Hook that recognizes protocol-compliant executable buys, validates the swap-side constraints, and coordinates the transition into the Kernel. Ordinary World token sells do not enter the SVM.

## Kernel

The onchain component that verifies signed Actions, invokes the SVM, meters execution, and atomically commits deployments, state, nonces, execution height, token fee burn, and Events.

## SVM

The deterministic virtual machine used by programs inside a World. SVM means Swaputer Virtual Machine. It has explicit bounds for code, memory, stack, call depth, Events, receipts, and byte execution.

## Program

An immutable application unit deployed from a versioned package and identified by a 32-byte Program ID. A program owns storage, exposes an ABI, can call other programs, and can emit Events.

## Account

A 32-byte identity used by the SVM for actors and program accounts. An SVM `account` is not interchangeable with a 20-byte EVM `address`.

## Action

An EIP-712 signed authorization for DEPLOY or CALL. It binds the actor, World, operation, target, payload, execution budget, swap constraints, routing, nonce, and deadline.

## Program package

The versioned deployment artifact containing executable bytecode and constructor data. The package code hash is part of the program's verifiable identity.

## ABI hash

The hash of the interface descriptor used to encode external calls and decode return values and Events. Interface identity must be checked together with program code identity.

## Events

Versioned records emitted by programs and committed as part of a successful execution receipt. Indexers preserve the raw receipt and interpret Events only after validating the World, emitter, code hash, and ABI.

## Byte gas

Swaputer's execution meter. The signed `byteGasLimit` caps the instruction bytes an Action may execute, while the World's fixed `byteGasPrice` determines the maximum World token fee exposure. Host-network EVM gas remains separate.

## Atomic settlement

The guarantee that the buy, program execution, state changes, nonce, fee burn, and Events either commit together or revert together in one host-chain transaction.
