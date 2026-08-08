// End-to-end smoke test: runs the exact frontend client logic against the
// deployed devnet program, signing with the fee-payer keypair.
// Node 20+ (global crypto). Usage: node scripts/smoke-test.mjs
import { readFileSync } from "node:fs";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
} from "@solana/web3.js";

const RPC = "https://api.devnet.solana.com";
const PROGRAM_ID = new PublicKey("EBNzCwTjBuuShtM47Cux5nMNesRa2BVSamaPJtPaKYje");
const GAME_SEED = new TextEncoder().encode("game");

const conn = new Connection(RPC, "confirmed");

async function discriminator(namespace, name) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${namespace}:${name}`),
  );
  return new Uint8Array(digest).slice(0, 8);
}

function randomSeed() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let n = 0n;
  for (let i = 7; i >= 0; i--) n = (n << 8n) | BigInt(bytes[i]);
  return n;
}

function seedBytes(seed) {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, seed, true);
  return out;
}

function gamePda(x, o, seed) {
  return PublicKey.findProgramAddressSync(
    [GAME_SEED, x.toBytes(), o.toBytes(), seedBytes(seed)],
    PROGRAM_ID,
  );
}

async function createGameIx(payer, opponent, seed, game) {
  const disc = await discriminator("global", "create_game");
  const data = new Uint8Array(8 + 32 + 8);
  data.set(disc, 0);
  data.set(opponent.toBytes(), 8);
  data.set(seedBytes(seed), 8 + 32);
  return {
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: game, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: Buffer.from(data),
  };
}

async function placeMoveIx(player, seed, index, game) {
  const disc = await discriminator("global", "place_move");
  const data = new Uint8Array(8 + 8 + 1);
  data.set(disc, 0);
  data.set(seedBytes(seed), 8);
  data[8 + 8] = index;
  return {
    keys: [
      { pubkey: game, isSigner: false, isWritable: true },
      { pubkey: player, isSigner: true, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: Buffer.from(data),
  };
}

function decodeGame(data) {
  if (data.length < 85) throw new Error(`Game account too small: ${data.length}`);
  let offset = 8;
  const readKey = () => {
    const bytes = data.slice(offset, offset + 32);
    offset += 32;
    return new PublicKey(bytes);
  };
  const xPlayer = readKey();
  const oPlayer = readKey();
  const turn = data[offset++];
  const status = data[offset++];
  const board = Array.from(data.slice(offset, offset + 9));
  offset += 9;
  const moveCount = data[offset++];
  return { xPlayer, oPlayer, turn, status, board, moveCount };
}

async function send(ix, payer) {
  const tx = new Transaction();
  tx.add(ix);
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  tx.sign(payer);
  const sig = await conn.sendRawTransaction(tx.serialize());
  await conn.confirmTransaction(sig, "confirmed");
  return sig;
}

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ok: ${msg}`);
}

// ---- run ----
const feePayer = Keypair.fromSecretKey(
  Uint8Array.from(JSON.parse(readFileSync("../keys/fee-payer.json", "utf8"))),
);
const player = feePayer; // pass-and-play: same wallet for both sides
const seed = randomSeed();
const [pda] = gamePda(player.publicKey, player.publicKey, seed);

console.log("player:", player.publicKey.toBase58());
console.log("seed:", seed.toString());
console.log("game PDA:", pda.toBase58());

console.log("1. create game...");
const createSig = await send(await createGameIx(player.publicKey, player.publicKey, seed, pda), feePayer);
console.log(`  tx: ${createSig}`);

let state = decodeGame((await conn.getAccountInfo(pda)).data);
assert(state.xPlayer.equals(player.publicKey), "x_player = player");
assert(state.oPlayer.equals(player.publicKey), "o_player = player (pass-and-play)");
assert(state.turn === 0, "turn = X");
assert(state.status === 0, "status = active");
assert(state.board.every((c) => c === 0), "board empty");
assert(state.moveCount === 0, "move_count = 0");

console.log("2. X moves at 0...");
await send(await placeMoveIx(player.publicKey, seed, 0, pda), feePayer);
state = decodeGame((await conn.getAccountInfo(pda)).data);
assert(state.board[0] === 1, "cell 0 = X");
assert(state.turn === 1, "turn switched to O");
assert(state.moveCount === 1, "move_count = 1");

console.log("3. O moves at 1...");
await send(await placeMoveIx(player.publicKey, seed, 1, pda), feePayer);
state = decodeGame((await conn.getAccountInfo(pda)).data);
assert(state.board[1] === 2, "cell 1 = O");
assert(state.turn === 0, "turn back to X");
assert(state.moveCount === 2, "move_count = 2");

console.log("4. X wins with row 0,3,6...");
await send(await placeMoveIx(player.publicKey, seed, 3, pda), feePayer); // X
await send(await placeMoveIx(player.publicKey, seed, 4, pda), feePayer); // O
await send(await placeMoveIx(player.publicKey, seed, 6, pda), feePayer); // X wins
state = decodeGame((await conn.getAccountInfo(pda)).data);
assert(state.status === 1, "status = X_WON");
assert(state.moveCount === 5, "move_count = 5");

console.log("\nE2E smoke test PASSED");
