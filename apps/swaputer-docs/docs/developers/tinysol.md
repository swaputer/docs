# TinySol

TinySol is a statically typed contract language for the SVM. Its deliberately small surface area makes compiled code, ABIs, storage layouts, and program identities independently reproducible.

::: info Compiler release status
The public npm compiler is `@swaputer-labs/tinysol@0.4.0`. It implements language v1.1 while
retaining `ProgramPackageV1`, SwapVM ISA v2, and byte-exact compatibility for the frozen legacy-v1
corpus.
:::

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
| `uint8` … `uint256` | Unsigned integers in 8-bit steps; same-signed widening is implicit |
| `int8` … `int256` | Two's-complement signed integers in 8-bit steps |
| `bool` | Accepts only canonical `0` or `1` |
| `bytes32` | Fixed 32-byte value, distinct from integers |
| `account` | Tagged 32-byte SVM Account ID |
| `address` | 20-byte EVM address; no implicit conversion to `account` |
| `T[N]` | Fixed array with `1 <= N <= 256` |
| `T[<=N]` | v1.1 bounded vector with variable logical length and fixed capacity |
| `bytes<N>` | v1.1 bounded byte sequence |
| `string<N>` | v1.1 bounded UTF-8 text; capacity is measured in bytes |

State may also declare `mapping(K => V)`. Mappings exist only in storage and cannot be copied or
returned as complete values. A direct state struct may contain a mapping field; such a struct is
storage-only and cannot cross an ABI boundary, become a local value, appear inside an array, or be a
mapping value. Each mapping field receives a deterministic namespace.

## Structs, enums, and arrays

Enums retain nominal types and lower to checked integer words in declaration order. Structs have
snapshot value semantics and may contain scalar values, enums, non-recursive structs, fixed arrays,
and bounded collections:

```solidity
enum Status { Pending, Active, Closed }

struct Profile {
    string<32> name;
    bytes<16> metadata;
    uint256[<=8] scores;
    Status status;
}
```

Fixed arrays work in storage, mappings, struct fields, locals, parameters, returns, events, errors,
and calls. Multidimensional arrays use Solidity's outer-to-inner declaration order:
`uint256[3][2] matrix` contains two rows of three elements. Dynamic indexes are bounds checked, and
partial fixed subarrays can be read, assigned, returned, passed, or deleted. Arrays of structs use a
deterministic field-first ABI layout.

## Bounded vectors, bytes, and strings

TinySol deliberately requires an explicit capacity for every variable-length value:

```solidity
contract MessageBook {
    string<64> title;
    bytes<32> payload;
    uint256[<=16] values;

    function update() external {
        title = "你好 TinySol";
        payload = "ab";
        payload.push(99);       // "abc"
        values.push(7);
        values[4] = 9;         // length becomes five; skipped elements are zero
        values.pop();
    }
}
```

`T[<=N]`, `bytes<N>`, and `string<N>` provide `.length`, `.push(value)`, `.pop()`, checked indexed
reads, capacity-checked indexed writes, whole-value assignment, and `delete`. Reads require
`index < length`. An indexed write may grow the logical length up to the fixed capacity; pushing at
capacity or popping an empty value reverts.

Their representation is deterministic: one length word followed by `N` fixed data words. The ABI is
therefore static rather than Solidity dynamic ABI. For example, `string<4>` lowers to
`uint256,uint8,uint8,uint8,uint8`; the selector uses that lowered signature. ABI inputs and
untrusted external returns validate the length and require unused scalar tail words to be zero.

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

TinySol supports scalar and composite state, mappings, local variables, `if/else`, `while`, `for`,
nearest-loop `break` and `continue`, `require`, named or bare `revert`, tuple destructuring, and
explicit return values. Fixed scalar or struct arrays may be declared in a `for` initializer; a
`continue` executes the `for` update before rechecking its condition.

State variables occupy full 32-byte slots in declaration order; no storage packing is applied. Mapping slots are derived deterministically from the contract name, variable name, declaration index, and key. Renaming or reordering state variables changes the storage layout, so proxy-style replacement is unsafe.

## Projects, imports, and libraries

`compileTinySolProject` resolves `./` and `../` imports inside a declared project root. v1.1 also
accepts npm-style bare specifiers only when `tinysol.lock.json` pins the exact project-relative file
and lowercase SHA-256 digest. URL imports, absolute paths, unpinned packages, symlink escapes, and
cycles are rejected. The build result records the lock hash and each module hash.

Libraries are statically linked and may contain only pure functions. TinySol has no dynamic library
loader and no mutable library state.

## Execution context

Programs can read protocol-controlled identity, route, World, buy, block, and metering context:

- caller: `msg.sender`, `this.id`, `tx.actor`;
- EVM route: `tx.router`, `tx.executor`, `tx.recipient`;
- World: `world.id`, `world.executionHeight`;
- execution buy: `buy.ethIn`, `buy.grossTokenOut`, `buy.tickAfter`;
- EVM block: `block.number`, `block.timestamp`;
- SVM meter: `gas.bytePrice`, `gas.bytesUsed`, `gas.bytesRemaining`.

The Kernel constructs these values and programs cannot override them. Transaction-wide fields are preserved across nested calls, while `msg.sender` changes to the immediate calling Program ID. Read-only EVM calls use a special zero-buy context.

See [SVM Context Reference](/developers/svm-context) for every field's type and exact behavior during root CALL, DEPLOY, nested calls, program creation, and `Kernel.staticCall`.

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

TinySol does not provide unbounded arrays, Solidity dynamic-ABI `string`/`bytes`, recursive structs,
nested mapping values, inheritance, modifiers, function overloading, runtime recursion, proxy
upgrades, `delegatecall`, arbitrary EVM calls, exception handling, floating-point values, unbounded
dynamic memory allocation, inline assembly, dynamic libraries, or mutable library state. Bounded
capacities and fixed-array dimensions are each limited to 256; recursively flattened static shapes
are limited to 65,536 words, and contract ABI input/output positions are limited to 32 words.

These constraints are part of the current verifiable compilation boundary. Do not disguise unsupported syntax through preprocessing, and do not assume that a future language version will preserve the same ABI or storage layout.
