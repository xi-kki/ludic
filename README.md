# Ludic — On-chain Arcade on Solana

Multi-game arcade where game state lives on the Solana blockchain. First game:
**fully on-chain Tic-Tac-Toe** — every move is a transaction, and the board is
a program account nobody can dispute.

- **Program (devnet):** `EBNzCwTjBuuShtM47Cux5nMNesRa2BVSamaPJtPaKYje`
  ([explorer](https://explorer.solana.com/address/EBNzCwTjBuuShtM47Cux5nMNesRa2BVSamaPJtPaKYje?cluster=devnet))
- **Web app:** `web/` — Vite + React + Tailwind, wallet via Phantom/Solflare
- **More games:** Connect Four, Snake, Memory — coming soon

## How Tic-Tac-Toe works

```
create_game(opponent, seed)   → initializes a Game PDA with an empty board
place_move(seed, index 0-8)   → validates turn + empty cell, records the move,
                                checks the 8 win lines, then draw or pass turn
```

- **Game PDA:** `seeds [b"game", x_player, o_player, seed_le_u64]`
- **Game account layout (borsh):** discriminator(8) | x_player(32) | o_player(32)
  | turn(1) | status(1) | board(9) | move_count(1) | bump(1)
- **status:** 0 active · 1 X won · 2 O won · 3 draw
- Free play — no wagering in this version.

## Repo layout

```
programs/ludic/        Anchor 1.1.2 program (Rust)
  src/lib.rs           declare_id + entry points
  src/state.rs         Game account + win-line logic
  src/instructions/    create_game.rs, place_move.rs
  tests/test_game.rs   litesvm integration tests (cargo test)
web/                   Vite + React frontend (arcade hub + game page)
  src/lib/game.ts      raw web3.js client (discriminators, PDA, borsh decode)
  scripts/smoke-test.mjs  end-to-end smoke test against devnet
idl/ludic.json         generated IDL (from CI)
keys/                  deploy + fee-payer keypairs — GITIGNORED, never commit
.github/workflows/build.yml  CI: anchor build + cargo test + artifact upload
```

## Build & test

The program builds **only in CI** (GitHub Actions on Linux) — this project's
Windows dev machine has no MSVC toolchain. Pushing to `main` triggers
`anchor build` + `cargo test` (litesvm) and uploads `ludic.so` + `ludic.json`
as artifacts.

```bash
# local frontend
cd web && npm install && npm run dev

# local frontend build (typecheck + bundle)
cd web && npm run build

# end-to-end smoke test against the deployed devnet program
cd web && node scripts/smoke-test.mjs   # needs ../keys/fee-payer.json funded
```

## Deploying the program

```bash
solana program deploy target/deploy/ludic.so \
  --program-id keys/deploy-keypair.json \
  --fee-payer keys/fee-payer.json \
  --url https://api.devnet.solana.com
```

The program address keypair must be **empty** (no lamports) before deploying —
use a separate funded keypair as fee payer.

## Security

- Program validates all inputs on-chain: move index bounds, turn, cell
  occupancy, game-over state.
- No secrets in the web bundle — public RPC + program ID only.
- Deploy keypairs are gitignored; never commit them.
