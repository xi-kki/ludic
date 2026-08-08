import { Buffer } from "buffer";
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import { GAME_SEED, PROGRAM_ID } from "./constants";

export const STATUS = {
  ACTIVE: 0,
  X_WON: 1,
  O_WON: 2,
  DRAW: 3,
} as const;

export interface GameState {
  xPlayer: PublicKey;
  oPlayer: PublicKey;
  turn: number;
  status: number;
  board: number[];
  moveCount: number;
}

/** First 8 bytes of sha256("<namespace>:<name>") — the Anchor discriminator. */
async function discriminator(namespace: string, name: string): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(`${namespace}:${name}`),
  );
  return new Uint8Array(digest).slice(0, 8);
}

/** Random 64-bit little-endian seed for a new game. */
export function randomSeed(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  let n = 0n;
  for (let i = 7; i >= 0; i--) {
    n = (n << 8n) | BigInt(bytes[i]);
  }
  return n;
}

function seedBytes(seed: bigint): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigUint64(0, seed, true);
  return out;
}

/** PDA for a game: seeds [b"game", x_player, o_player, seed_le_u64]. */
export function gamePda(x: PublicKey, o: PublicKey, seed: bigint): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [GAME_SEED, x.toBytes(), o.toBytes(), seedBytes(seed)],
    PROGRAM_ID,
  );
}

/** Builds the create_game instruction. Payer plays X, opponent plays O. */
export async function createGameIx(
  payer: PublicKey,
  opponent: PublicKey,
  seed: bigint,
  game: PublicKey,
): Promise<TransactionInstruction> {
  const disc = await discriminator("global", "create_game");
  const data = new Uint8Array(8 + 32 + 8);
  data.set(disc, 0);
  data.set(opponent.toBytes(), 8);
  data.set(seedBytes(seed), 8 + 32);
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: game, isSigner: false, isWritable: true },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: Buffer.from(data),
  });
}

/** Builds the place_move instruction. */
export async function placeMoveIx(
  player: PublicKey,
  seed: bigint,
  index: number,
  game: PublicKey,
): Promise<TransactionInstruction> {
  const disc = await discriminator("global", "place_move");
  const data = new Uint8Array(8 + 8 + 1);
  data.set(disc, 0);
  data.set(seedBytes(seed), 8);
  data[8 + 8] = index;
  return new TransactionInstruction({
    keys: [
      { pubkey: game, isSigner: false, isWritable: true },
      { pubkey: player, isSigner: true, isWritable: false },
    ],
    programId: PROGRAM_ID,
    data: Buffer.from(data),
  });
}

/** Sends a transaction through the wallet adapter. */
export async function sendWithWallet(
  conn: Connection,
  wallet: { publicKey: PublicKey; signTransaction<T extends Transaction>(tx: T): Promise<T> },
  ixs: TransactionInstruction[],
  payer: PublicKey,
): Promise<string> {
  const tx = new Transaction();
  tx.add(...ixs);
  tx.feePayer = payer;
  tx.recentBlockhash = (await conn.getLatestBlockhash()).blockhash;
  const signed = await wallet.signTransaction(tx);
  return conn.sendRawTransaction(signed.serialize());
}

/**
 * Decodes a Game account. Layout (borsh, field order of the Rust struct):
 * 8-byte discriminator, x_player[32], o_player[32], turn u8, status u8,
 * board[9], move_count u8, bump u8.
 */
export function decodeGame(data: Uint8Array): GameState {
  if (data.length < 85) {
    throw new Error(`Game account too small: ${data.length} bytes`);
  }
  let offset = 8;
  const readKey = (): PublicKey => {
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

/** Fetches and decodes the current game state, or null if the account is gone. */
export async function fetchGame(conn: Connection, game: PublicKey): Promise<GameState | null> {
  const info = await conn.getAccountInfo(game);
  if (!info || !info.data) return null;
  return decodeGame(info.data);
}
