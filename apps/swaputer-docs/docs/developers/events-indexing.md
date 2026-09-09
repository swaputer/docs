# Events & Indexing

SVM programs do not emit one Ethereum log for every internal record. After each successful root execution, the Kernel emits one aggregated event:

```solidity
event Events(
    bytes32 indexed worldId,
    uint64 indexed executionHeight,
    bytes payload
);
```

Its canonical signature is `Events(bytes32,uint64,bytes)`. Topic 0 is:

```text
0x602812b230e5dc416bb4163643fb95093808246664e5b824bf2849ffb8c33d04
```

`payload` is a versioned `VMReceiptV1` containing program Events, deployment records, and the final execution summary.

## Why aggregate the receipt

One root Action may call several programs, create new programs, and produce many application records. An aggregated receipt preserves their actual execution order and commits all of the following at one boundary:

- program state changes;
- program deployments;
- actor nonce and execution height;
- World tokens burned;
- all program Events;
- the final `WorldExecution` summary.

A reverted root execution emits no successful Kernel Events and leaves none of its internal records behind.

## VMReceiptV1

The receipt header contains a version, flags, and record count. Each record contains:

```text
recordLength
emitter
topicCount
topics[]
dataLength
data
```

Current bounds are:

| Item | Limit |
| --- | ---: |
| Receipt records | 64 |
| Topics per record | 4 |
| Data per record | 4,096 bytes |
| Complete payload | 65,536 bytes |

The final record must be the only `WorldExecution` record. It includes the actor, root target, bytes executed, World tokens burned, gross output, and net output. A DEPLOY receipt also includes `MiniContractDeployed`.

## Decode a receipt

The public strict codec validates the complete payload before returning immutable records. It never returns a partial result after a decoding failure.

```sh
npm install @swaputer-labs/receipt-codec@0.1.2
```

```ts
import { decodeVMReceipt } from "@swaputer-labs/receipt-codec";

const receipt = decodeVMReceipt(payload);

console.log(receipt.recordCount);
console.log(receipt.worldExecution.executedBytes);
console.log(receipt.worldExecution.tokenBurned);
```

Pin the exact package version in production integrations. When starting from an
Ethereum transaction hash instead of an extracted receipt payload, use the
read-only verifier:

```sh
npx @swaputer-labs/cli@0.1.2 inspect 0xTRANSACTION_HASH \
  --network base-sepolia \
  --rpc-env BASE_SEPOLIA_RPC_URL
```

The RPC URL is read from the explicitly named environment variable and is never
accepted as a command-line argument or included in verifier output.

Unknown application records are preserved with their raw emitter, topics, and data. A client should not drop or rewrite records simply because an ABI is not yet available.

## Program identity

An Event topic describes a record's shape, not the identity of its emitter. Before decoding an SRC20 or another standard application Event, an indexer should verify that:

1. the outer event was emitted by the Kernel in the release manifest;
2. `worldId` is a registered World;
3. the emitter resolves to a real Program ID;
4. `Kernel.programCodeHash(worldId, emitter)` matches the descriptor;
5. the ABI hash, interface identity, and package hash meet the intended verification tier.

A custom program may emit `Transfer(bytes32,bytes32,uint256)`. Until its code identity is verified, present that record only as an unverified application Event.

## Recommended indexing pipeline

```text
Load a release manifest
  → register the Kernel and start block
  → scan the Events topic by block
  → strictly validate outer address, topics, and ABI data
  → decode the complete VMReceiptV1
  → store raw payload and onchain provenance
  → interpret application records by emitter + codeHash
  → build transaction, program, account, and application views
```

Store raw chain history separately from derived interpretations. A new ABI or verification status can rebuild derived data without rewriting the source receipt.

## Ordering and unique keys

Use this tuple to identify an SVM record:

```text
chainId + kernel + worldId + executionHeight + recordIndex
```

Also retain its Ethereum provenance: block number, block hash, transaction hash, and log index. Do not assume a transaction hash or execution height is globally unique across all networks and Kernels.

## Chain reorganizations

WebSockets provide low-latency block notifications, but they do not replace confirmations, backfills, or reorg handling. A production indexer should:

- use WebSocket messages as real-time triggers;
- backfill missing blocks and verify block hashes over HTTP JSON-RPC;
- retain canonical and orphaned history instead of deleting the old branch;
- replay derived state from the common ancestor;
- make repeated scans of the same block and Events idempotent;
- distinguish unconfirmed, confirmed, and orphaned data in its API.

An indexer outage affects query availability, not onchain SVM state. Before a value-bearing operation, applications should refresh the nonce, program identity, and required state directly from the chain.

## Reference indexer

Swaputer Explorer runs and maintains the Go indexer that provides:

- strict outer Events and receipt validation;
- configurable Kernel and start block;
- PostgreSQL raw history and derived views;
- reorg rollback, idempotent rescans, and orphan retention;
- code-hash-bound `verified` and `declared-unverified` decoding;
- cursor-paginated transaction, contract, account, SRC20, and market queries;
- WebSocket-first ingestion with HTTP reconciliation and RPC failover.

It is the reference implementation of the protocol data model, not part of onchain consensus.
