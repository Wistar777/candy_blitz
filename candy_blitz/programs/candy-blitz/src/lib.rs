use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::{commit_accounts, commit_and_undelegate_accounts};

declare_id!("CbYNU3N29sGLTDRexxzeu1NDzNg2DS3bUonxT7xH8MXH");

pub const PLAYER_SEED: &[u8] = b"player";
pub const MAX_LEVELS: usize = 6;

#[ephemeral]
#[program]
pub mod candy_blitz {
    use super::*;

    /// Initialize a new player profile (PDA per wallet).
    pub fn initialize_player(ctx: Context<InitializePlayer>) -> Result<()> {
        let player = &mut ctx.accounts.player_account;
        player.authority = ctx.accounts.user.key();
        player.best_scores = [0u64; MAX_LEVELS];
        player.stars = [0u8; MAX_LEVELS];
        player.completed_levels = 0;
        player.games_played = 0;
        player.last_level = 0;
        player.current_score = 0;
        player.current_level = 0;
        player.swap_count = 0;
        player.session_active = false;
        msg!("Player {} initialized", player.authority);
        Ok(())
    }

    /// Submit a score after completing a level (base layer fallback, no ER).
    pub fn submit_score(ctx: Context<SubmitScore>, level_id: u8, score: u64, star_count: u8) -> Result<()> {
        let player = &mut ctx.accounts.player_account;
        let idx = level_id as usize;
        require!(idx < MAX_LEVELS, ErrorCode::InvalidLevel);

        if score > player.best_scores[idx] {
            player.best_scores[idx] = score;
        }
        if star_count > player.stars[idx] {
            player.stars[idx] = star_count;
        }
        player.completed_levels |= 1 << level_id;
        player.games_played += 1;
        player.last_level = level_id;

        let total: u64 = player.best_scores.iter().sum();
        msg!("Score submitted: level={}, score={}, total_best={}", level_id, score, total);
        Ok(())
    }

    /// Delegate the player account to MagicBlock ER for low-latency play.
    pub fn delegate_player(ctx: Context<DelegatePlayerInput>) -> Result<()> {
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &[PLAYER_SEED, ctx.accounts.payer.key().as_ref()],
            DelegateConfig {
                validator: ctx.accounts.validator.as_ref().map(|v| v.key()),
                ..Default::default()
            },
        )?;
        msg!("Player account delegated to ER");
        Ok(())
    }

    /// Start a new game session on the ER. Resets session state.
    pub fn start_session(ctx: Context<GameSession>, level_id: u8) -> Result<()> {
        let player = &mut ctx.accounts.player_account;
        require!((level_id as usize) < MAX_LEVELS, ErrorCode::InvalidLevel);
        player.current_score = 0;
        player.current_level = level_id;
        player.swap_count = 0;
        player.session_active = true;
        msg!("Session started: level {}", level_id);
        Ok(())
    }

    /// Record a single swap during gameplay (called on ER, gasless).
    pub fn record_swap(ctx: Context<GameSession>, score_delta: u64) -> Result<()> {
        let player = &mut ctx.accounts.player_account;
        require!(player.session_active, ErrorCode::NoActiveSession);
        player.swap_count += 1;
        player.current_score += score_delta;
        Ok(())
    }

    /// End session + commit state back to base layer via ER.
    pub fn submit_score_and_commit(
        ctx: Context<CommitScore>,
        star_count: u8,
    ) -> Result<()> {
        let player = &mut ctx.accounts.player_account;
        require!(player.session_active, ErrorCode::NoActiveSession);

        let idx = player.current_level as usize;
        require!(idx < MAX_LEVELS, ErrorCode::InvalidLevel);

        let score = player.current_score;

        if score > player.best_scores[idx] {
            player.best_scores[idx] = score;
        }
        if star_count > player.stars[idx] {
            player.stars[idx] = star_count;
        }
        player.completed_levels |= 1 << player.current_level;
        player.games_played += 1;
        player.last_level = player.current_level;
        player.session_active = false;

        let total: u64 = player.best_scores.iter().sum();
        msg!(
            "Score committed in ER: level={}, score={}, swaps={}, total={}",
            player.current_level, score, player.swap_count, total
        );

        commit_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.player_account.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;
        Ok(())
    }

    /// Undelegate (commit + return to base layer).
    pub fn undelegate_player(ctx: Context<CommitScore>) -> Result<()> {
        commit_and_undelegate_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.player_account.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;
        msg!("Player account undelegated from ER");
        Ok(())
    }
}

// ===== Account Structs =====

#[derive(Accounts)]
pub struct InitializePlayer<'info> {
    #[account(
        init_if_needed,
        payer = user,
        space = 8 + PlayerAccount::INIT_SPACE,
        seeds = [PLAYER_SEED, user.key().as_ref()],
        bump
    )]
    pub player_account: Account<'info, PlayerAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitScore<'info> {
    #[account(
        mut,
        seeds = [PLAYER_SEED, user.key().as_ref()],
        bump
    )]
    pub player_account: Account<'info, PlayerAccount>,
    pub user: Signer<'info>,
}

/// Delegate the player PDA to the ER.
#[delegate]
#[derive(Accounts)]
pub struct DelegatePlayerInput<'info> {
    pub payer: Signer<'info>,
    /// CHECK: Checked by the delegate program
    pub validator: Option<AccountInfo<'info>>,
    /// CHECK: The PDA to delegate
    #[account(mut, del)]
    pub pda: AccountInfo<'info>,
}

/// Game session operations (start_session, record_swap) — used on ER.
#[derive(Accounts)]
pub struct GameSession<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: The wallet that owns this PDA (passed as non-signer for PDA derivation)
    pub authority: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [PLAYER_SEED, authority.key().as_ref()],
        bump
    )]
    pub player_account: Account<'info, PlayerAccount>,
}

/// Commit score + undelegate in ER context.
#[commit]
#[derive(Accounts)]
pub struct CommitScore<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    /// CHECK: The wallet that owns this PDA (passed as non-signer for PDA derivation)
    pub authority: AccountInfo<'info>,
    #[account(
        mut,
        seeds = [PLAYER_SEED, authority.key().as_ref()],
        bump
    )]
    pub player_account: Account<'info, PlayerAccount>,
}

// ===== Data =====

#[account]
#[derive(InitSpace)]
pub struct PlayerAccount {
    pub authority: Pubkey,            // 32 bytes
    pub best_scores: [u64; 6],        // 48 bytes
    pub stars: [u8; 6],               // 6 bytes
    pub completed_levels: u8,         // 1 byte
    pub games_played: u32,            // 4 bytes
    pub last_level: u8,               // 1 byte
    // --- ER session fields ---
    pub current_score: u64,           // 8 bytes
    pub current_level: u8,            // 1 byte
    pub swap_count: u32,              // 4 bytes
    pub session_active: bool,         // 1 byte
    // Total: 106 bytes + 8 discriminator = 114
}

// ===== Errors =====

#[error_code]
pub enum ErrorCode {
    #[msg("Invalid level ID. Must be 0-5.")]
    InvalidLevel,
    #[msg("No active game session. Call start_session first.")]
    NoActiveSession,
}
