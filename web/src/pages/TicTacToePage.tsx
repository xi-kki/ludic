import { useCallback, useEffect, useMemo, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { PublicKey } from "@solana/web3.js";
import {
  STATUS,
  createGameIx,
  fetchGame,
  gamePda,
  placeMoveIx,
  randomSeed,
  sendWithWallet,
} from "../lib/game";
import type { GameState } from "../lib/game";
import { EXPLORER_CLUSTER, PROGRAM_ID } from "../lib/constants";

const CELLS = [0, 1, 2, 3, 4, 5, 6, 7, 8];

export function TicTacToePage({ onBack }: { onBack: () => void }) {
  const { connection } = useConnection();
  const { publicKey, connected, signTransaction } = useWallet();
  const [game, setGame] = useState<GameState | null>(null);
  const [seed, setSeed] = useState<bigint | null>(null);
  const [gameKey, setGameKey] = useState<PublicKey | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signature, setSignature] = useState<string | null>(null);

  const canSign = Boolean(publicKey && signTransaction);

  const startGame = useCallback(async () => {
    if (!publicKey || !signTransaction) return;
    setError(null);
    setSignature(null);
    setBusy(true);
    try {
      const s = randomSeed();
      const [pda] = gamePda(publicKey, publicKey, s);
      const ix = await createGameIx(publicKey, publicKey, s, pda);
      const sig = await sendWithWallet(
        connection,
        { publicKey, signTransaction },
        [ix],
        publicKey,
      );
      await connection.confirmTransaction(sig, "confirmed");
      setSeed(s);
      setGameKey(pda);
      setSignature(sig);
      setGame(await fetchGame(connection, pda));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create game");
    } finally {
      setBusy(false);
    }
  }, [connection, publicKey, signTransaction]);

  const playMove = useCallback(
    async (index: number) => {
      if (!publicKey || !signTransaction || !seed || !gameKey) return;
      if (game?.status !== STATUS.ACTIVE) return;
      if (game.board[index] !== 0) return;
      setError(null);
      setBusy(true);
      try {
        const ix = await placeMoveIx(publicKey, seed, index, gameKey);
        const sig = await sendWithWallet(
          connection,
          { publicKey, signTransaction },
          [ix],
          publicKey,
        );
        await connection.confirmTransaction(sig, "confirmed");
        setSignature(sig);
        setGame(await fetchGame(connection, gameKey));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to place move");
      } finally {
        setBusy(false);
      }
    },
    [connection, publicKey, signTransaction, seed, gameKey, game],
  );

  // Poll the chain while a game is active so remote moves (or missed
  // confirmations) show up without a page reload.
  useEffect(() => {
    if (!gameKey || game?.status !== STATUS.ACTIVE) return;
    const timer = setInterval(async () => {
      setGame(await fetchGame(connection, gameKey));
    }, 2500);
    return () => clearInterval(timer);
  }, [connection, gameKey, game?.status]);

  const statusLine = useMemo(() => {
    if (!game) return null;
    if (game.status === STATUS.X_WON) return "X wins — three in a row on-chain";
    if (game.status === STATUS.O_WON) return "O wins — three in a row on-chain";
    if (game.status === STATUS.DRAW) return "Draw — the board is full";
    return game.turn === 0 ? "X to move" : "O to move";
  }, [game]);

  const gameOver = game !== null && game.status !== STATUS.ACTIVE;
  const canMove = game !== null && game.status === STATUS.ACTIVE && canSign && !busy;

  return (
    <main className="arcade-bg flex flex-1 flex-col items-center px-6 py-12">
      <div className="flex w-full max-w-2xl items-center justify-between">
        <button
          onClick={onBack}
          className="font-mono text-xs uppercase tracking-widest text-slate-500 hover:text-neon"
        >
          &larr; Arcade
        </button>
        <WalletMultiButton />
      </div>

      <h1 className="mt-10 text-4xl font-black tracking-tight neon-glow">
        Tic-Tac-Toe
      </h1>
      <p className="mt-2 font-mono text-xs text-slate-500">
        Fully on-chain &middot; every move is a transaction &middot; devnet
      </p>

      {!connected ? (
        <div className="mt-16 max-w-md rounded-2xl border border-surface-2 bg-surface p-8 text-center">
          <h2 className="text-lg font-bold">Connect a wallet to play</h2>
          <p className="mt-2 text-sm text-slate-400">
            Phantom or Solflare. Your wallet signs each move — the board lives
            in a Solana program account, so no one can argue with the result.
          </p>
        </div>
      ) : !game ? (
        <div className="mt-16 max-w-md rounded-2xl border border-surface-2 bg-surface p-8 text-center">
          <h2 className="text-lg font-bold">Pass-and-play, on-chain</h2>
          <p className="mt-2 text-sm text-slate-400">
            Both players use this device. X moves first, then O — the program
            enforces turns, occupancy, and the win check.
          </p>
          <button
            onClick={startGame}
            disabled={busy || !canSign}
            className="mt-6 rounded-lg bg-neon px-6 py-3 font-mono font-bold text-background transition-colors hover:bg-neon-dim disabled:opacity-50"
          >
            {busy ? "Creating game..." : "New game"}
          </button>
        </div>
      ) : (
        <div className="mt-10 flex w-full max-w-sm flex-col items-center">
          <p
            className={`font-mono text-sm uppercase tracking-widest ${
              game.status === STATUS.ACTIVE
                ? "awaiting-move text-neon"
                : "text-slate-300"
            }`}
          >
            {statusLine}
          </p>

          <div className="mt-6 grid grid-cols-3 gap-3">
            {CELLS.map((i) => {
              const mark = game.board[i];
              return (
                <button
                  key={i}
                  onClick={() => playMove(i)}
                  disabled={!canMove || mark !== 0}
                  className={`flex h-24 w-24 items-center justify-center rounded-xl border border-surface-2 bg-surface text-5xl font-black transition-all sm:h-28 sm:w-28 ${
                    mark !== 0
                      ? mark === 1
                        ? "text-x"
                        : "text-o"
                      : canMove
                        ? "cursor-pointer hover:border-neon hover:shadow-[0_0_16px_rgba(34,211,238,0.35)]"
                        : ""
                  }`}
                  aria-label={`Cell ${i}`}
                >
                  {mark === 1 ? "X" : mark === 2 ? "O" : ""}
                </button>
              );
            })}
          </div>

          {error && (
            <p className="mt-5 max-w-sm text-center text-sm text-red-400">{error}</p>
          )}

          {signature && (
            <a
              href={`https://explorer.solana.com/tx/${signature}${EXPLORER_CLUSTER}`}
              target="_blank"
              rel="noreferrer"
              className="mt-3 font-mono text-xs text-slate-500 underline-offset-2 hover:text-neon hover:underline"
            >
              Last tx: {signature.slice(0, 12)}&hellip;
            </a>
          )}

          {gameOver && (
            <div className="mt-6 flex items-center gap-4">
              <button
                onClick={startGame}
                disabled={busy}
                className="rounded-lg bg-neon px-6 py-3 font-mono font-bold text-background transition-colors hover:bg-neon-dim disabled:opacity-50"
              >
                {busy ? "Creating..." : "Play again"}
              </button>
              <a
                href={`https://explorer.solana.com/address/${gameKey!.toBase58()}${EXPLORER_CLUSTER}`}
                target="_blank"
                rel="noreferrer"
                className="font-mono text-xs text-slate-500 underline-offset-2 hover:text-neon hover:underline"
              >
                View board on-chain
              </a>
            </div>
          )}
        </div>
      )}

      <p className="mt-16 max-w-md text-center font-mono text-[10px] text-slate-600">
        Program: {PROGRAM_ID.toBase58()}
      </p>
    </main>
  );
}
