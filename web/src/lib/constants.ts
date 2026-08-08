import { PublicKey } from "@solana/web3.js";

/** Program ID of the deployed Ludic program (devnet). */
export const PROGRAM_ID = new PublicKey(
  import.meta.env.VITE_PROGRAM_ID ?? "EBNzCwTjBuuShtM47Cux5nMNesRa2BVSamaPJtPaKYje",
);

export const CLUSTER = "devnet";

export const RPC_URL = import.meta.env.VITE_RPC_URL ?? "https://api.devnet.solana.com";

export const EXPLORER_CLUSTER = "?cluster=devnet";

export const GAME_SEED = new TextEncoder().encode("game");

export const POLL_INTERVAL_MS = 2500;
