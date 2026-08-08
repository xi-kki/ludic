pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("EBNzCwTjBuuShtM47Cux5nMNesRa2BVSamaPJtPaKYje");

#[program]
pub mod ludic {
    use super::*;

    pub fn create_game(ctx: Context<CreateGame>, opponent: Pubkey, seed: u64) -> Result<()> {
        crate::instructions::create_game::handle_create_game(ctx, opponent, seed)
    }

    pub fn place_move(ctx: Context<PlaceMove>, seed: u64, index: u8) -> Result<()> {
        crate::instructions::place_move::handle_place_move(ctx, seed, index)
    }
}
