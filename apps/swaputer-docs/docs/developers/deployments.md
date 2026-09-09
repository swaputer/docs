# Verify a Deployment

A Swaputer deployment is not identified by one contract address. Its identity is a mutually constrained set of network, World, contract, and code-hash values. Applications should load one fully verified release manifest rather than cherry-picking addresses across historical releases.

## Release identity

A usable release manifest should declare at least:

| Category | Required fields |
| --- | --- |
| Network | Network name, chain ID, confirmation policy |
| Protocol | Protocol version, VM version, ISA hash, Events signature |
| Uniswap v4 | PoolManager, PositionManager, Permit2, Universal Router addresses and runtime code hashes |
| Core | Factory, Swaputer Router, Registry addresses and runtime code hashes |
| World | World ID, config hash, Hook, Kernel, World token, WorldDeployer |
| Economics | Byte gas price, pool fee, tick spacing, initial price |
| Provenance | Source revision, artifact hashes, deployment blocks and transactions |

Application deployments should also record each Program ID, package hash, ABI hash, interface identity, and binding to any EVM component.

## Why an address is not enough

A single address cannot tell a client whether:

- the wallet is connected to the correct chain ID;
- the selected Router is the intended Swaputer Router or official Universal Router for this release;
- the World ID was derived from the same PoolKey;
- the Kernel, Hook, and programs match the documented code release;
- an ABI belongs to the deployed `ProgramPackage`;
- a record is the recommended release or a historical deployment.

Frontend configuration, Studio, indexers, and deployment scripts should derive their values from the same release object instead of maintaining independent sets of constants.

Transaction success follows the same rule. Wait for the manifest's confirmation
count, then re-read the receipt and transaction by hash and the containing block
by height. Their transaction hash, block hash, block number, and transaction
index must agree before an application presents the write as confirmed. A
missing or contradictory result is unresolved, not failed: retain the submitted
hash and prevent a blind retry until it has been reconciled.

## Verification sequence

### 1. Network

Confirm that the RPC chain ID matches the manifest:

```sh
cast chain-id --rpc-url "$RPC_URL"
```

Do not put authenticated RPC URLs in a release manifest. RPC endpoints are transport configuration, not protocol identity.

### 2. Runtime code

Read and hash the runtime bytecode at every core and upstream Uniswap v4 address:

```sh
cast code <address> --rpc-url "$RPC_URL"
cast codehash <address> --rpc-url "$RPC_URL"
```

Every result must match the manifest exactly. The presence of bytecode at an address does not prove that it is the expected bytecode.

For the direct SVM path, also verify that the official Universal Router reports the expected PoolManager and PositionManager, and that the PositionManager reports the expected PoolManager and Permit2.

### 3. Factory and World

Read the World configuration from the Factory and verify that:

- the World is sealed;
- the Factory is bound to the expected PoolManager and Router;
- the Hook, Kernel, and World token match the manifest;
- pool fee, tick spacing, `byteGasPrice`, and config hash match;
- the Pool ID derived from the PoolKey equals the World ID.

### 4. Program

For the target Program ID, call:

```text
Kernel.programCodeHash(worldId, programId)
```

The result must equal the Keccak package hash of the local `.svm` file. Then verify the ABI hash and Events descriptor. Never identify a program by name, selector, or Event topic alone.

### 5. Historical start block

An indexer must scan the declared Kernel from the deployment block in its manifest. A new Kernel runtime identity requires a new release and a new start block. Do not interpret Events from an old Kernel as history produced by a new protocol version.

## Recommended and historical releases

Historical deployment records should remain immutable so old transactions can be reproduced. A separate, explicit pointer or version file should identify the recommended release.

When updating that pointer:

1. publish a new immutable manifest;
2. independently reconstruct addresses, Pool ID, config hash, and runtime code hashes;
3. update the release pointer used by frontends, Studio, and indexers;
4. retain old manifests and their transaction evidence;
5. create a new World boundary for an incompatible VM, ISA, or signature version.

## Fail-closed clients

A client must stop constructing signatures when any of the following checks fails:

- chain ID mismatch;
- missing manifest address or hash;
- runtime code-hash mismatch;
- unsealed World or configuration mismatch;
- Program code hash and ABI mismatch;
- selected Router, Kernel, and Hook drawn from different releases;
- indexer data that cannot be traced back to the declared Kernel Events.

Historical reads may remain available, but state-changing operations must fail closed.
