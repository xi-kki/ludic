use {
    anchor_lang::{
        prelude::Pubkey,
        solana_program::{instruction::Instruction, system_program},
        AccountDeserialize, InstructionData, ToAccountMetas,
    },
    litesvm::LiteSVM,
    solana_keypair::Keypair,
    solana_message::{Message, VersionedMessage},
    solana_signer::Signer,
    solana_transaction::versioned::VersionedTransaction,
};

const SEED: u64 = 1;

fn program_bytes() -> &'static [u8] {
    include_bytes!(concat!(
        env!("CARGO_TARGET_TMPDIR"),
        "/../deploy/ludic.so"
    ))
}

fn setup() -> (LiteSVM, Keypair, Keypair, Pubkey, Pubkey) {
    let program_id = ludic::id();
    let x = Keypair::new();
    let o = Keypair::new();
    let (game, _bump) = Pubkey::find_program_address(
        &[
            ludic::constants::GAME_SEED,
            x.pubkey().as_ref(),
            o.pubkey().as_ref(),
            &SEED.to_le_bytes(),
        ],
        &program_id,
    );
    let mut svm = LiteSVM::new();
    svm.add_program(program_id, program_bytes()).unwrap();
    svm.airdrop(&x.pubkey(), 10_000_000_000).unwrap();
    svm.airdrop(&o.pubkey(), 10_000_000_000).unwrap();
    (svm, x, o, game, program_id)
}

fn send(svm: &mut LiteSVM, payer: &Keypair, ixs: &[Instruction]) -> Result<(), String> {
    let blockhash = svm.latest_blockhash();
    let msg = Message::new_with_blockhash(ixs, Some(&payer.pubkey()), &blockhash);
    let tx = VersionedTransaction::try_new(VersionedMessage::Legacy(msg), &[payer]).unwrap();
    svm.send_transaction(tx)
        .map(|_| ())
        .map_err(|e| format!("{e:?}"))
}

fn create_game_ix(x: &Keypair, o: &Pubkey, program_id: &Pubkey) -> Instruction {
    Instruction::new_with_bytes(
        *program_id,
        &ludic::instruction::CreateGame {
            opponent: *o,
            seed: SEED,
        }
        .data(),
        ludic::accounts::CreateGame {
            payer: x.pubkey(),
            game: Pubkey::find_program_address(
                &[
                    ludic::constants::GAME_SEED,
                    x.pubkey().as_ref(),
                    o.as_ref(),
                    &SEED.to_le_bytes(),
                ],
                program_id,
            )
            .0,
            system_program: system_program::ID,
        }
        .to_account_metas(None),
    )
}

fn place_move_ix(
    player: &Pubkey,
    game: &Pubkey,
    index: u8,
    program_id: &Pubkey,
) -> Instruction {
    Instruction::new_with_bytes(
        *program_id,
        &ludic::instruction::PlaceMove {
            seed: SEED,
            index,
        }
        .data(),
        ludic::accounts::PlaceMove {
            game: *game,
            player: *player,
        }
        .to_account_metas(None),
    )
}

fn game_state(svm: &LiteSVM, game: &Pubkey) -> ludic::state::Game {
    let acc = svm.get_account(game).unwrap();
    let mut data: &[u8] = &acc.data;
    ludic::state::Game::try_deserialize(&mut data).unwrap()
}

fn assert_ok(res: Result<(), String>, label: &str) {
    assert!(res.is_ok(), "{label}: {res:?}");
}

fn assert_err(res: Result<(), String>, label: &str) {
    assert!(res.is_err(), "{label}: expected failure");
}

#[test]
fn test_create_game_initializes_state() {
    let (mut svm, x, o, game, program_id) = setup();
    assert_ok(
        send(&mut svm, &x, &[create_game_ix(&x, &o.pubkey(), &program_id)]),
        "create game",
    );

    let g = game_state(&svm, &game);
    assert_eq!(g.x_player, x.pubkey());
    assert_eq!(g.o_player, o.pubkey());
    assert_eq!(g.turn, 0, "X moves first");
    assert_eq!(g.status, ludic::state::Game::ACTIVE);
    assert_eq!(g.board, [0; 9]);
    assert_eq!(g.move_count, 0);
}

#[test]
fn test_x_wins_with_vertical_line() {
    let (mut svm, x, o, game, program_id) = setup();
    assert_ok(
        send(&mut svm, &x, &[create_game_ix(&x, &o.pubkey(), &program_id)]),
        "create game",
    );
    // X: 0,3,6 (left column) vs O: 1,4
    assert_ok(
        send(&mut svm, &x, &[place_move_ix(&x.pubkey(), &game, 0, &program_id)]),
        "x 0",
    );
    assert_ok(
        send(&mut svm, &o, &[place_move_ix(&o.pubkey(), &game, 1, &program_id)]),
        "o 1",
    );
    assert_ok(
        send(&mut svm, &x, &[place_move_ix(&x.pubkey(), &game, 3, &program_id)]),
        "x 3",
    );
    assert_ok(
        send(&mut svm, &o, &[place_move_ix(&o.pubkey(), &game, 4, &program_id)]),
        "o 4",
    );
    assert_ok(
        send(&mut svm, &x, &[place_move_ix(&x.pubkey(), &game, 6, &program_id)]),
        "x 6",
    );

    let g = game_state(&svm, &game);
    assert_eq!(g.status, ludic::state::Game::X_WON);
    assert_eq!(g.move_count, 5);
}

#[test]
fn test_draw_when_board_fills() {
    let (mut svm, x, o, game, program_id) = setup();
    assert_ok(
        send(&mut svm, &x, &[create_game_ix(&x, &o.pubkey(), &program_id)]),
        "create game",
    );
    // Draw board: [X,O,X],[O,O,X],[X,X,O]
    for (i, signer) in [&x, &o, &x, &o, &x, &o, &x, &o, &x].iter().enumerate() {
        let idx: u8 = match i {
            0 => 0,
            1 => 1,
            2 => 2,
            3 => 3,
            4 => 5,
            5 => 4,
            6 => 6,
            7 => 8,
            8 => 7,
            _ => unreachable!(),
        };
        assert_ok(
            send(
                &mut svm,
                signer,
                &[place_move_ix(&signer.pubkey(), &game, idx, &program_id)],
            ),
            &format!("move {i}"),
        );
    }

    let g = game_state(&svm, &game);
    assert_eq!(g.status, ludic::state::Game::DRAW);
    assert_eq!(g.move_count, 9);
}

#[test]
fn test_rejects_out_of_bounds_move() {
    let (mut svm, x, o, game, program_id) = setup();
    assert_ok(
        send(&mut svm, &x, &[create_game_ix(&x, &o.pubkey(), &program_id)]),
        "create game",
    );
    assert_err(
        send(
            &mut svm,
            &x,
            &[place_move_ix(&x.pubkey(), &game, 9, &program_id)],
        ),
        "index 9",
    );
    assert_err(
        send(
            &mut svm,
            &x,
            &[place_move_ix(&x.pubkey(), &game, 255, &program_id)],
        ),
        "index 255",
    );
    // Game still active, X can still move legally.
    assert_ok(
        send(&mut svm, &x, &[place_move_ix(&x.pubkey(), &game, 4, &program_id)]),
        "x 4 after rejects",
    );
}

#[test]
fn test_rejects_occupied_cell() {
    let (mut svm, x, o, game, program_id) = setup();
    assert_ok(
        send(&mut svm, &x, &[create_game_ix(&x, &o.pubkey(), &program_id)]),
        "create game",
    );
    assert_ok(
        send(&mut svm, &x, &[place_move_ix(&x.pubkey(), &game, 0, &program_id)]),
        "x 0",
    );
    assert_err(
        send(
            &mut svm,
            &o,
            &[place_move_ix(&o.pubkey(), &game, 0, &program_id)],
        ),
        "o reuses cell 0",
    );
}

#[test]
fn test_rejects_move_out_of_turn() {
    let (mut svm, x, o, game, program_id) = setup();
    assert_ok(
        send(&mut svm, &x, &[create_game_ix(&x, &o.pubkey(), &program_id)]),
        "create game",
    );
    // O tries to open the game.
    assert_err(
        send(
            &mut svm,
            &o,
            &[place_move_ix(&o.pubkey(), &game, 4, &program_id)],
        ),
        "o opens",
    );
    // A third party cannot move either.
    let stranger = Keypair::new();
    svm.airdrop(&stranger.pubkey(), 1_000_000_000).unwrap();
    assert_err(
        send(
            &mut svm,
            &stranger,
            &[place_move_ix(&stranger.pubkey(), &game, 4, &program_id)],
        ),
        "stranger moves",
    );
}

#[test]
fn test_rejects_move_after_game_over() {
    let (mut svm, x, o, game, program_id) = setup();
    assert_ok(
        send(&mut svm, &x, &[create_game_ix(&x, &o.pubkey(), &program_id)]),
        "create game",
    );
    for (i, signer) in [&x, &o, &x, &o, &x].iter().enumerate() {
        let idx: u8 = match i {
            0 => 0,
            1 => 1,
            2 => 3,
            3 => 4,
            4 => 6,
            _ => unreachable!(),
        };
        assert_ok(
            send(
                &mut svm,
                signer,
                &[place_move_ix(&signer.pubkey(), &game, idx, &program_id)],
            ),
            &format!("move {i}"),
        );
    }
    assert_eq!(game_state(&svm, &game).status, ludic::state::Game::X_WON);

    assert_err(
        send(
            &mut svm,
            &o,
            &[place_move_ix(&o.pubkey(), &game, 7, &program_id)],
        ),
        "move after game over",
    );
}
