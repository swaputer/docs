# Build an ETH-Backed SRC20

This pattern shows how an application can accept native ETH into an EVM reserve, mint an application-owned SRC20 representation, burn that representation, and return the corresponding ETH.

It is an educational architecture, not a canonical Swaputer asset or an audited production contract. The developer owns the reserve, token program, deployment, interface, monitoring, and security policy.

## What you will learn

- how EVM ETH custody and SVM token accounting fit together;
- how to authorize mint and burn with `tx.executor`;
- how to bind a reserve and token program deterministically;
- how to separate backing ETH from execution ETH;
- how one EVM transaction makes deposit/mint and burn/redemption atomic.

Before continuing, read [Integrate EVM and SVM](/developers/evm-svm-integration) and [SVM Context Reference](/developers/svm-context).

## Asset flow

```text
Deposit

User ── backing ETH ──► EVM reserve
  └── signed mint Action + execution ETH
                └─────► Router → Kernel → SRC20 program → mint

Redemption

User ── signed burn Action + execution ETH
                └─────► Router → Kernel → SRC20 program → burn
EVM reserve ── backing ETH ──► chosen recipient
```

Both arrows in each operation are enclosed by one outer EVM transaction.

## Invariant and ownership

The primary invariant is:

```text
SRC20 total supply == vault ETH liability <= vault ETH balance
```

| Component | Source of truth | Immutable trust |
| --- | --- | --- |
| EVM reserve | Native ETH and `lockedEth` liability | Router, Kernel, World, SRC20 Program ID, package hash |
| SVM token | Supply, balances, allowances | EVM reserve address as privileged executor |
| Client | Encoding, simulation, signing, receipt reconciliation | Verified release and application manifest |

The reserve may receive forced ETH. That creates surplus, not token backing authority or user liability. Supply must follow successful deposits, never raw `address(this).balance`.

## 1. Define the privileged token boundary

The token program allows mint and burn only when the root Action names the reserve as authorized EVM executor:

```solidity
contract WrappedETH {
    event Transfer(account indexed from, account indexed to, uint256 amount);

    uint256 supply;
    mapping(account => uint256) balances;
    address reserveVault;
    account zeroAccount;
    address zeroAddress;

    constructor(address vault_) {
        require(vault_ != zeroAddress);
        reserveVault = vault_;
    }

    function vaultMint(account recipient, uint256 amount) external returns (uint256) {
        require(tx.executor == reserveVault);
        require(recipient != zeroAccount);
        require(amount > 0);

        uint256 nextSupply = supply + amount;
        uint256 nextBalance = balances[recipient] + amount;
        require(nextSupply >= supply);
        require(nextBalance >= balances[recipient]);

        supply = nextSupply;
        balances[recipient] = nextBalance;
        emit Transfer(zeroAccount, recipient, amount);
        return supply;
    }

    function vaultBurn(uint256 amount) external returns (uint256) {
        require(tx.executor == reserveVault);
        require(amount > 0);
        require(balances[tx.actor] >= amount);

        balances[tx.actor] = balances[tx.actor] - amount;
        supply = supply - amount;
        emit Transfer(tx.actor, zeroAccount, amount);
        return supply;
    }

    function balanceOf(account owner) external view returns (uint256) {
        return balances[owner];
    }

    function totalSupply() external view returns (uint256) {
        return supply;
    }

    function vault() external view returns (address) {
        return reserveVault;
    }
}
```

This excerpt shows the reserve-specific boundary. A complete SRC20 implementation must also provide the required metadata, transfer, allowance, and `transferFrom` behavior.

Why the checks use different identities:

- `tx.executor` proves the Action was submitted through the bound reserve;
- `tx.actor` identifies the signed SVM balance owner during burn;
- `recipient` is an explicit SVM account argument during mint;
- `msg.sender` is not sufficient because nested calls can change the immediate SVM caller.

Do not add a second admin mint, generic privileged call, mutable vault setter, or unrestricted reserve withdrawal.

## 2. Define a narrow EVM reserve

The external interface can remain small:

```solidity
interface IETHReserve {
    function deposit(
        uint128 amount,
        uint128 vmEthAmount,
        SwapVMKernel.VMEnvelope calldata envelope,
        uint160 sqrtPriceLimitX96
    ) external payable;

    function redeem(
        uint128 amount,
        uint128 vmEthAmount,
        address recipient,
        SwapVMKernel.VMEnvelope calldata envelope,
        uint160 sqrtPriceLimitX96
    ) external payable;

    function lockedEth() external view returns (uint256);
}
```

Store immutable references to:

- Swaputer Router and Kernel;
- World ID;
- SRC20 Program ID and expected package hash;
- maximum operation-specific SVM byte limit.

Use a reentrancy guard on both state-changing functions. Restrict payable refunds to the Router and reject unknown function selectors.

## 3. Resolve the deployment cycle

The token constructor needs the reserve address, while the reserve constructor should bind the Program ID and package hash. Resolve this with deterministic derivation:

1. compile the complete token program and calculate its package hash;
2. read the deployer's SVM creator nonce;
3. derive the future Program ID;
4. encode the reserve creation bytecode with that identity;
5. derive the future reserve address with `CREATE2`;
6. deploy the token using that predicted reserve address;
7. verify the deployed Program ID, package hash, and stored `vault()`;
8. deploy the reserve at the predicted address;
9. verify all immutable bindings in both directions.

```ts
const creatorId = await kernel.eoaAccountId(deployer.address);
const creatorNonce = await kernel.creatorNonce(worldId, creatorId);
const programId = await kernel.contractAccountId(
  worldId,
  creatorId,
  creatorNonce,
  packageHash
);

const reserveAddress = getCreate2Address(
  reserveDeployer,
  reserveSalt,
  keccak256(reserveCreationCode(programId, packageHash))
);
```

Abort if any predicted identity differs after deployment. Do not deploy against a temporary controller and mutate the relationship later.

## 4. Deposit ETH and mint

### Encode the mint

Convert the receiving EVM address through the bound Kernel:

```ts
const recipientId = await kernel.eoaAccountId(recipientAddress);
const mintPayload = concat([
  id("vaultMint(bytes32,uint256)").slice(0, 10),
  abi.encode(["bytes32", "uint256"], [recipientId, amount])
]);
```

Build a CALL Action with:

```ts
const action = {
  op: 2,
  worldId,
  actor: payerAddress,
  targetOrCodeHash: tokenProgramId,
  payloadHash: keccak256(mintPayload),
  byteGasLimit,
  minNetTokenOut,
  exactEthAmountIn: vmEthAmount,
  sqrtPriceLimitX96,
  recipient: worldTokenRecipient,
  router: swaputerRouterAddress,
  authorizedExecutor: reserveVaultAddress,
  nonce,
  deadline
};
```

The SVM token recipient is inside `mintPayload`. The EVM `action.recipient` receives net World tokens left after execution. They may represent the same user but are different fields and types.

### Validate on EVM

Before increasing liability, require:

- `amount > 0` and `vmEthAmount > 0`;
- `msg.value == amount + vmEthAmount`;
- envelope operation, World, Program ID, actor, recipient, and executor match;
- payload is exactly 68 bytes and equals `vaultMint(recipientId, amount)`;
- byte limit and deadline satisfy reserve policy;
- current Program ID still resolves to the bound package hash.

### Execute and compare supply

```solidity
lockedEth += amount;

(, bytes32 result, uint32 resultLength) =
    router.buyVMExactInputWithResult{value: vmEthAmount}(
        worldId,
        sqrtPriceLimitX96,
        envelope
    );

if (resultLength != 32) revert InvalidProgramResult();
if (uint256(result) != lockedEth) revert SupplyMismatch();
if (address(this).balance < lockedEth) revert Insolvent();
```

The client calls:

```ts
await reserve.deposit(amount, vmEthAmount, envelope, sqrtPriceLimitX96, {
  value: amount + vmEthAmount
});
```

The reserve retains `amount` as backing and sends only `vmEthAmount` to the Router. A failed mint, postcondition, or solvency check reverts the liability update and ETH transfer.

## 5. Burn and redeem

The token owner signs a fresh Action. The burn amount is taken from `tx.actor`:

```ts
const burnPayload = concat([
  id("vaultBurn(uint256)").slice(0, 10),
  abi.encode(["uint256"], [amount])
]);
```

Bind:

- `actor` to the SRC20 owner;
- target to the token Program ID;
- executor to the reserve;
- EVM recipient to the address that should receive the remaining World tokens;
- the redemption ETH recipient in the reserve function arguments and validated application intent.

The call carries execution ETH only:

```ts
await reserve.redeem(amount, vmEthAmount, ethRecipient, envelope, sqrtPriceLimitX96, {
  value: vmEthAmount
});
```

The reserve should:

1. validate amount, recipient, liability, and complete envelope;
2. reduce `lockedEth`;
3. execute `vaultBurn`;
4. require a 32-byte result equal to the new liability;
5. send `amount` ETH to `ethRecipient`;
6. assert remaining ETH balance covers remaining liability;
7. emit the redemption event.

If the SVM burn or final ETH transfer fails, the outer revert restores token balance, supply, reserve liability, and custody.

## 6. Account for Router refunds

The Router refunds unused execution ETH to the reserve, because the reserve is its immediate caller. Accept refunds only from the immutable Router:

```solidity
receive() external payable {
    if (msg.sender != address(router)) revert OnlyRouterRefund(msg.sender);
}
```

Measure the actual execution spend and return the proven unused difference to the payer. Keep separate accounting for:

```text
backing ETH       = long-lived reserve liability
execution ETH     = temporary Router input
execution refund  = unused Router input owed to the payer
forced ETH        = surplus, never automatic liability
```

## 7. Read and monitor solvency

Read SVM supply and balances through `Kernel.staticCall`:

```ts
const ownerId = await kernel.eoaAccountId(ownerAddress);
const balancePayload = concat([
  id("balanceOf(bytes32)").slice(0, 10),
  abi.encode(["bytes32"], [ownerId])
]);

const [output] = await kernel.staticCall(
  worldId,
  tokenProgramId,
  balancePayload,
  2_000
);
const [balance] = abi.decode(["uint256"], output);
```

Pin all reserve, supply, and balance reads to one EVM block. Continuously verify:

```text
totalSupply == lockedEth
reserveBalance >= lockedEth
programCodeHash == expectedPackageHash
token.vault() == reserveAddress
```

Emit EVM deposit and redemption events containing the actor, ETH recipient, SVM Program ID, amount, and actual execution spend. Correlate them with the Kernel receipt in the same transaction.

## Failure cases to test

- wrong actor, World, Router, executor, Program ID, recipient, amount, selector, nonce, or deadline;
- insufficient or excessive `msg.value`;
- insufficient SVM execution output or byte limit;
- mint or burn returning the wrong supply;
- zero recipient and zero amount;
- replayed Action;
- failed Router call or malformed result length;
- failed ETH recipient call and reentrancy;
- forced ETH and unexpected Router refunds;
- package-hash or binding mismatch;
- containing EVM block reorganization.

## Production checklist

- Preserve the one-to-one supply/liability invariant after every transition.
- Make the reserve the only privileged token executor.
- Keep all protocol and counterpart bindings immutable.
- Validate the full payload, not only its selector.
- Separate backing, execution input, refunds, and surplus.
- Use checked accounting, reentrancy protection, and checks-effects-interactions.
- Provide no admin mint, arbitrary withdrawal, generic call, proxy, or delegatecall path.
- Simulate the complete outer reserve call before signature.
- Fail closed when program identity or release verification fails.
- Obtain independent review before accepting deposits of value.

Continue with [Build a Swaputer Client](/developers/frontend-integration) for wallet disclosure, transaction states, and safe retries.
