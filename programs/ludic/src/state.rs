use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Game {
    /// Wallet that plays X (the creator).
    pub x_player: Pubkey,
    /// Wallet that plays O (the opponent).
    pub o_player: Pubkey,
    /// 0 = X's turn, 1 = O's turn.
    pub turn: u8,
    /// 0 = active, 1 = X won, 2 = O won, 3 = draw.
    pub status: u8,
    /// 0 = empty, 1 = X, 2 = O. Index 0-8, row-major.
    pub board: [u8; 9],
    /// Number of moves placed so far (0-9).
    pub move_count: u8,
    /// PDA bump.
    pub bump: u8,
}

impl Game {
    pub const ACTIVE: u8 = 0;
    pub const X_WON: u8 = 1;
    pub const O_WON: u8 = 2;
    pub const DRAW: u8 = 3;

    pub const EMPTY: u8 = 0;
    pub const X: u8 = 1;
    pub const O: u8 = 2;

    /// All 8 winning lines: 3 rows, 3 columns, 2 diagonals.
    pub const LINES: [[usize; 3]; 8] = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6],
    ];

    /// Returns the mark that has three in a row (X or O), or EMPTY if none.
    pub fn winner(&self) -> u8 {
        for line in Self::LINES {
            let (a, b, c) = (self.board[line[0]], self.board[line[1]], self.board[line[2]]);
            if a != Self::EMPTY && a == b && b == c {
                return a;
            }
        }
        Self::EMPTY
    }
}
