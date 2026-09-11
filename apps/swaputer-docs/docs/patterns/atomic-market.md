# Build an Atomic ETH/SRC20 Market

This pattern shows how an application can custody native ETH in an EVM market contract, custody SRC20 in an SVM escrow program, and exchange them inside one atomic EVM transaction.

It is an educational architecture, not a canonical Swaputer market or audited production implementation. Developers must define their own order policy, contracts, programs, deployment, frontend, monitoring, and security review.

## What you will learn

- how EVM ETH custody and SVM SRC20 custody coordinate;
- why the EVM market is an Action executor but not an SVM token spender;
- how buy orders and sell orders use different funding paths;
- how to verify escrow postconditions before paying a seller;
- how cancellation, expiry, refunds, and nonces affect liveness.

Before continuing, read [Integrate EVM and SVM](/developers/evm-svm-integration), [Actions & Signatures](/developers/actions), and [SVM Context Reference](/developers/svm-context).

## Components and trust boundaries

| Component | Responsibility |
| --- | --- |
| EVM market | Order status, ETH custody, price liability, envelope validation, settlement, and refunds |
| SVM SRC20 | User balances and allowances |
| SVM token escrow | SRC20 custody and accounted token liability |
| Client | Quotes, payload encoding, signatures, submission, and transaction reconciliation |
| Indexer | Order discovery and history; never authorization or settlement authority |

The EVM market binds one Router, Kernel, World, token Program ID and hash, and escrow Program ID and hash. The SVM escrow binds the token Program ID and EVM market address.

## Invariants

```text
EVM market ETH balance >= open ETH price liabilities + reserved execution ETH
actual SRC20 escrow balance >= accounted token liability
EVM token liability == SVM escrow accounted balance
each order moves from Open to exactly one terminal state
```

Unexpected ETH or SRC20 transfers are surplus. They must not create an order or increase an accounted liability.

## Order model

Start with all-or-nothing orders:

```solidity
enum Side { Buy, Sell }
enum Status { Open, Filled, Cancelled }

struct Order {
    Side side;
    Status status;
    address maker;
    address taker;
    uint128 amount;
    uint128 priceWei;
    uint128 vmEthAmount;
    uint64 expiry;
}
```

The deployment fixes World, token, and escrow identity globally. A multi-token design must additionally bind token Program ID, package hash, escrow Program ID, and package hash in every order.

Use exact integer units and checked arithmetic when deriving `priceWei`. Partial fills require explicit rules for rounding, residual amounts, execution funding, replay, and cancellation. Do not add them only at the frontend layer.

## 1. Build the SVM token escrow

The escrow pulls approved tokens from a seller and releases them only through the bound EVM market. Before/after balance checks reject non-conforming transfer behavior.

```solidity
interface SRC20 {
    function transfer(account, uint256) returns (bool);
    function transferFrom(account, account, uint256) returns (bool);
    function balanceOf(account) view returns (uint256);
}

contract TokenEscrow {
    account token;
    address market;
    uint256 accountedBalance;
    account zeroAccount;
    address zeroAddress;

    constructor(account token_, address market_) {
        require(token_ != zeroAccount);
        require(market_ != zeroAddress);
        token = token_;
        market = market_;
    }

    function deposit(account from, uint256 amount) external returns (uint256) {
        require(tx.executor == market);
        require(from == tx.actor);
        require(amount > 0);

        uint256 beforeBalance = staticcall SRC20.balanceOf(token, this.id);
        require(call SRC20.transferFrom(token, from, this.id, amount));
        uint256 afterBalance = staticcall SRC20.balanceOf(token, this.id);

        require(afterBalance >= beforeBalance);
        require(afterBalance - beforeBalance == amount);

        uint256 nextAccounted = accountedBalance + amount;
        require(nextAccounted >= accountedBalance);
        accountedBalance = nextAccounted;
        return accountedBalance;
    }

    function release(account recipient, uint256 amount) external returns (uint256) {
        require(tx.executor == market);
        require(recipient != zeroAccount);
        require(recipient == tx.actor);
        require(amount > 0);
        require(accountedBalance >= amount);

        uint256 beforeBalance = staticcall SRC20.balanceOf(token, this.id);
        require(beforeBalance >= amount);
        require(call SRC20.transfer(token, recipient, amount));
        uint256 afterBalance = staticcall SRC20.balanceOf(token, this.id);

        require(beforeBalance >= afterBalance);
        require(beforeBalance - afterBalance == amount);

        accountedBalance = accountedBalance - amount;
        return accountedBalance;
    }

    function escrowBalance() external view returns (uint256) {
        return staticcall SRC20.balanceOf(token, this.id);
    }

    function trustedMarket() external view returns (address) {
        return market;
    }
}
```

The `release` actor does not personally own the escrowed tokens, but the example requires the signed actor to be the recipient. Order ownership is enforced by the EVM market, while `tx.executor` ensures only that market can submit a release. The market must still bind actor, recipient, amount, and order state before calling it.

## 2. Approve the escrow correctly

The seller first approves the SVM escrow Program ID as SRC20 spender. Approval and deposit are separate Actions with separate nonces.

During the nested `transferFrom`, the token observes:

```text
tx.actor    = seller's SVM Account ID
msg.sender  = TokenEscrow Program ID
tx.executor = EVM market address
```

The allowance therefore belongs to:

```text
owner   = seller's SVM Account ID
spender = TokenEscrow Program ID
```

The EVM market address coordinates execution but is not an SVM token spender.

Use exact or intentionally bounded allowances. The client should display approval and order creation as two distinct authorizations.

## 3. Encode escrow operations

```ts
const sellerId = await kernel.eoaAccountId(sellerAddress);
const buyerId = await kernel.eoaAccountId(buyerAddress);

const depositPayload = concat([
  id("deposit(bytes32,uint256)").slice(0, 10),
  abi.encode(["bytes32", "uint256"], [sellerId, amount])
]);

const releasePayload = concat([
  id("release(bytes32,uint256)").slice(0, 10),
  abi.encode(["bytes32", "uint256"], [buyerId, amount])
]);
```

Both are 68 bytes: a four-byte selector plus two ABI words. The market must compare the full payload with the order, not only the selector.

Every market-mediated Action binds:

```ts
const action = {
  op: 2,
  worldId,
  actor: participantAddress,
  targetOrCodeHash: targetProgramId,
  payloadHash: keccak256(payload),
  byteGasLimit,
  minNetTokenOut,
  exactEthAmountIn: vmEthAmount,
  sqrtPriceLimitX96,
  recipient: worldTokenRecipient,
  router: swaputerRouterAddress,
  authorizedExecutor: marketAddress,
  nonce,
  deadline
};
```

## 4. Buy order: escrow ETH first

A buy maker commits ETH before a seller is known:

1. Buyer creates an order with `priceWei + vmEthAmount`.
2. Market stores the price and reserved execution amount as ETH liabilities.
3. Seller chooses the order and signs `transfer(buyerId, amount)` against the SRC20 Program ID.
4. Seller calls `fillBuyOrder` with the envelope.
5. Market validates seller, buyer, amount, token, World, Router, executor, deadline, and complete payload.
6. Market marks the order filled and removes its complete ETH liability.
7. Market sends the reserved `vmEthAmount` through the Router to transfer SRC20.
8. Market pays `priceWei` to the seller and refunds unused execution ETH by policy.

```ts
const transferPayload = concat([
  id("transfer(bytes32,uint256)").slice(0, 10),
  abi.encode(["bytes32", "uint256"], [buyerId, amount])
]);
```

The transfer Action uses:

```text
actor               = seller
target               = SRC20 Program ID
payload              = transfer(buyerId, amount)
authorizedExecutor   = EVM market
```

If the token transfer, result validation, seller payment, or solvency check fails, the order remains open and the buyer's ETH remains accounted as before.

## 5. Sell order: escrow SRC20 first

A sell maker deposits tokens before a buyer is known:

1. Seller grants the SVM escrow an allowance.
2. Seller signs `deposit(sellerId, amount)` with the EVM market as executor.
3. Seller calls `createSellOrder` and supplies deposit execution ETH.
4. Market validates the envelope and runs the escrow deposit.
5. Escrow verifies the exact balance increase and returns `accountedBalance`.
6. Market compares the returned balance with its new token liability before recording the open order.
7. Buyer later signs `release(buyerId, amount)` and submits `priceWei + releaseVmEthAmount`.
8. Market consumes the order, executes the release, verifies the new escrow balance, and pays the seller.

The settlement order should follow checks-effects-interactions:

```solidity
order.status = Status.Filled;
order.taker = msg.sender;
tokenLiability -= order.amount;

(, bytes32 result, uint32 resultLength) =
    router.buyVMExactInputWithResult{value: order.vmEthAmount}(
        worldId,
        sqrtPriceLimitX96,
        releaseEnvelope
    );

if (resultLength != 32) revert InvalidProgramResult();
if (uint256(result) != tokenLiability) revert EscrowMismatch();

(bool sent,) = order.maker.call{value: order.priceWei}("");
if (!sent) revert ETHTransferFailed();
```

The code is an architectural excerpt. A real implementation must also validate the complete envelope, exact `msg.value`, expiry, order status, refund, reentrancy, code identities, and final solvency.

## Value accounting

| Operation | Incoming EVM value | Long-lived liability | Router value |
| --- | --- | --- | --- |
| Create buy order | price + reserved execution amount | both until fill or cancellation | none at creation |
| Fill buy order | normally zero | complete buy liability is consumed | reserved execution amount |
| Create sell order | deposit execution amount | SRC20 liability appears in SVM escrow | deposit execution amount |
| Fill sell order | price + release execution amount | SRC20 liability is consumed | release execution amount |
| Cancel buy order | zero | price and unused execution reserve return to maker | none |
| Cancel sell order | release execution amount | SRC20 liability is consumed and returned | release execution amount |

Track ETH price liabilities, reserved execution ETH, pending refunds, and surplus separately. A contract balance alone cannot identify who owns each amount.

## Router refunds

The Router refunds unused execution input to the EVM market. The market should:

1. accept native ETH only from the immutable Router;
2. measure actual execution spend around the Router call;
3. calculate the exact unused difference;
4. send it to the refund recipient defined by the order policy;
5. keep the refund out of price and solvency accounting.

For a buy order, the maker normally owns the reserved execution refund. For a sell-order deposit, the seller normally owns it. For settlement funded by a buyer, the buyer normally owns it. Store the policy rather than inferring it from the current caller after state changes.

## Cancellation and expiry

### Buy orders

The maker can cancel an open buy order. After a valid expiry, the design may allow permissionless finalization while always returning ETH to the maker's stored refund address.

Set the order terminal state and reduce liability before sending ETH. A failed refund reverts the cancellation.

### Sell orders

Changing only the EVM status would strand SRC20 in SVM escrow. Cancellation therefore requires a fresh, executor-bound `release(sellerId, amount)` Action:

1. validate maker, open status, amount, and complete release envelope;
2. mark cancelled and reduce token liability;
3. execute the SVM release;
4. compare returned escrow accounting;
5. emit cancellation only after success.

Action nonces affect cancellation liveness. A pre-signed release becomes invalid after the same actor successfully uses another nonce. The safest baseline is a fresh cancellation signature. Do not assume delegated authorization exists unless the deployed Kernel and Action schema provide it.

## Fully prefunded bilateral trade

A bilateral variant can require both sides to fund custody before settlement:

1. buyer escrows ETH in the EVM market;
2. seller escrows SRC20 in the SVM program;
3. market records a matched pair after both postconditions pass;
4. one transaction releases SRC20 to buyer and ETH to seller;
5. any failed release or payment restores the pre-settlement state.

This improves execution certainty but increases cancellation and liveness requirements. Both owners need a safe exit after expiry, and SVM release still requires valid Action authority.

## Reads and Events

Read escrow state through `Kernel.staticCall` and pin EVM and SVM reads to one block when checking solvency:

```text
actual token balance >= escrow.accountedBalance
escrow.accountedBalance == EVM tokenLiability
EVM balance >= ETH liabilities
```

The EVM market should emit order creation, fill, cancellation, and refund events with order ID, side, maker, taker, token Program ID, amount, price, and execution spend. Correlate these with Kernel receipts by EVM transaction provenance.

An indexer can make orders discoverable but must not decide whether an order is open or authorized. Settlement reads canonical contract and program state.

## Failure cases to test

- expired, cancelled, filled, nonexistent, or wrong-side order;
- wrong actor, recipient, executor, World, token, escrow, amount, or payload;
- stale nonce, expired Action, changed quote, and insufficient byte limit;
- missing allowance or insufficient SRC20 balance;
- fee-on-transfer or false-returning token behavior;
- direct token transfer into escrow without accounted deposit;
- wrong SVM return length or postcondition;
- failed seller payment, failed refund, and reentrancy;
- overflow in price and liability arithmetic;
- cancellation replay and terminal-state double transition;
- indexer outage and containing-block reorganization.

## Production checklist

- Bind Router, Kernel, World, token, escrow, Program IDs, and hashes immutably.
- Require `tx.executor == market` in every escrow mutation.
- Validate every envelope field and full payload against canonical order state.
- Separate ETH price, execution reserve, refund, and surplus accounting.
- Compare SVM returned accounting with both EVM liability and independent balance reads.
- Make every order transition one-way and exactly once.
- Provide safe token and ETH exits after cancellation or expiry.
- Use reentrancy guards and checks-effects-interactions.
- Simulate the complete outer market call before signing.
- Treat indexers as presentation infrastructure only.
- Obtain an independent audit before accepting assets of value.

Continue with [Build a Swaputer Client](/developers/frontend-integration) for wallet disclosure, receipt reconciliation, and safe retry behavior.
