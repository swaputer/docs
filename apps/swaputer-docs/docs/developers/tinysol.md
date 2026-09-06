# TinySol

TinySol is a statically typed contract language for the SVM. Its deliberately small surface area makes compiled code, ABIs, storage layouts, and program identities independently reproducible.

## Minimal program

```solidity
contract Counter {
    uint256 value;

    constructor(uint256 initialValue) {
        value = initialValue;
    }

    function increment(uint256 amount) external returns (uint256) {
        value = value + amount;
        return value;
    }

    function get() external view returns (uint256) {
        return value;
    }
}
```

Functions default to `external` when visibility is omitted. Production programs should declare visibility explicitly so helper functions are not accidentally exposed through the ABI.

## Types

| Type | Semantics |
| --- | --- |
| `uint256` | Unsigned integer modulo `2²⁵⁶` |
| `int256` | Two's-complement signed integer |
| `bool` | Accepts only canonical `0` or `1` |
| `bytes32` | Fixed 32-byte value, distinct from integers |
| `account` | Tagged 32-byte SVM Account ID |
| `address` | 20-byte EVM address; no implicit conversion to `account` |

State may also declare `mapping(K => V)`. Mappings exist only in storage. TinySol v1 does not support nested mappings, copying a mapping, or returning a complete mapping.

## Functions and visibility

- `constructor` runs during DEPLOY and has no four-byte selector.
- `external` functions appear in the ABI and runtime dispatch table. They can be called by a root CALL or another program.
- `internal` functions are subroutines available only inside the current program and do not appear in the ABI.
- `view` functions cannot modify storage, emit Events, create programs, or make a state-changing call.

An internal call currently requires the callee to return exactly one value. An internal function with multiple return values cannot be called as an expression. Cross-program calls use compile-time `interface` declarations:

```solidity
interface CounterAPI {
    function get() view returns (uint256);
}

contract Reader {
    function read(account target) external view returns (uint256) {
        return staticcall CounterAPI.get(target);
    }
}
```

An `interface` is a type-checking construct. It deploys no runtime object and does not grant arbitrary access to EVM contracts.

## State and control flow

TinySol supports scalar state, mappings, local variables, `if/else`, `while`, `for`, `require`, `revert`, and explicit return values.

State variables occupy full 32-byte slots in declaration order; no storage packing is applied. Mapping slots are derived deterministically from the contract name, variable name, declaration index, and key. Renaming or reordering state variables changes the storage layout, so proxy-style replacement is unsafe.

## Execution context

Programs can read a protocol-controlled, read-only context:

- `msg.sender`, `this.id`, `tx.actor`
- `world.id`, `world.executionHeight`
- `buy.ethIn`, `buy.grossTokenOut`, `buy.tickAfter`
- `gas.bytePrice`, `gas.bytesUsed`, `gas.bytesRemaining`
- `block.number`, `block.timestamp`
- `tx.router`, `tx.executor`, `tx.recipient`

The Kernel constructs these values and preserves them across nested calls. Programs cannot override them.

## Events

Event topic 0 is the Keccak hash of the canonical signature. Up to three user fields may be marked `indexed`. The compiler also emits an Events descriptor containing event signatures, field positions, the ABI hash, and package code hash.

A custom program can emit an Event shaped like a standard `Transfer`, but a name and topic do not prove that the emitter is a verified SRC implementation.

## Compiler artifacts

| File | Purpose |
| --- | --- |
| `.svm` | Versioned `ProgramPackage` and executable code |
| ABI | External functions, constructor arguments, and return values |
| Events | Event signatures, fields, and indexed positions |
| Storage layout | State slots and mapping domains |
| Manifest | Compiler, ISA, source, and artifact hashes |
| Assembly | Deterministic SVM assembly |
| Source map | Bytecode-to-source location mapping |

## Current limits

TinySol v1 does not provide dynamic arrays, strings, dynamic bytes, inheritance, function overloading, recursion, proxy upgrades, `delegatecall`, arbitrary EVM calls, exception handling, floating-point values, dynamic memory allocation, or inline assembly.

These constraints are part of the current verifiable compilation boundary. Do not disguise unsupported syntax through preprocessing, and do not assume that a future language version will preserve the same ABI or storage layout.
