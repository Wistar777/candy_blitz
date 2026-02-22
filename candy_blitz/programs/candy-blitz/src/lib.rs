use anchor_lang::prelude::*;
use ephemeral_rollups_sdk::anchor::{commit, delegate, ephemeral};
use ephemeral_rollups_sdk::cpi::DelegateConfig;
use ephemeral_rollups_sdk::ephem::{commit_accounts, commit_and_undelegate_accounts};

declare_id!("4cPtNSt6qTzyojmuFUpAqJVW5yFfG2rPFhD7uu92YqtC");

pub const PLAYER_SEED: &[u8] = b"player";

#[program]
pub mod candy_blitz {
    use super::*;

    /// Initialize a new player profile (PDA per wallet).
    pub fn initialize_player(ctx: Context<InitializePlayer>) -> Result<()> {
        let player = &mut ctx.accounts.player_account;
        player.authority = ctx.accounts.user.key();
        player.total_score = 0;
        player.games_played = 0;
        player.best_score = 0;
        player.last_level = 0;
        msg!("Player {} initialized", player.authority);
        Ok(())
    }

    /// Submit a score after completing a level.
    pub fn submit_score(ctx: Context<SubmitScore>, level_id: u8, score: u64) -> Result<()> {
        let player = &mut ctx.accounts.player_account;
        player.total_score = player.total_score.saturating_add(score);
        player.games_played += 1;
        player.last_level = level_id;
        if score > player.best_score {
            player.best_score = score;
        }
        msg!(
            "Score submitted: level={}, score={}, total={}, best={}",
            level_id, score, player.total_score, player.best_score
        );
        Ok(())
    }

    /// Delegate the player account to MagicBlock ER for low-latency play.
    pub fn delegate_player(ctx: Context<DelegatePlayer>) -> Result<()> {
        ctx.accounts.delegate_pda(
            &ctx.accounts.payer,
            &[PLAYER_SEED, ctx.accounts.payer.key().as_ref()],
            DelegateConfig {
                validator: ctx.remaining_accounts.first().map(|acc| acc.key()),
                ..Default::default()
            },
        )?;
        msg!("Player account delegated to ER");
        Ok(())
    }

    /// Submit score + commit state in the ER (fast, cheap).
    pub fn submit_score_and_commit(
        ctx: Context<SubmitScoreAndCommit>,
        level_id: u8,
        score: u64,
    ) -> Result<()> {
        let player = &mut ctx.accounts.player_account;
        player.total_score = player.total_score.saturating_add(score);
        player.games_played += 1;
        player.last_level = level_id;
        if score > player.best_score {
            player.best_score = score;
        }
        msg!(
            "Score committed in ER: level={}, score={}, total={}",
            level_id, score, player.total_score
        );
        player.exit(&crate::ID)?;
        commit_accounts(
            &ctx.accounts.payer,
            vec![&ctx.accounts.player_account.to_account_info()],
            &ctx.accounts.magic_context,
            &ctx.accounts.magic_program,
        )?;
        Ok(())
    }

    /// Undelegate (commit + return to base layer).
    pub fn undelegate_player(ctx: Context<SubmitScoreAndCommit>) -> Result<()> {
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
#[derive(Accounts)]
pub struct DelegatePlayer<'info> {
    pub payer: Signer<'info>,
    /// CHECK: The PDA to delegate
    #[account(mut, del)]
    pub pda: AccountInfo<'info>,
}

/// Submit score + commit in ER context.
#[derive(Accounts)]
pub struct SubmitScoreAndCommit<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,
    #[account(
        mut,
        seeds = [PLAYER_SEED, payer.key().as_ref()],
        bump
    )]
    pub player_account: Account<'info, PlayerAccount>,
}

// ===== Data =====

#[account]
#[derive(InitSpace)]
pub struct PlayerAccount {
    pub authority: Pubkey,     // 32 bytes
    pub total_score: u64,      // 8 bytes
    pub best_score: u64,       // 8 bytes
    pub games_played: u32,     // 4 bytes
    pub last_level: u8,        // 1 byte
}
