# Candy Blitz: Solana On-Chain Puzzle Game

**Candy Blitz** is a Match-3 puzzle game built entirely on HTML/JS/CSS, tightly integrated with the **Solana Blockchain** and **MagicBlock's Ephemeral Rollups (ER)**. Every swap is verified on-chain with sub-second finality — no wallet popups during gameplay.

## 🌟 Gameplay Overview
* **Classic Match-3 Mechanics:** Swap adjacent candies to match 3 or more, earning points before the timer runs out.
* **Special Candies:**
  - **Match 4** → Rocket (clears an entire row or column)
  - **Match 2×2 square** → Lightning (strikes 5 random tiles)
  - **T/L shape** (two intersecting lines of 3) → Bomb (3×3 explosion)
  - **Match 5+** → Rainbow (clears all tiles of one color)
* **Special Combos:** Swap two specials together for devastating chain effects.
* **Interactive World Map:** Progress through 6 unique candy-themed levels with different board shapes.
* **Global Leaderboard:** On-chain leaderboard — fetched directly from Solana via `getProgramAccounts()`.

### Scoring System
| Action | Points | Combo Multiplier |
|--------|--------|------------------|
| Match 3 tiles | 10 per tile | ✅ ×combo |
| Create Rocket (match 4) | +20 bonus | ✅ |
| Create Lightning (2×2) | +15 bonus | ✅ |
| Create Bomb (T/L shape) | +25 bonus | ✅ |
| Create Rainbow (match 5+) | +50 bonus | ✅ |
| Special activation (in match) | 15 per tile | ✅ |
| Special combo (swap two specials) | 20 per tile | — |

## 🚀 MagicBlock Ephemeral Rollups Integration

Candy Blitz uses **MagicBlock's Ephemeral Rollups** for real-time on-chain gameplay. The full lifecycle:

```
┌─────────────┐     ┌────────────────┐     ┌──────────────┐     ┌─────────────┐
│  Delegate   │────▶│  Play on ER    │────▶│   Commit +   │────▶│  Devnet     │
│  PDA → ER   │     │  (sub-second)  │     │  Undelegate  │     │  (settled)  │
└─────────────┘     └────────────────┘     └──────────────┘     └─────────────┘
  1 wallet sign       0 wallet signs         1 wallet sign        Score on-chain
```

### How It Works
1. **Start Level** → Player PDA is delegated from Devnet to MagicBlock ER validator
2. **During Gameplay** → Swaps are recorded on the ER with sub-second finality, zero wallet popups
3. **End Level** → Score is committed and PDA is undelegated back to Devnet
4. **Fallback** → If ER is unavailable, scores submit directly to Devnet

### On-Chain Player Accounts (PDAs)
Each player has a PDA storing:
- **Per-level best scores** (6 levels × u64)
- **Per-level stars** (6 levels × u8)
- **Completed levels bitmask** (u8)
- **Total games played** (u32)
- **ER session state** (current_score, swap_count, session_active)

### Smart Contract Instructions
| Instruction | Layer | Description |
|-------------|-------|-------------|
| `initialize_player` | Devnet | Creates the player's PDA |
| `submit_score` | Devnet | Updates scores (fallback, no ER) |
| `delegate_player` | Devnet | Delegates PDA to ER validator |
| `start_session` | ER | Starts a game session on ER |
| `record_swap` | ER | Records a swap (fire-and-forget) |
| `submit_score_and_commit` | ER | Commits score back to Devnet |
| `undelegate_player` | ER | Returns PDA to Devnet |

## 🛠️ Technology Stack
* **Frontend:** Vanilla HTML5, CSS3, JavaScript (no frameworks)
* **Smart Contract:** Rust, Anchor Framework v0.32.1
* **Blockchain:** Solana Devnet via `@solana/web3.js`
* **ER Framework:** `ephemeral-rollups-sdk v0.8.5`
* **Program ID:** `CbYNU3N29sGLTDRexxzeu1NDzNg2DS3bUonxT7xH8MXH`
* **ER Endpoint:** `https://devnet-eu.magicblock.app`
* **Delegation Program:** `DELeGGvXpWV2fqJUhqcF5ZSYMS4JTLjteaAMARRSaeSh`

## 📂 Project Structure
```text
magicblock/
├── game/                        # Frontend Application
│   ├── index.html               # Main entry point & UI structure
│   ├── game-main.js & .css      # Game logic, DOM, animations
│   ├── blockchain.js            # Solana/Anchor/ER interactions
│   ├── config.js                # Game levels and constants
│   ├── effects.js & audio.js    # Particle systems, SFX
│   └── storage.js               # localStorage wrapper
│
└── candy_blitz/                 # Solana Smart Contract
    ├── Anchor.toml              # Anchor config & Program ID
    ├── Cargo.toml               # Dependencies (anchor-lang, ephemeral-rollups-sdk)
    └── programs/candy-blitz/
        └── src/lib.rs           # Contract: Initialize, Score, Delegate, Session, Commit
```

## 🎮 How to Play Locally

1. **Clone the repository.**
2. **Serve the frontend:**
   ```bash
   cd game
   npx http-server . -p 8080 -c-1
   ```
3. Open `http://localhost:8080` in your browser.
4. **Connect a Wallet:** Use Phantom or Solflare on **Devnet**.
5. Play a level — delegation happens automatically before the timer starts!

## 🌐 Deployment (Vercel)
1. Push your code to GitHub.
2. Import the repository into Vercel.
3. Set the **Root Directory** to `game`.
4. Deploy — no build commands required.

## 📝 License
MIT
