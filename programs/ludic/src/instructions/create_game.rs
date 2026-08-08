use anchor_lang::prelude::*;

use crate::{constants::GAME_SEED, state::Game};

#[derive(Accounts)]
#[instruction(opponent: Pubkey, seed: u64)]
pub struct CreateGame<'info> {
    /// Creator and X player; pays for the game account.
    #[account(mut)]
    pub payer: Signer<'info>,
    /// Game PDA: seeds [GAME_SEED, x_player, o_player, seed].
    #[account(
        init,
        payer = payer,
        space = 8 + Game::INIT_SPACE,
        seeds = [GAME_SEED, payer.key().as_ref(), opponent.as_ref(), seed.to_le_bytes().as_ref()],
        bump
    )]
    pub game: Account<'info, Game>,
    pub system_program: Program<'info, System>,
}

pub fn handle_create_game(ctx: Context<CreateGame>, opponent: Pubkey, _seed: u64) -> Result<()> {
    let game = &mut ctx.accounts.game;
    game.x_player = ctx.accounts.payer.key();
    game.o_player = opponent;
    game.turn = 0;
    game.status = Game::ACTIVE;
    game.board = [Game::EMPTY; 9];
    game.move_count = 0;
    game.bump = ctx.bumps.game;
    Ok(())
}
