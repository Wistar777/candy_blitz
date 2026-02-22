/**
 * Candy Blitz — Solana Wallet Adapter (Vanilla JS)
 * Detects installed Solana wallets and provides a selection modal.
 */

// Deployed Anchor Program on Solana Devnet (with ephemeral-rollups-sdk)
const PROGRAM_ID = '3GVDnQ8JF1pR1JeHABWK5Q6J2k2M5kBRZFgapCUk6Jfq';
const PLAYER_SEED = 'player';

// Solana endpoints
const SOLANA_RPC = 'https://api.devnet.solana.com';        // Base layer (Devnet)
const ER_RPC = 'https://devnet-eu.magicblock.app';          // MagicBlock Ephemeral Rollup

// Anchor instruction discriminators (first 8 bytes of SHA256("global:instruction_name"))
// Pre-computed for vanilla JS (no crypto.subtle needed at call time)
const DISCRIMINATORS = {
    initialize_player: null, // computed on init
    submit_score: null,
};

// Score & session tracking
let lastTxSignature = null;
let scoreHistory = [];
let playerAccountInitialized = false;

// Active game session — tracks swaps locally
let gameSession = {
    active: false,
    levelId: null,
    swaps: 0,
    swapLog: [],
    startTime: null,
};

// ===== Anchor Helpers =====

// Compute 8-byte Anchor discriminator from instruction name
async function getDiscriminator(name) {
    const encoder = new TextEncoder();
    const data = encoder.encode(`global:${name}`);
    const hash = await crypto.subtle.digest('SHA-256', data);
    return new Uint8Array(hash).slice(0, 8);
}

// Get Player PDA address
function getPlayerPDA(walletPubkey) {
    const programId = new solanaWeb3.PublicKey(PROGRAM_ID);
    const [pda] = solanaWeb3.PublicKey.findProgramAddressSync(
        [new TextEncoder().encode(PLAYER_SEED), walletPubkey.toBytes()],
        programId
    );
    return pda;
}

// Serialize submit_score args: level_id (u8), score (u64), swaps (u32) in little-endian
function serializeScoreArgs(levelId, score, swaps) {
    const buf = new ArrayBuffer(13); // 1 + 8 + 4
    const view = new DataView(buf);
    view.setUint8(0, levelId);                    // u8
    // u64 as two u32s (little-endian)
    view.setUint32(1, score & 0xFFFFFFFF, true);  // low 32 bits
    view.setUint32(5, Math.floor(score / 0x100000000) & 0xFFFFFFFF, true); // high 32 bits
    view.setUint32(9, swaps, true);               // u32
    return new Uint8Array(buf);
}

// State
let wallet = null;
let walletProvider = null;
let solanaConnection = null;
let erConnection = null;
let activeSession = null;
let onConnectCallback = null;

// ===== Known Wallet Providers =====
const KNOWN_WALLETS = [
    {
        name: 'Phantom',
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSJub25lIj48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgcng9IjI2IiBmaWxsPSIjQUIyRkYyIi8+PHBhdGggZD0iTTExMC40MyA2My4yM0MxMDkuMDkgNDcuNzQgOTYuMDUgMzUuMjUgNzguOCAyOS4xQzcxLjE2IDI2LjM0IDYzLjgzIDI2LjA3IDU2LjI3IDI4LjRDNDguNyAzMC43MyA0Mi43MyAzNS41NyAzOC4zNiA0MS44NEMzMy41OCA0OC42NyAzMS4xNSA1Ni43OCAzMS4xNSA2NS4zOFY3MC41N0gzOS42NEg0Ni42N0M0Ni42NyA3MC41NyA0Ni42NyA2NS4zOCA0Ni42NyA2NS4zOEM0Ni42NyA1NS4zIDUxLjcgNDYuNzcgNjAuMyA0My4wOUM2NS43NSA0MC44NiA3MS45OSA0MS4wNiA3Ny4yNCA0My42NUM4Ni4xIDQ4LjAyIDkzLjA1IDU3LjI3IDkzLjkyIDY5LjhDOTQuMjggNzQuODQgOTMuMzQgNzkuNjUgOTEuMjcgODMuODJDODcuMDkgOTIuMjUgNzguODMgOTcuOTUgNjguNjEgOTkuMjlDNTguNTEgMTAwLjYyIDQ4LjcxIDk3LjUgNDEuMDMgOTAuNDNDMzcuMjMgODYuOTcgMzQuMjkgODIuNzMgMzIuMDUgNzguMDJDMzEuOTMgNzcuNzcgMzEuODEgNzcuNTIgMzEuNyA3Ny4yN0wyMC4yNSA5OS45NEgyLjVMMjAuNTcgNjUuMzhDMjAuNTcgNDMuMTQgMzguNTggMjQuOTkgNjMuNiAxNi42OUM3Ni4zOSAxMi41MiA5MC41MyAxNC43OSAxMDAuOTQgMjQuMjhDMTA3LjY4IDMwLjEzIDExMS4yNyAzOC44NCAxMTEuNzkgNDguMjJDMTEyLjM0IDU4LjI2IDEwOS40NyA2OC4wNiAxMDMuOTUgNzUuNTdDMTA4LjQ5IDcyLjA1IDExMS4xMiA2Ny44MyAxMTAuNDMgNjMuMjNaIiBmaWxsPSIjRkZGREY4Ii8+PC9zdmc+',
        detect: () => window.phantom?.solana || window.solana,
        getProvider: () => window.phantom?.solana || window.solana,
        url: 'https://phantom.app/',
    },
    {
        name: 'Solflare',
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSJub25lIj48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgcng9IjI2IiBmaWxsPSIjRkM4MjJCIi8+PHBhdGggZD0iTTQwIDQwTDY0IDI0TDg4IDQwTDY0IDU2TDQwIDQwWiIgZmlsbD0id2hpdGUiLz48cGF0aCBkPSJNNDAgNDBMNjQgNTZMNjQgODhMNDAgNzJMNDAgNDBaIiBmaWxsPSIjRkZGRkZGIiBmaWxsLW9wYWNpdHk9IjAuOCIvPjxwYXRoIGQ9Ik04OCA0MEw2NCA1Nkw2NCA4OEw4OCA3Mkw4OCA0MFoiIGZpbGw9IiNGRkZGRkYiIGZpbGwtb3BhY2l0eT0iMC42Ii8+PC9zdmc+',
        detect: () => window.solflare,
        getProvider: () => window.solflare,
        url: 'https://solflare.com/',
    },
    {
        name: 'Backpack',
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSJub25lIj48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgcng9IjI2IiBmaWxsPSIjMTExMTExIi8+PHRleHQgeD0iNjQiIHk9Ijc4IiBmb250LXNpemU9IjYwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+8J+OkjwvdGV4dD48L3N2Zz4=',
        detect: () => window.backpack,
        getProvider: () => window.backpack,
        url: 'https://backpack.app/',
    },
    {
        name: 'Coinbase Wallet',
        icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMjgiIGhlaWdodD0iMTI4IiBmaWxsPSJub25lIj48cmVjdCB3aWR0aD0iMTI4IiBoZWlnaHQ9IjEyOCIgcng9IjI2IiBmaWxsPSIjMDM1MkZDIi8+PHRleHQgeD0iNjQiIHk9Ijc4IiBmb250LXNpemU9IjYwIiBmaWxsPSJ3aGl0ZSIgdGV4dC1hbmNob3I9Im1pZGRsZSI+Q0I8L3RleHQ+PC9zdmc+',
        detect: () => window.coinbaseSolana,
        getProvider: () => window.coinbaseSolana,
        url: 'https://www.coinbase.com/wallet',
    },
];

// ===== Initialization =====

export function initBlockchain() {
    try {
        solanaConnection = new solanaWeb3.Connection(SOLANA_RPC, 'confirmed');
        erConnection = new solanaWeb3.Connection(ER_RPC, 'confirmed');
        createWalletModal();

        // Pre-compute Anchor discriminators
        (async () => {
            DISCRIMINATORS.initialize_player = await getDiscriminator('initialize_player');
            DISCRIMINATORS.submit_score = await getDiscriminator('submit_score');
            console.log('[Anchor] Discriminators computed');
        })();

        console.log(`[Anchor] Program: ${PROGRAM_ID}`);
        console.log('[Wallet] Blockchain initialized');
        return true;
    } catch (e) {
        console.warn('[Wallet] Failed to init blockchain:', e);
        createWalletModal();
        return false;
    }
}

// ===== Wallet Modal =====

function createWalletModal() {
    // Don't create duplicate
    if (document.getElementById('walletModal')) return;

    const modal = document.createElement('div');
    modal.id = 'walletModal';
    modal.className = 'wallet-modal hidden';
    modal.innerHTML = `
        <div class="wallet-modal-backdrop" onclick="closeWalletModal()"></div>
        <div class="wallet-modal-content">
            <div class="wallet-modal-header">
                <h2>Connect Wallet</h2>
                <button class="wallet-modal-close" onclick="closeWalletModal()">✕</button>
            </div>
            <p class="wallet-modal-sub">Choose a wallet to connect to Solana</p>
            <div class="wallet-list" id="walletList"></div>
            <div class="wallet-modal-footer">
                <span class="wallet-modal-network">
                    <span class="badge-dot"></span>
                    Solana Devnet
                </span>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    // Add CSS
    if (!document.getElementById('walletModalCSS')) {
        const style = document.createElement('style');
        style.id = 'walletModalCSS';
        style.textContent = `
            .wallet-modal {
                position: fixed;
                inset: 0;
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                animation: wmFadeIn 0.2s ease-out;
            }
            .wallet-modal.hidden { display: none !important; }
            .wallet-modal-backdrop {
                position: absolute;
                inset: 0;
                background: rgba(0,0,0,0.5);
                backdrop-filter: blur(4px);
            }
            .wallet-modal-content {
                position: relative;
                background: linear-gradient(145deg, #1a1a2e, #16213e);
                border-radius: 20px;
                padding: 24px;
                width: 90%;
                max-width: 380px;
                box-shadow: 0 20px 60px rgba(0,0,0,0.5), 0 0 40px rgba(153,69,255,0.15);
                border: 1px solid rgba(153,69,255,0.2);
                color: white;
                font-family: 'Comfortaa', sans-serif;
            }
            .wallet-modal-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 4px;
            }
            .wallet-modal-header h2 {
                font-size: 1.2rem;
                color: white;
                margin: 0;
            }
            .wallet-modal-close {
                background: rgba(255,255,255,0.1);
                border: none;
                color: white;
                width: 32px;
                height: 32px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 1rem;
                transition: background 0.2s;
            }
            .wallet-modal-close:hover { background: rgba(255,255,255,0.2); }
            .wallet-modal-sub {
                color: rgba(255,255,255,0.5);
                font-size: 0.75rem;
                margin-bottom: 16px;
            }
            .wallet-list {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .wallet-option {
                display: flex;
                align-items: center;
                gap: 14px;
                padding: 14px 16px;
                background: rgba(255,255,255,0.06);
                border: 1px solid rgba(255,255,255,0.08);
                border-radius: 14px;
                cursor: pointer;
                transition: all 0.2s;
                color: white;
                font-family: 'Comfortaa', sans-serif;
                font-size: 0.9rem;
                font-weight: 600;
            }
            .wallet-option:hover {
                background: rgba(153,69,255,0.15);
                border-color: rgba(153,69,255,0.4);
                transform: translateY(-1px);
            }
            .wallet-option img {
                width: 36px;
                height: 36px;
                border-radius: 10px;
            }
            .wallet-option .wallet-name { flex: 1; }
            .wallet-option .wallet-status {
                font-size: 0.65rem;
                padding: 3px 8px;
                border-radius: 8px;
                font-weight: 700;
            }
            .wallet-detected {
                background: rgba(20,241,149,0.15);
                color: #14F195;
            }
            .wallet-install {
                background: rgba(255,255,255,0.1);
                color: rgba(255,255,255,0.5);
            }
            .wallet-modal-footer {
                margin-top: 16px;
                text-align: center;
            }
            .wallet-modal-network {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                font-size: 0.65rem;
                color: rgba(255,255,255,0.4);
            }
            @keyframes wmFadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
        `;
        document.head.appendChild(style);
    }
}

function populateWalletList() {
    const list = document.getElementById('walletList');
    if (!list) return;
    list.innerHTML = '';

    for (const w of KNOWN_WALLETS) {
        const detected = !!w.detect();
        const option = document.createElement('div');
        option.className = 'wallet-option';
        option.innerHTML = `
            <img src="${w.icon}" alt="${w.name}">
            <span class="wallet-name">${w.name}</span>
            <span class="wallet-status ${detected ? 'wallet-detected' : 'wallet-install'}">
                ${detected ? 'Detected' : 'Install'}
            </span>
        `;
        option.onclick = () => {
            if (detected) {
                connectToProvider(w);
            } else {
                window.open(w.url, '_blank');
            }
        };
        list.appendChild(option);
    }
}

// ===== Connect =====

export async function connectWallet() {
    populateWalletList();
    document.getElementById('walletModal')?.classList.remove('hidden');
}

async function connectToProvider(walletInfo) {
    try {
        const provider = walletInfo.getProvider();
        if (!provider) {
            console.error('[Wallet] Provider not available for', walletInfo.name);
            return;
        }

        const resp = await provider.connect();
        wallet = resp.publicKey;
        walletProvider = provider;

        console.log(`[Wallet] Connected via ${walletInfo.name}:`, wallet.toString());

        // Save to localStorage for auto-reconnect on refresh
        localStorage.setItem('candyBlitz_walletProvider', walletInfo.name);

        // Close modal
        document.getElementById('walletModal')?.classList.add('hidden');

        // Update UI
        updateWalletUI(true, walletInfo.name);

        // Notify game
        if (onConnectCallback) onConnectCallback();
    } catch (err) {
        console.error(`[Wallet] ${walletInfo.name} connection failed:`, err);
    }
}

window.closeWalletModal = function () {
    document.getElementById('walletModal')?.classList.add('hidden');
};

// ===== Disconnect =====

export async function disconnectWallet() {
    try {
        if (walletProvider && walletProvider.disconnect) {
            await walletProvider.disconnect();
        }
    } catch (e) {
        console.warn('[Wallet] Provider disconnect error (ignored):', e);
    }
    wallet = null;
    walletProvider = null;
    localStorage.removeItem('candyBlitz_walletProvider');
    updateWalletUI(false);
    // Always fire callback so the UI navigates back to start screen
    if (onDisconnectCallback) onDisconnectCallback();
}

// ===== MagicBlock ER Game Session =====

export function startGameSession(levelId) {
    gameSession = {
        active: true,
        levelId,
        swaps: 0,
        swapLog: [],
        startTime: Date.now(),
    };
    console.log(`[MagicBlock] 🎮 Session started for level ${levelId}`);
}

export function recordSwap(fromR, fromC, toR, toC, scoreGained) {
    if (!gameSession.active) return;
    gameSession.swaps++;
    gameSession.swapLog.push({
        n: gameSession.swaps,
        m: `${fromR},${fromC}>${toR},${toC}`,
        p: scoreGained,
    });
}

export function getSessionSwapCount() {
    return gameSession.swaps;
}

// ===== Initialize Player Account (PDA) =====

async function ensurePlayerAccount() {
    if (playerAccountInitialized || !wallet || !solanaConnection) return;

    const playerPDA = getPlayerPDA(wallet);
    try {
        const accountInfo = await solanaConnection.getAccountInfo(playerPDA);
        if (accountInfo) {
            playerAccountInitialized = true;
            console.log(`[Anchor] Player PDA exists: ${playerPDA.toString()}`);
            return;
        }
    } catch (e) { /* doesn't exist yet */ }

    // Create the player account
    try {
        console.log('[Anchor] Creating player account...');
        const programId = new solanaWeb3.PublicKey(PROGRAM_ID);
        const disc = DISCRIMINATORS.initialize_player || await getDiscriminator('initialize_player');

        const ix = new solanaWeb3.TransactionInstruction({
            keys: [
                { pubkey: playerPDA, isSigner: false, isWritable: true },
                { pubkey: wallet, isSigner: true, isWritable: true },
                { pubkey: solanaWeb3.SystemProgram.programId, isSigner: false, isWritable: false },
            ],
            programId,
            data: Uint8Array.from(disc),
        });

        const tx = new solanaWeb3.Transaction().add(ix);
        const { blockhash } = await solanaConnection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = wallet;

        const signed = await walletProvider.signTransaction(tx);
        const sig = await solanaConnection.sendRawTransaction(signed.serialize());
        await solanaConnection.confirmTransaction(sig, 'confirmed');

        playerAccountInitialized = true;
        console.log(`[Anchor] ✅ Player account created: ${sig}`);
    } catch (err) {
        console.error('[Anchor] Player account creation failed:', err);
    }
}

// ===== Submit Score via Anchor Program =====

export async function submitScore(levelId, score, moves) {
    if (!wallet || !solanaConnection) {
        console.log('[Wallet] No wallet connected, score saved locally only');
        return false;
    }

    try {
        // Ensure player PDA exists on base layer first
        await ensurePlayerAccount();

        const programId = new solanaWeb3.PublicKey(PROGRAM_ID);
        const playerPDA = getPlayerPDA(wallet);
        const disc = DISCRIMINATORS.submit_score || await getDiscriminator('submit_score');

        // Serialize: discriminator (8) + level_id (1) + score (8) + swaps (4)
        const args = serializeScoreArgs(levelId, score, gameSession.swaps);
        const data = new Uint8Array(disc.length + args.length);
        data.set(disc, 0);
        data.set(args, disc.length);

        const ix = new solanaWeb3.TransactionInstruction({
            keys: [
                { pubkey: playerPDA, isSigner: false, isWritable: true },
                { pubkey: wallet, isSigner: true, isWritable: false },
            ],
            programId,
            data: Uint8Array.from(data),
        });

        console.log(`[Anchor] 📦 Submitting score: level=${levelId}, score=${score}, swaps=${gameSession.swaps}`);
        console.log(`[Anchor] Player PDA: ${playerPDA.toString()}`);

        // Send to Devnet base layer (where our program is deployed)
        const tx = new solanaWeb3.Transaction().add(ix);
        const { blockhash } = await solanaConnection.getLatestBlockhash('confirmed');
        tx.recentBlockhash = blockhash;
        tx.feePayer = wallet;

        const signed = await walletProvider.signTransaction(tx);
        const signature = await solanaConnection.sendRawTransaction(signed.serialize());
        await solanaConnection.confirmTransaction(signature, 'confirmed');

        lastTxSignature = signature;
        console.log(`[Anchor] ✅ Score committed! TX: ${signature}`);
        console.log(`[Anchor] View: https://explorer.solana.com/tx/${signature}?cluster=devnet`);

        scoreHistory.push({ levelId, score, moves, signature, swaps: gameSession.swaps, ts: Date.now() });
        showTxNotification(signature, gameSession.swaps);
        gameSession.active = false;

        return true;
    } catch (err) {
        console.error('[Anchor] Score submission failed:', err);
        console.error('[Anchor] Error details:', err.message || err);
        gameSession.active = false;
        return false;
    }
}

// Show a small toast notification with the TX link
function showTxNotification(signature, erCount) {
    const existing = document.getElementById('txNotification');
    if (existing) existing.remove();

    const erText = erCount > 0 ? `<div style="color: rgba(153, 69, 255, 0.9); font-size: 0.65rem; margin-top: 2px;">⚡ ${erCount} swaps verified on MagicBlock ER</div>` : '';

    const toast = document.createElement('div');
    toast.id = 'txNotification';
    toast.innerHTML = `
        <div style="
            position: fixed; bottom: 20px; right: 20px; z-index: 10000;
            background: rgba(20, 241, 149, 0.15); backdrop-filter: blur(12px);
            border: 1px solid rgba(20, 241, 149, 0.4); border-radius: 16px;
            padding: 12px 18px; color: #14F195; font-family: 'Comfortaa', sans-serif;
            font-size: 0.8rem; max-width: 320px; cursor: pointer;
            box-shadow: 0 4px 20px rgba(20, 241, 149, 0.2);
            animation: slideInRight 0.4s ease-out;
        " onclick="window.open('https://explorer.solana.com/tx/${signature}?cluster=devnet','_blank')">
            <div style="font-weight: 700; margin-bottom: 4px;">✅ Score committed to Solana!</div>
            <div style="color: rgba(255,255,255,0.6); font-size: 0.7rem;">TX: ${signature.substring(0, 8)}...${signature.substring(signature.length - 8)}</div>
            ${erText}
            <div style="color: rgba(20, 241, 149, 0.8); font-size: 0.65rem; margin-top: 4px;">Click to view on Explorer →</div>
        </div>
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 8000);
}

// Get the last transaction signature
export function getLastTxSignature() {
    return lastTxSignature;
}

// ===== Leaderboard: Read On-Chain PlayerAccount PDAs =====

export async function fetchLeaderboard() {
    if (!solanaConnection) return [];

    try {
        const programId = new solanaWeb3.PublicKey(PROGRAM_ID);

        // Fetch ALL PlayerAccount PDAs from our program
        const accounts = await solanaConnection.getProgramAccounts(programId, {
            filters: [
                { dataSize: 8 + 32 + 8 + 8 + 4 + 1 }, // discriminator + PlayerAccount struct
            ],
        });

        console.log(`[Leaderboard] Found ${accounts.length} player accounts on-chain`);

        const players = [];
        for (const { pubkey, account } of accounts) {
            try {
                const data = account.data;
                // Anchor layout: 8-byte discriminator, then:
                // authority (32), total_score (u64), best_score (u64), games_played (u32), last_level (u8)
                const view = new DataView(data.buffer, data.byteOffset);

                const authority = new solanaWeb3.PublicKey(data.slice(8, 40));
                const totalScore = Number(view.getBigUint64(40, true));
                const bestScore = Number(view.getBigUint64(48, true));
                const gamesPlayed = view.getUint32(56, true);
                const lastLevel = view.getUint8(60);

                if (bestScore > 0) {
                    players.push({
                        player: authority.toString(),
                        pda: pubkey.toString(),
                        totalScore,
                        bestScore,
                        gamesPlayed,
                        lastLevel,
                    });
                }
            } catch (e) { /* skip malformed */ }
        }

        // Sort by total score descending
        players.sort((a, b) => b.totalScore - a.totalScore);
        return players;
    } catch (err) {
        console.error('[Leaderboard] Failed to fetch:', err);
        return [];
    }
}

// Get Devnet SOL balance for the connected wallet
export async function getWalletBalance() {
    if (!wallet || !solanaConnection) return null;
    try {
        const balance = await solanaConnection.getBalance(wallet);
        return (balance / 1e9).toFixed(4); // Convert lamports to SOL
    } catch (e) {
        return null;
    }
}

// ===== Getters =====

export function getWalletAddress() {
    if (!wallet) return null;
    const addr = wallet.toString();
    return addr.substring(0, 4) + '...' + addr.substring(addr.length - 4);
}

export function getFullWalletAddress() {
    return wallet ? wallet.toString() : null;
}

export function isConnected() {
    return wallet !== null;
}

// ===== UI Helpers =====

function updateWalletUI(connected, walletName) {
    const btn = document.getElementById('walletBtn');
    if (btn) {
        if (connected) {
            btn.textContent = '🟢 ' + getWalletAddress();
            btn.classList.add('connected');
        } else {
            btn.textContent = '🔗 Connect Wallet';
            btn.classList.remove('connected');
        }
    }
}

/**
 * Set a callback to be invoked when wallet connects successfully.
 */
export function onWalletConnect(cb) {
    onConnectCallback = cb;
}

// ===== Profile Popup =====

let onDisconnectCallback = null;

export function onWalletDisconnect(cb) {
    onDisconnectCallback = cb;
}

/**
 * Open profile popup showing wallet info + disconnect.
 */
export function openProfile() {
    if (!wallet) {
        // Not connected — open wallet connect modal instead
        connectWallet();
        return;
    }
    showProfilePopup();
}

function showProfilePopup() {
    // Remove existing
    document.getElementById('profilePopup')?.remove();

    const fullAddr = wallet.toString();
    const shortAddr = getWalletAddress();
    const providerName = walletProvider?.constructor?.name || 'Wallet';

    const popup = document.createElement('div');
    popup.id = 'profilePopup';
    popup.className = 'wallet-modal';
    popup.innerHTML = `
        <div class="wallet-modal-backdrop" onclick="closeProfilePopup()"></div>
        <div class="wallet-modal-content">
            <div class="wallet-modal-header">
                <h2>👤 Profile</h2>
                <button class="wallet-modal-close" onclick="closeProfilePopup()">✕</button>
            </div>
            <div class="profile-info">
                <div class="profile-avatar">🟢</div>
                <div class="profile-address" title="${fullAddr}">${shortAddr}</div>
                <div class="profile-full-address">${fullAddr}</div>
                <button class="profile-copy-btn" onclick="copyWalletAddress()">📋 Copy Address</button>
            </div>
            <div class="wallet-modal-footer" style="margin-top: 10px;">
                <span class="wallet-modal-network">
                    <span class="badge-dot"></span>
                    Solana Devnet
                </span>
            </div>
            <button class="profile-disconnect-btn" onclick="doDisconnect()">
                🔴 Disconnect Wallet
            </button>
        </div>
    `;
    document.body.appendChild(popup);

    // Add profile CSS if not already added
    if (!document.getElementById('profileCSS')) {
        const style = document.createElement('style');
        style.id = 'profileCSS';
        style.textContent = `
            .profile-info {
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 8px;
                padding: 20px 0 10px;
            }
            .profile-avatar {
                font-size: 3rem;
                width: 70px;
                height: 70px;
                border-radius: 50%;
                background: rgba(20,241,149,0.1);
                border: 2px solid rgba(20,241,149,0.3);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .profile-address {
                font-size: 1.1rem;
                font-weight: 700;
                color: white;
                font-family: 'Courier New', monospace;
            }
            .profile-full-address {
                font-size: 0.55rem;
                color: rgba(255,255,255,0.35);
                word-break: break-all;
                text-align: center;
                padding: 0 10px;
                font-family: 'Courier New', monospace;
            }
            .profile-copy-btn {
                background: rgba(255,255,255,0.1);
                border: 1px solid rgba(255,255,255,0.15);
                color: rgba(255,255,255,0.7);
                padding: 6px 16px;
                border-radius: 10px;
                font-size: 0.7rem;
                cursor: pointer;
                font-family: 'Comfortaa', sans-serif;
                transition: all 0.2s;
            }
            .profile-copy-btn:hover {
                background: rgba(255,255,255,0.15);
                color: white;
            }
            .profile-disconnect-btn {
                width: 100%;
                margin-top: 12px;
                padding: 12px;
                background: rgba(255,50,50,0.1);
                border: 1px solid rgba(255,50,50,0.25);
                color: #ff6b6b;
                border-radius: 14px;
                cursor: pointer;
                font-family: 'Comfortaa', sans-serif;
                font-size: 0.85rem;
                font-weight: 600;
                transition: all 0.2s;
            }
            .profile-disconnect-btn:hover {
                background: rgba(255,50,50,0.2);
                border-color: rgba(255,50,50,0.4);
            }
        `;
        document.head.appendChild(style);
    }
}

window.closeProfilePopup = function () {
    document.getElementById('profilePopup')?.remove();
};

window.copyWalletAddress = function () {
    if (!wallet) return;
    navigator.clipboard.writeText(wallet.toString()).then(() => {
        const btn = document.querySelector('.profile-copy-btn');
        if (btn) {
            btn.textContent = '✅ Copied!';
            setTimeout(() => { btn.textContent = '📋 Copy Address'; }, 1500);
        }
    });
};

window.doDisconnect = async function () {
    document.getElementById('profilePopup')?.remove();
    await disconnectWallet();
    // onDisconnectCallback is now called inside disconnectWallet() itself
};

// ===== Wallet-Linked Storage =====

/**
 * Returns a storage key prefix based on the connected wallet address.
 * This allows progress to be saved per-wallet.
 */
export function getWalletStorageKey() {
    if (!wallet) return '';
    return 'w_' + wallet.toString().substring(0, 8) + '_';
}

// Note: window.connectWallet and window.openProfile are set in game-main.js

// ===== Auto-Reconnect =====

/**
 * Try to auto-reconnect to a previously connected wallet.
 * Returns true if reconnection was successful.
 */
export async function tryAutoReconnect() {
    const savedProvider = localStorage.getItem('candyBlitz_walletProvider');
    if (!savedProvider) return false;

    const walletInfo = KNOWN_WALLETS.find(w => w.name === savedProvider);
    if (!walletInfo) {
        localStorage.removeItem('candyBlitz_walletProvider');
        return false;
    }

    try {
        const provider = walletInfo.getProvider();
        if (!provider) return false;

        // Timeout after 5 seconds to prevent infinite hanging
        const resp = await Promise.race([
            provider.connect({ onlyIfTrusted: true }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 5000))
        ]);
        wallet = resp.publicKey;
        walletProvider = provider;

        console.log(`[Wallet] Auto-reconnected via ${walletInfo.name}:`, wallet.toString());
        updateWalletUI(true, walletInfo.name);
        return true;
    } catch (e) {
        console.log('[Wallet] Auto-reconnect failed:', e.message || e);
        localStorage.removeItem('candyBlitz_walletProvider');
        return false;
    }
}
