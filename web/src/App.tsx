import { useState } from "react";
import { HubPage } from "./pages/HubPage";
import { TicTacToePage } from "./pages/TicTacToePage";

export type View = "hub" | "tic-tac-toe";

export function App() {
  const [view, setView] = useState<View>("hub");
  return view === "hub" ? (
    <HubPage onPlay={() => setView("tic-tac-toe")} />
  ) : (
    <TicTacToePage onBack={() => setView("hub")} />
  );
}
