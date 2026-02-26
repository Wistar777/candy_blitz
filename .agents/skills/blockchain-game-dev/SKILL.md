---
name: Blockchain Game & App Development
description: Universal guide for building on-chain games and dApps based on real production experience (Candy Blitz on Solana + MagicBlock ER). Applies to Solana, EVM, Sui, Aptos, and other chains.
---

# Blockchain Game & App Development Skill

> Based on real-world experience building **Candy Blitz** — a fully on-chain Match-3 game with MagicBlock Ephemeral Rollups on Solana.

---

## 1. Architecture Pattern

Every blockchain game/dApp has **3 layers**:

```
┌─────────────────────────────────┐
│          FRONTEND               │  HTML/JS/React/Unity
│  (game logic, UI, wallet)       │
├─────────────────────────────────┤
│      BLOCKCHAIN ADAPTER         │  wallet connect, tx building,
│  (client-side SDK layer)        │  serialization, RPC calls
├─────────────────────────────────┤
│       SMART CONTRACT            │  Rust/Solidity/Move
│  (on-chain state & rules)       │  deployed on-chain
└─────────────────────────────────┘
```

### Key Principle: Separation of Concerns

- **Frontend** knows NOTHING about blockchain internals. It calls adapter functions like `submitScore(level, score)`.
- **Blockchain Adapter** handles wallet connection, transaction building, serialization, RPC communication. This is the ONLY file that imports blockchain SDKs.
- **Smart Contract** enforces rules and stores canonical state. Treat it as the "backend".

### File Structure Template

```
project/
├── game/                        # Frontend
│   ├── index.html               # Entry point
│   ├── app.js                   # Main app logic
│   ├── blockchain.js            # Blockchain adapter (ONLY blockchain code here)
│   ├── config.js                # Game config, levels, constants
│   ├── storage.js               # Local storage wrapper
│   └── ...                      # UI, audio, effects modules
│
├── contracts/                   # Smart contract
│   ├── src/lib.rs               # Solana/Anchor
│   ├── contracts/Game.sol       # OR EVM/Solidity
│   └── sources/game.move        # OR Sui/Aptos Move
│
└── README.md
```

---

## 2. Wallet Integration (Universal)

### Pattern: Provider Detection + Modal Selection

Works for ANY blockchain:

```javascript
// 1. Define known wallets
const WALLETS = [
    { name: 'Phantom', detect: () => window.phantom?.solana, url: 'https://phantom.app' },
    { name: 'MetaMask', detect: () => window.ethereum, url: 'https://metamask.io' },
    { name: 'Sui Wallet', detect: () => window.suiWallet, url: 'https://suiwallet.com' },
];

// 2. Show modal with detected/installable wallets
function showWalletModal() {
    for (const w of WALLETS) {
        const detected = !!w.detect();
        // Show "Detected" badge or "Install" link
    }
}

// 3. Connect and store provider name for auto-reconnect
async function connect(wallet) {
    const provider = wallet.detect();
    const account = await provider.connect();
    localStorage.setItem('lastWallet', wallet.name);
    return account;
}

// 4. Auto-reconnect on page load
async function tryAutoReconnect() {
    const lastWallet = localStorage.getItem('lastWallet');
    if (!lastWallet) return;
    const wallet = WALLETS.find(w => w.name === lastWallet);
    if (wallet?.detect()) await connect(wallet);
}
```

### Critical Rules

- **Never store private keys or seed phrases** in code or localStorage
- **Always show a reconnection overlay** while auto-reconnecting (prevents flickering UI)
- **Handle disconnection gracefully** — navigate user back to connect screen
- **Save wallet provider name** (not address) in localStorage for auto-reconnect

---

## 3. Smart Contract Design Patterns

### Pattern: Player Account (PDA / Mapping)

Store per-player state **on-chain**:

**Solana (Anchor/Rust):**
```rust
#[account]
pub struct PlayerAccount {
    pub authority: Pubkey,          // wallet owner
    pub best_scores: [u64; 6],     // per-level scores
    pub stars: [u8; 6],            // star ratings
    pub completed_levels: u8,      // bitmask
    pub games_played: u32,
}
// PDA seeds: ["player", user_wallet_pubkey]
```

**EVM (Solidity):**
```solidity
struct PlayerData {
    uint256[] bestScores;
    uint8[] stars;
    uint8 completedLevels;
    uint32 gamesPlayed;
}
mapping(address => PlayerData) public players;
```

**Sui (Move):**
```move
struct PlayerAccount has key, store {
    id: UID,
    best_scores: vector<u64>,
    stars: vector<u8>,
    completed_levels: u8,
    games_played: u32,
}
```

### Pattern: Instruction Set

Every game contract needs these core instructions:

| Instruction | Purpose |
|------------|---------|
| `initialize_player` | Create player account on first connect |
| `submit_score` | Record game result |
| `update_state` | Modify game state (eg. swap, move) |
| `fetch_leaderboard` | Read all player accounts for ranking |

### Pattern: Idempotent Init

Always use **init-if-needed** pattern to avoid errors on repeat calls:

```rust
// Solana/Anchor
#[account(init_if_needed, payer = user, seeds = [...], bump)]
pub player_account: Account<'info, PlayerAccount>,
```

```solidity
// Solidity
function ensurePlayer() internal {
    if (players[msg.sender].gamesPlayed == 0) {
        // initialize
    }
}
```

---

## 4. Transaction Flow Patterns

### Pattern: Critical vs Fire-and-Forget

Classify every transaction:

| Type | Example | Wait for confirmation? |
|------|---------|----------------------|
| **Critical** | Submit score, init account | ✅ Yes, show spinner |
| **Fire-and-forget** | Record swap, analytics | ❌ No, non-blocking |
| **Batched** | Multiple updates → one TX | ✅ Yes, batch for gas savings |

```javascript
// Fire-and-forget (non-blocking)
connection.sendRawTransaction(tx.serialize(), { skipPreflight: true })
    .then(sig => console.log('Recorded'))
    .catch(err => console.warn('Failed (non-blocking):', err));

// Critical (blocking with UI feedback)
const sig = await connection.sendRawTransaction(tx.serialize());
await connection.confirmTransaction(sig, 'confirmed');
showSuccess('Score saved on-chain! ✅');
```

### Pattern: Optimistic UI + Fallback

```
1. Local state updates IMMEDIATELY (optimistic)
2. Blockchain TX sent in background
3. On confirmation → sync local with on-chain
4. On failure → show warning, keep local state
```

### Pattern: Multi-Step Blockchain Operations

When a user action requires multiple TXs (e.g., delegate → play → commit → undelegate):

```javascript
async function gameEndFlow(score) {
    showLoading('Step 1/3: Committing...');
    const step1 = await commitScore(score);

    showLoading('Step 2/3: Settling...');
    const step2 = await waitForSettlement();

    showLoading('Step 3/3: Saving...');
    const step3 = await submitToMainChain(score);

    showSuccess('Done! ✅');
}
```

**Rule**: Always show the user which step they're on. Never leave them with a generic spinner.

---

## 5. State Management: Dual Storage

### Pattern: Local-First, Chain-Second

```
localStorage  ←→  On-Chain (source of truth)
     ↑                    ↑
  Fast reads         Persistent
  Instant UI         Cross-device
  Offline OK         Verifiable
```

**On app load:**
1. Load from localStorage (instant UI)
2. Fetch from chain (background)
3. If chain data is newer → update local
4. If chain is unavailable → use local (graceful degradation)

```javascript
async function loadProgress() {
    // 1. Instant: local
    let progress = Storage.load('progress', {});
    renderUI(progress);

    // 2. Background: on-chain
    const onChain = await fetchFromChain();
    if (onChain && onChain.score > progress.score) {
        progress = onChain;
        Storage.save('progress', progress);
        renderUI(progress);
    }
}
```

### Pattern: Wallet-Scoped Storage

Prefix all localStorage keys with wallet address:

```javascript
function storageKey(key) {
    const wallet = getWalletAddress() || 'anonymous';
    return `${wallet}_${key}`;
}
```

This prevents progress mixing when users switch wallets.

---

## 6. Layer-2 / Rollup Integration

If your game needs **low-latency transactions** (real-time gameplay), use a Layer-2:

| Chain | L2 Solution | Use Case |
|-------|------------|----------|
| Solana | MagicBlock Ephemeral Rollups | Temporary fast state |
| EVM | Optimism / Arbitrum / zkSync | Cheap + fast TXs |
| Sui | Already fast (~400ms finality) | Usually not needed |

### MagicBlock ER Pattern (Solana-specific)

```
1. DELEGATE:   Player PDA → ER validator (1 wallet popup)
2. PLAY:       All game TXs on ER (ephemeral keypair, no popups)
3. COMMIT:     Final state committed on ER
4. UNDELEGATE: PDA returns to base layer (Devnet/Mainnet)
5. SETTLE:     Wait for PDA ownership to transfer back
```

**Ephemeral Keypair Pattern:**
```javascript
// Generate per-session keypair (no wallet popup during gameplay)
const ephemeralKeypair = Keypair.generate();
// Use it to sign ALL ER transactions
tx.sign(ephemeralKeypair);
```

### Generic L2 Pattern (EVM)

```javascript
// Bridge to L2
await l2Bridge.deposit({ amount, l1Token });

// Interact on L2 (cheap TXs)
await l2Contract.recordMove(moveData);

// Withdraw back to L1 (when done)
await l2Bridge.withdraw({ amount });
```

---

## 7. Leaderboard Pattern

### On-Chain Leaderboard (Solana)

Scan all program accounts, deserialize, sort:

```javascript
async function fetchLeaderboard() {
    const accounts = await connection.getProgramAccounts(programId, {
        filters: [{ dataSize: ACCOUNT_SIZE }],
    });
    return accounts
        .map(a => deserialize(a.account.data))
        .sort((a, b) => b.totalScore - a.totalScore);
}
```

### On-Chain Leaderboard (EVM)

Store player addresses in array, read via multicall:

```solidity
address[] public playerList;
function getLeaderboard() view returns (PlayerData[] memory) { ... }
```

### Performance Rules

- **Cache** leaderboard data locally (refresh every 30-60s)
- **Paginate** if >100 players
- **Show user's rank** even if they're not in top N

---

## 8. Security Checklist

### Before Going Public

- [ ] **No private keys** in code, .env, or localStorage
- [ ] `.gitignore` covers: `*.keypair`, `*.json` (wallets), `.env*`, `node_modules/`, `target/`
- [ ] **Program ID** and **RPC endpoints** are public — this is fine
- [ ] **Validate all inputs** in smart contract (not just frontend)
- [ ] **Use PDA seeds** that include user's wallet (prevents account hijacking)
- [ ] **Rate limit** RPC calls to avoid 429 errors (cache blockhashes)
- [ ] **Test on devnet/testnet** before mainnet

### Smart Contract Security

- [ ] All arithmetic uses checked operations (no overflow)
- [ ] Authority checks on every instruction (`require!(signer == account.authority)`)
- [ ] Account ownership validated (PDA bump seeds)
- [ ] No uninitialized account reads

---

## 9. Deployment Checklist

### Frontend
- [ ] Build static files (or use framework build)
- [ ] Deploy to Vercel / Netlify / IPFS / Arweave
- [ ] Set correct `vercel.json` headers (CORS, caching)
- [ ] Test on mobile browsers

### Smart Contract
- [ ] Deploy to testnet first
- [ ] Verify on explorer (if applicable)
- [ ] Save program ID / contract address
- [ ] Update frontend config with deployed address
- [ ] Test full flow: connect → play → submit → verify on explorer

### Go-Live
- [ ] Switch RPC from devnet to mainnet
- [ ] Update program ID to mainnet deployment
- [ ] Test with real tokens (small amounts)
- [ ] Monitor transactions on explorer

---

## 10. Common Pitfalls & Lessons Learned

| Problem | Solution |
|---------|----------|
| Wallet popup on every action | Use ephemeral keypair for L2/session TXs |
| Transaction deduplication | Add unique compute budget or nonce to each TX |
| Slow UI while waiting for chain | Optimistic updates + fire-and-forget |
| Player loses progress on wallet switch | Wallet-scoped localStorage keys |
| PDA not found after L2 session | Wait for settlement (poll with retries) |
| Rate limited by RPC (429) | Cache blockhash, batch requests |
| Score manipulation by users | Validate ALL game logic in smart contract |
| Mobile wallet detection fails | Check multiple `window` properties, provide install links |
| Gas/fee estimation wrong | Use `skipPreflight: true` on L2, simulate on L1 |
| User confused during multi-step TX | Show step counter: "Step 2/3: Settling..." |
