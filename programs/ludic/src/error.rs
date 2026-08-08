use anchor_lang::prelude::*;

#[error_code]
pub enum LudicError {
    #[msg("Move index is out of bounds (must be 0-8)")]
    InvalidMove,
    #[msg("Cell is already occupied")]
    CellOccupied,
    #[msg("Not the current player's turn")]
    NotYourTurn,
    #[msg("Game is already over")]
    GameOver,
}
