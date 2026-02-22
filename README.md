# Candy Blitz: Solana On-Chain Puzzle Game

**Candy Blitz** is a Match-3 puzzle game built entirely on HTML/JS/CSS, tightly integrated with the **Solana Blockchain** and **MagicBlock's Ephemeral Rollups (ER) SDK**. It demonstrates how to combine casual web gaming with high-performance on-chain logic, persistent scoring, and real-time state delegation.

## 🌟 Gameplay Overview
* **Classic Match-3 Mechanics:** Swap adjacent candies to match 3 or more, earning points before the timer runs out.
* **Special Candies:** Match 4 to create a Bomb/Rocket, or match 5 to create a Rainbow Candy for massive screen-clearing effects.
* **Interactive World Map:** Progress through 6 unique candy-themed levels (Chocolate Factory, Lollipop Lane, Gummy Gardens, etc.), unlocking new stages as you earn stars.
* **Global Leaderboard:** Compete against other players worldwide. Your total score is recorded permanently on the Solana blockchain.

## 🚀 Blockchain Integration & MagicBlock Technology

Candy Blitz isn't just a Web2 game with a wallet login. It uses a custom **Anchor Smart Contract** deployed on Solana Devnet to manage player profiles and scoring securely.

### 1. Persistent On-Chain Player Accounts (PDAs)
When a player connects their wallet (Phantom, Solflare, Backpack) and completes their first level, the game creates a Program Derived Address (PDA) specifically for that player. 
* **Data Stored:** Total Score, Best Single-Game Score, Total Games Played, and Last Completed Level.
* **Global Leaderboard:** The game's leaderboard doesn't rely on a centralized database. It fetches all `PlayerAccount` PDAs directly from the Solana network using `getProgramAccounts()` and ranks them dynamically in the browser.

### 2. MagicBlock Ephemeral Rollups (ER) SDK integration
Casual games require fast, friction-free interactions. Waiting for a wallet popup and standard blockchain finality on *every single move* or *swap* destroys the gameplay experience. 

Candy Blitz solves this using **MagicBlock's Ephemeral Rollups SDK**:
* **The Problem:** Traditional Web3 games force players to sign transactions constantly or abstract the blockchain entirely until the end of a session.
* **The MagicBlock Solution:** MagicBlock's ER technology allows the game to **delegate** the player's account state from the Solana base layer to a high-throughput Ephemeral Rollup validator.
* **How it works in Candy Blitz (Architecture Preparation):** 
  The Rust smart contract (`lib.rs`) is built with the `ephemeral-rollups-sdk`. It uses macros like `#[delegate]` and `#[commit]` which seamlessly inject the necessary MagicBlock instruction data. 
  While the current iteration logs individual swaps locally and commits the final score in a single transaction to prevent UI freezing, the contract is fully structured to support active ER delegation. This means in an ER-active environment, every single swap could theoretically be processed on the Ephemeral Rollup with sub-second finality and zero wallet popups, before ultimately settling the final parsed score back to the Solana base layer via `commit`.

## 🛠️ Technology Stack
* **Frontend:** Vanilla HTML5, CSS3, JavaScript (No heavy frameworks, highly optimized for performance).
* **Smart Contract:** Rust, Anchor Framework v0.32.1
* **Blockchain Connections:** `@solana/web3.js`
* **ER Framework:** `ephemeral-rollups-sdk v0.6.5`

## 📂 Project Structure
```text
magicblock/
├── game/                        # Frontend Application
│   ├── index.html               # Main entry point & UI structure
│   ├── game-main.js & .css      # Game UI logic, DOM manipulation, animations
│   ├── blockchain.js            # Solana/Anchor interactions & Leaderboard fetching
│   ├── config.js                # Game levels and constants
│   ├── effects.js & audio.js    # Particle systems, fireworks, SFX
│   └── vercel.json              # Vercel deployment configuration
│
└── candy_blitz/                 # Solana Smart Contract
    ├── Anchor.toml              # Anchor configuration & Program ID
    └── programs/candy-blitz/src/lib.rs # Rust contract logic (Initialize, Submit Score, Delegate)
```

## 🎮 How to Play Locally

1. **Clone the repository.**
2. **Serve the frontend:**
   Since this is a vanilla HTML/JS app, you just need a local static server to avoid CORS issues with ES Modules.
   ```bash
   cd game
   npx http-server . -p 8080 -c-1
   ```
3. Open `http://localhost:8080` in your browser.
4. **Connect a Wallet:** Use Phantom or Solflare on **Devnet**.
5. Play a level and watch your score get submitted to the blockchain!

## 🌐 Deployment (Vercel)
The project includes a `vercel.json` file tailored for SPA static hosting. To deploy:
1. Push your code to GitHub.
2. Import the repository into Vercel.
3. Set the **Root Directory** to `game` in the Vercel project settings.
4. Deploy! No build commands are required.

## 📝 Smart Contract Instructions
* `initialize_player`: Creates the player's PDA on the base layer.
* `submit_score`: Updates the player's PDA with the latest score, recalculating the total, best score, and game count.
* `delegate_player`: (MagicBlock ER) Moves the player account control to the Ephemeral Rollup.
* `submit_and_undelegate`: (MagicBlock ER) Submits final rollup state and returns control to the base layer.
