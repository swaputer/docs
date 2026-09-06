# Security & Trust Model

Swaputer is not designed to give arbitrary programs arbitrary authority. It is designed to execute programs inside an explicit, verifiable boundary. Onchain contracts are the source of truth for state and settlement. Frontends, indexers, and ABI descriptors construct, display, and interpret data; they do not define protocol state.

## Trust assumptions

Swaputer relies on:

- the consensus and transaction atomicity of the host EVM network;
- the deployed Uniswap v4 PoolManager and selected Router on that network;
- the Factory, Swaputer Router, official Universal Router, Hook, Kernel, and code hashes declared in a release manifest;
- EIP-712 Actions signed by users;
- the immutable `ProgramPackage` actually deployed onchain.

An RPC endpoint, explorer, wallet interface, or indexer may lag, go offline, or interpret data incorrectly. None can change World state on its own. Every client-facing claim should be traceable to an onchain transaction, Kernel Events, and a program's code identity.

## Immutable Worlds

World creation fixes the PoolManager, Router, Hook, Kernel, World token, `byteGasPrice`, pool parameters, and protocol version. It also records a reproducible configuration hash.

An existing World does not use an admin-controlled hot swap for its Kernel, Hook, or SVM semantics. If the protocol changes its ISA, signature format, or security boundary, the new version must use a new code identity and a new World. Programs, state, and history in the old World remain anchored to their original boundary.

Immutability is not proof that code is safe. It means users and tooling can identify the exact code they are using. It also means a vulnerability cannot be silently patched inside an existing instance.

## Assets and exits

The real World token is an ERC-20 held and traded through a Uniswap v4 pool. Assets created by SVM programs live in program storage. The two layers do not share balance semantics.

- SVM programs cannot modify the real World token's ERC-20 transfer rules.
- World token → ETH sells do not execute SVM programs.
- Programs cannot install a sell tax, pause switch, or blacklist on the real World token.
- Applications such as the bridge and market can move assets only within their explicit bindings and authorization scope.

Sells remain subject to pool liquidity, price impact, slippage, MEV, and host-network conditions. Bypassing the SVM is not a guarantee of liquidity or execution price.

## Action authorization

Stateful DEPLOY and CALL operations require an EIP-712 Action. The signature commits to the World, actor, target, payload, execution cap, buy amount, minimum net output, price limit, recipient, router, executor, nonce, and deadline.

- `actor` is the SVM authority and must match the recovered signer.
- `nonce` prevents the same Action from executing twice.
- `deadline` limits the signature's lifetime.
- `authorizedExecutor` can restrict submission to one address; the zero address allows any relayer.
- A recipient or relayer that differs from the actor does not inherit the actor's program permissions.

See [Actions & Signatures](/developers/actions) for every signed field.

## Execution isolation and resource limits

Program state is isolated by `worldId + Program ID`. Nested calls inherit the root Action's actor, context, call-depth limit, and byte budget. A failed child call reverts the root execution.

The SVM enforces:

- a per-Action `byteGasLimit`;
- maximum code, memory, stack, and call-depth bounds;
- limits on Event count, Event data size, and receipt size;
- the underlying EVM transaction gas limit.

The byte budget caps the World token execution fee authorized by the user. EVM gas bounds the resources the host chain spends processing the transaction. One does not replace the other.

## Atomic commit

A successful transaction commits all of the following together:

- the Uniswap v4 swap;
- program storage and new deployments;
- actor nonce and execution height;
- bytes executed and World tokens burned;
- the aggregated Events receipt.

If any step fails, every result reverts. A failed execution cannot leave partial program state or burn the execution fee without committing the program result.

## Program and Event identity

A function selector, event name, or `Transfer` topic does not prove what code emitted it. Trusted interpretation should bind at least:

```text
worldId + Program ID + package code hash + ABI hash
```

An explorer may display raw Events from an unknown program, but it should not label a look-alike record as a verified SRC20, SRC721, or other standard. See [Events & Indexing](/developers/events-indexing) for the indexing rules.

## Residual risks

Some risks remain outside the protocol boundary:

| Risk | Impact |
| --- | --- |
| Pool liquidity and MEV | Changes swap output, slippage, and execution likelihood |
| Malicious or defective programs | Produces unintended state or consumes the signed execution budget within the program's authority |
| Incorrect ABI or frontend | Misrepresents the Action a user is asked to sign |
| RPC or indexer failure | Delays, omits, or briefly surfaces non-canonical data |
| Deployment or supply-chain error | Publishes an incorrect combination of code, artifacts, or addresses |
| Upstream vulnerability | Affects the host network, PoolManager, or another dependency |

Automated tests, differential tests, and live-chain exercises provide engineering evidence. They are not a substitute for an independent security audit.

## Verify before use

Before allowing a signature, wallets, applications, and integrations should verify at least:

1. the chain ID, World ID, Kernel, and selected Router come from the same release manifest;
2. onchain runtime code hashes match the manifest;
3. the Program ID resolves to the expected package code hash;
4. `payloadHash`, nonce, deadline, recipient, and executor match the user's intent;
5. maximum World token exposure and minimum net output are clearly disclosed;
6. the client does not present Events from an unverified program as standard asset Events.
