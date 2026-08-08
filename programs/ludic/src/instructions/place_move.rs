use anchor_lang::prelude::*;

use crate::{constants::GAME_SEED, error::LudicError, state::Game};

#[derive(Accounts)]
#[instruction(seed: u64)]
pub struct PlaceMove<'info> {
    #[account(
        mut,
        seeds = [GAME_SEED, game.x_player.as_ref(), game.o_player.as_ref(), seed.to_le_bytes().as_ref()],
        bump = game.bump
    )]
    pub game: Account<'info, Game>,
    /// The player whose turn it is (X or O).
    pub player: Signer<'info>,
}

pub fn handle_place_move(ctx: Context<PlaceMove>, _seed: u64, index: u8) -> Result<()> {
    let game = &mut ctx.accounts.game;

    require!(game.status == Game::ACTIVE, LudicError::GameOver);

    let expected = if game.turn == 0 {
        game.x_player
    } else {
        game.o_player
    };
    require!(ctx.accounts.player.key() == expected, LudicError::NotYourTurn);

    let idx = index as usize;
    require!(idx < 9, LudicError::InvalidMove);
    require!(game.board[idx] == Game::EMPTY, LudicError::CellOccupied);

    let mark = if game.turn == 0 { Game::X } else { Game::O };
    game.board[idx] = mark;
    game.move_count += 1;

    let winner = game.winner();
    if winner != Game::EMPTY {
        game.status = if winner == Game::X {
            Game::X_WON
        } else {
            Game::O_WON
        };
    } else if game.move_count == 9 {
        game.status = Game::DRAW;
    } else {
        game.turn = 1 - game.turn;
    }

    Ok(())
}
