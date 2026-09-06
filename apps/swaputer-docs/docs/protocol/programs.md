# SVM Programs

The SVM is the deterministic execution environment inside a World. Programs define assets and application logic; the Kernel verifies execution and commits the result.

## Program lifecycle

- **DEPLOY** registers a `ProgramPackageV1`, runs its constructor, and derives a Program ID.
- **CALL** invokes an `external` entry point and may read or write program state.
- **STATICCALL** invokes a read-only entry point and rejects state changes.

Program code is immutable after deployment. A deployment, root call, and every nested call share the root Action's actor, execution context, call-depth limit, and byte budget. A failed nested call reverts the root execution.

## Accounts and storage

The SVM represents actors and program accounts with 32-byte Account IDs. An EVM `address` and an SVM `account` are distinct types; applications must convert and validate them explicitly.

Each program owns an isolated storage namespace. Programs can persist state, call other programs, create programs, return data, and emit Events. They cannot make arbitrary calls into EVM contracts.

## ABI and visibility

An `external` function appears in the ABI and external dispatch table. An `internal` function exists only as a subroutine within its program. Constructor arguments, function arguments, and return values follow the ABI emitted by the compiler.

## Events and indexing

Every successful execution produces a versioned receipt containing program Events in execution order. Indexers preserve the raw receipt, then interpret application Events against the `worldId`, emitter, immutable code hash, and ABI.

An event name or topic does not establish program identity. An explorer should label a program as a verified standard only when its code and interface identities match a known implementation.

See [Events & Indexing](/developers/events-indexing) for the receipt format, strict decoding, and reorg handling.
