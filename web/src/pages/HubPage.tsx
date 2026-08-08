interface GameCard {
  name: string;
  tagline: string;
  status: "live" | "soon";
  accent: string;
}

const GAMES: GameCard[] = [
  {
    name: "Tic-Tac-Toe",
    tagline: "Fully on-chain. Every move is a Solana transaction.",
    status: "live",
    accent: "text-x",
  },
  {
    name: "Connect Four",
    tagline: "Drop your token into the grid. Coming soon.",
    status: "soon",
    accent: "text-violet",
  },
  {
    name: "Snake",
    tagline: "On-chain snake with a leaderboard. Coming soon.",
    status: "soon",
    accent: "text-o",
  },
  {
    name: "Memory",
    tagline: "Match the pairs, mint the score. Coming soon.",
    status: "soon",
    accent: "text-neon",
  },
];

export function HubPage({ onPlay }: { onPlay: () => void }) {
  return (
    <main className="arcade-bg flex flex-1 flex-col items-center px-6 py-16">
      <div className="max-w-3xl w-full text-center">
        <p className="font-mono text-xs tracking-[0.35em] text-neon uppercase">
          Multi-game arcade on Solana
        </p>
        <h1 className="mt-3 text-6xl font-black tracking-tight neon-glow">
          LUDIC
        </h1>
        <p className="mt-4 text-slate-400">
          Games whose state lives on-chain. Play Tic-Tac-Toe now — every move
          you make is a transaction, and the board is a program account nobody
          can dispute.
        </p>
      </div>

      <div className="mt-14 grid w-full max-w-3xl gap-5 sm:grid-cols-2">
        {GAMES.map((game) => (
          <article
            key={game.name}
            className={`card-glow rounded-2xl border border-surface-2 bg-surface p-6 transition-all ${
              game.status === "live" ? "" : "opacity-60"
            }`}
          >
            <div className="flex items-center justify-between">
              <h2 className={`text-2xl font-bold ${game.accent}`}>{game.name}</h2>
              <span
                className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest ${
                  game.status === "live"
                    ? "bg-neon/10 text-neon"
                    : "bg-surface-2 text-slate-500"
                }`}
              >
                {game.status === "live" ? "Live" : "Soon"}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-400">{game.tagline}</p>
            {game.status === "live" ? (
              <button
                onClick={onPlay}
                className="mt-5 inline-block rounded-lg bg-neon px-4 py-2 font-mono text-sm font-bold text-background transition-colors hover:bg-neon-dim"
              >
                Play now
              </button>
            ) : (
              <button
                disabled
                className="mt-5 cursor-not-allowed rounded-lg bg-surface-2 px-4 py-2 font-mono text-sm font-bold text-slate-500"
              >
                Coming soon
              </button>
            )}
          </article>
        ))}
      </div>
    </main>
  );
}
