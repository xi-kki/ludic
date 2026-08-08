# Ludic — CLAUDE.md

## Overview
- **One-liner:** Multi-game arcade on Solana. Game #1: fully on-chain Tic-Tac-Toe (Anchor + Next.js). More games coming.
- **Type:** Web3 / Solana
- **Status:** building

## Tech Stack
- Program: Anchor 1.1.2 (Rust), solana CLI 4.2.0, platform-tools v1.52 (pinned via `--tools-version v1.52`)
- Tests: litesvm (in-process SVM, Rust `cargo test` — no test-validator needed)
- Frontend: Next.js (App Router, TypeScript, Tailwind) + `@solana/wallet-adapter-react` + `@coral-xyz/anchor`
- Network: devnet
- CI: GitHub Actions (ubuntu) — the ONLY place the program builds. This dev machine (Windows, no MSVC/admin) cannot compile SBF natively.

## Structure
```
programs/ludic/src/
  lib.rs            declare_id + #[program] entry points
  constants.rs      GAME_SEED
  error.rs          LudicError codes
  state.rs          Game account (board, turn, status) + win-line logic
  instructions/     create_game.rs, place_move.rs (one file per ix)
programs/ludic/tests/test_game.rs   litesvm integration tests
web/                Next.js frontend (coming)
.github/workflows/build.yml         CI: anchor build + cargo test + artifact upload
keys/               deploy keypair — GITIGNORED, never commit
```

## Architecture
- Game PDA: seeds `[b"game", x_player, o_player, seed_u64]`
- `create_game(payer → X, opponent → O, seed)`: initializes empty board, X to move
- `place_move(seed, index 0-8)`: validates turn + empty cell, records move, checks 8 win lines, then draw (9 moves) or passes turn
- `status`: 0 active, 1 X won, 2 O won, 3 draw
- No wagering — free play MVP. Escrow/prize pools are a later game.

## Build & Test
- CI builds and tests: `anchor build` then `cargo test --manifest-path programs/ludic/Cargo.toml`
- Artifacts: `target/deploy/ludic.so` + `target/idl/ludic.json` (uploaded as CI artifact `ludic-program`)
- Deploy (from Windows): download CI artifact → `solana program deploy deploy/ludic.so --program-id keys/deploy-keypair.json --fee-payer keys/fee-payer.json --url https://api.devnet.solana.com` (program keypair must be empty; fee payer must be funded)
- On this Windows box, anchor/solana CLIs run through `.cmd` wrappers in `C:/tmp/tools` (git-bash cannot exec the PE binaries directly).

## Security (NON-NEGOTIABLE)
1. NEVER commit `keys/deploy-keypair.json` (already gitignored) or any `.env`
2. All user inputs validated in-program (move index 0-8, turn checks, cell occupancy)
3. Frontend: never derive private keys, never send SOL without explicit user intent
4. No secrets in the web bundle — public RPC + program ID only
5. Before ship: secret scan over the repo (keys/ and artifacts/ are gitignored)

## Roadmap
- [x] Program: create_game, place_move, win/draw detection
- [x] Tests: create, win, draw, invalid index, occupied cell, wrong turn, game over (litesvm, CI)
- [x] CI build green, program deployed to devnet (EBNzCwTjBuuShtM47Cux5nMNesRa2BVSamaPJtPaKYje)
- [x] Frontend: Vite + React hub + Tic-Tac-Toe, deployed to Vercel
- [x] E2E smoke test passed against devnet
- Later games: Connect Four, Snake, Memory (hub is built to drop in new Anchor programs)
