"use client";

import { useEffect, useRef, useState } from "react";

const glyphs: Record<string, string[]> = {
  A: ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
  B: ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
  C: ["01111", "10000", "10000", "10000", "10000", "10000", "01111"],
  D: ["11110", "10001", "10001", "10001", "10001", "10001", "11110"],
  E: ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
  H: ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
  K: ["10001", "10010", "10100", "11000", "10100", "10010", "10001"],
  O: ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
  Q: ["01110", "10001", "10001", "10001", "10101", "10010", "01101"],
  R: ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
  S: ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
  T: ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
  U: ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
  ".": ["000", "000", "000", "000", "000", "011", "011"],
};

function drawLogo(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const scale = 14;
  const gap = 2;
  const lineGap = 2;
  const lines = ["HORSE BOOKS", ".QUEST"];
  const widths = lines.map((line) => [...line].reduce((total, char) => total + (glyphs[char]?.[0].length || 5) + gap, 0));
  const unitsWide = Math.max(...widths);
  canvas.width = unitsWide * scale;
  canvas.height = (7 * 2 + lineGap) * scale;
  ctx.imageSmoothingEnabled = false;
  const palette = ["#fff3bd", "#dca94e", "#bf7136", "#779652"];

  lines.forEach((line, lineIndex) => {
    let x = Math.round((unitsWide - widths[lineIndex]) / 2);
    const y = lineIndex * (7 + lineGap);
    for (const char of line) {
      const glyph = glyphs[char];
      if (!glyph) { x += 4; continue; }
      glyph.forEach((row, rowIndex) => [...row].forEach((bit, colIndex) => {
        if (bit !== "1") return;
        const px = (x + colIndex) * scale;
        const py = (y + rowIndex) * scale;
        ctx.fillStyle = "#1d3028";
        ctx.fillRect(px + scale, py + scale, scale, scale);
        ctx.fillStyle = palette[(rowIndex + colIndex + lineIndex) % palette.length];
        ctx.fillRect(px, py, scale, scale);
        ctx.fillStyle = "rgba(255,255,255,.28)";
        ctx.fillRect(px + 2, py + 2, scale - 4, 3);
      }));
      x += glyph[0].length + gap;
    }
  });
}

type Reward = { id: number; label: string; x: number; y: number; kind?: "loot" | "unit" };
type Character = "HORSE" | "BOOKS";
type SavedGame = { character: Character; power: number; companions: number };
type FightResult = { opponentCount: number; playerCount: number; winner: "player" | "opponent" | "draw"; reason: string };
const saveKey = "horsebooks.quest.save.v1";
// Stable pseudo-random positions: each extra unit gets its own place rather than
// being quietly forced into an eight-space formation once the army gets silly.
function armyPosition(index: number) {
  const random = (salt: number) => {
    const value = Math.sin((index + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return value - Math.floor(value);
  };

  return {
    left: `${-8 + random(1) * 101}%`,
    top: `${2 + random(2) * 72}%`,
    delay: `${-(random(3) * 4.5)}s`,
  };
}

export default function Home() {
  const [screen, setScreen] = useState<"landing" | "choose" | "game" | "result">("landing");
  const [character, setCharacter] = useState<Character | null>(null);
  const [power, setPower] = useState(0);
  const [companions, setCompanions] = useState(0);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [hasLoadedSave, setHasLoadedSave] = useState(false);
  const [wonWar, setWonWar] = useState(false);
  const [fightResult, setFightResult] = useState<FightResult | null>(null);
  const lastProductionTick = useRef<number | null>(null);
  const lastSavedAt = useRef(0);

  useEffect(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#logo");
    if (canvas) drawLogo(canvas);
  }, [screen]);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(saveKey);
      if (saved) {
        const game = JSON.parse(saved) as Partial<SavedGame>;
        if ((game.character === "HORSE" || game.character === "BOOKS") && typeof game.power === "number" && typeof game.companions === "number") {
          setCharacter(game.character);
          setPower(Math.max(0, game.power));
          setCompanions(Math.max(0, Math.floor(game.companions)));
          setScreen("game");
        }
      }
    } catch {
      // A corrupt save is merely an unexpected new beginning.
    }
    setHasLoadedSave(true);
  }, []);

  useEffect(() => {
    if (!hasLoadedSave || !character || wonWar) return;
    const now = Date.now();
    if (now - lastSavedAt.current < 1000) return;
    try {
      window.localStorage.setItem(saveKey, JSON.stringify({ character, power, companions }));
      lastSavedAt.current = now;
    } catch {
      // The game remains playable if this browser declines to keep the evidence.
    }
  }, [character, companions, hasLoadedSave, power]);

  function chooseCharacter(side: Character) {
    setCharacter(side);
    setPower(0);
    setCompanions(0);
    setWonWar(false);
    setScreen("game");
  }

  useEffect(() => {
    if (screen !== "game" || companions === 0) {
      lastProductionTick.current = null;
      return;
    }

    lastProductionTick.current = performance.now();
    const timer = window.setInterval(() => {
      const now = performance.now();
      const previous = lastProductionTick.current ?? now;
      lastProductionTick.current = now;
      // One companion produces one POWER every five seconds, in tiny satisfying-ish drips.
      setPower((current) => current + (companions * (now - previous)) / 5000);
    }, 100);

    return () => window.clearInterval(timer);
  }, [screen, companions]);

  function collect() {
    if (!character) return;
    const id = Date.now();
    const rare = Math.random() < 0.08;
    const bonus = rare ? (character === "HORSE" ? "🐴" : "📖") : "";
    const x = 42 + Math.random() * 16;
    const amount = rare ? 10 : 1;
    setPower((current) => current + amount);
    setRewards((current) => [
      ...current,
      { id, label: `+${amount}`, x, y: 42 + Math.random() * 12 },
      ...(bonus ? [{ id: id + 1, label: bonus, x: x + 5, y: 48 + Math.random() * 8, kind: "loot" }] : []),
    ]);
    window.setTimeout(() => setRewards((current) => current.filter((reward) => reward.id !== id && reward.id !== id + 1)), 1250);
  }

  function recruitCompanion() {
    if (!character || power < 50) return;
    const id = Date.now();
    const companionName = character === "HORSE" ? "HORSE" : "BOOK";
    setPower((current) => current - 50);
    setCompanions((current) => current + 1);
    setRewards((current) => [...current, { id, label: `+1 ${companionName}`, x: 50, y: 52, kind: "unit" }]);
    window.setTimeout(() => setRewards((current) => current.filter((reward) => reward.id !== id)), 1250);
  }

  function goToWar() {
    if (!character || companions <= 1) return;

    // A vaguely fair army has 80–120% as many things as you. Rounding makes tiny armies hilariously tense.
    const opponentCount = Math.max(1, Math.round(companions * (0.8 + Math.random() * 0.4)));
    const winner = companions > opponentCount ? "player" : companions < opponentCount ? "opponent" : "draw";
    const opposingCharacter = character === "HORSE" ? "BOOKS" : "HORSES";
    const playerWon = winner === "player";
    const opponentWon = winner === "opponent";

    setFightResult({
      playerCount: companions,
      opponentCount,
      winner,
      reason: playerWon
        ? character === "HORSE" ? "HORSE IS BIG ANIMAL." : "HORSES ARE SCARED AND DIE EASY."
        : opponentWon
          ? character === "HORSE" ? "HORSES ARE SCARED AND DIE EASY." : "HORSE IS BIG ANIMAL."
          : `${character} AND ${opposingCharacter} HAVE REACHED A POINTLESS STALEMATE.`,
    });
    if (playerWon) {
      try { window.localStorage.removeItem(saveKey); } catch { /* The browser may retain the shame. */ }
      setWonWar(true);
    }
    setScreen("result");
  }

  function startAgain() {
    try { window.localStorage.removeItem(saveKey); } catch { /* A new quest may still begin. */ }
    setCharacter(null);
    setPower(0);
    setCompanions(0);
    setFightResult(null);
    setWonWar(false);
    setScreen("landing");
  }

  const characterEmoji = character === "HORSE" ? "🐴" : "📚";
  const moreLabel = "MORE POWER";
  const companionLabel = character === "HORSE" ? "HORSES" : "BOOKS";
  const recruitLabel = character === "HORSE" ? "GET HORSE" : "GET BOOK";
  const roundedPower = Math.floor(power);
  const recruitAvailable = power >= 50;
  const canFight = companions > 1;
  const opponentLabel = character === "HORSE" ? "BOOKS" : "HORSES";
  // Deliberately do not cap this. More than 100 POWER is allowed to escape.
  const meterWidth = power;

  return (
    <main className={`game ${screen === "choose" ? "is-choosing" : ""} ${screen === "game" ? "is-playing" : ""}`} aria-label="Horse Books Quest">
      <div className="fog fog-one" aria-hidden="true" />
      <div className="fog fog-two" aria-hidden="true" />
      <div className="sparkles" aria-hidden="true">✦　·　✧　·　✦</div>
      {screen === "landing" ? (
        <section className="hero">
          <p className="eyebrow">THE INTERNET&apos;S MOST HONEST IDLE RPG</p>
          <div className="logo-wrap" aria-label="Horse Books dot Quest"><canvas id="logo" aria-hidden="true" /><span className="sr-only">Horse Books dot Quest</span></div>
          <p className="tagline">Choose a Horse. Choose Books. Let them resolve their differences.</p>
          <button className="begin" onClick={() => setScreen("choose")} type="button">
            <span className="button-shine" aria-hidden="true" />
            <span>BEGIN</span><small>YOU CANNOT UNBEGIN</small>
          </button>
          <p className="fine-print">NO HORSES OR BOOKS WERE GIVEN A FAIR CHANCE.</p>
        </section>
      ) : screen === "choose" ? (
        <section className="choice-screen" aria-labelledby="choice-title">
          <header className="choice-header">
            <p>CHOOSE A CHARACTER</p>
            <h1 id="choice-title">WHO SHALL YOU IDLE?</h1>
          </header>
          <div className="choice-grid">
            <button className="choice choice-horse" type="button" onClick={() => chooseCharacter("HORSE")} aria-label="Choose Horse">
              <span className="choice-emoji" aria-hidden="true">🐴</span><span className="choice-name">HORSE</span><small>BIG ANIMAL</small>
            </button>
            <button className="choice choice-books" type="button" onClick={() => chooseCharacter("BOOKS")} aria-label="Choose Books">
              <span className="choice-emoji" aria-hidden="true">📚</span><span className="choice-name">BOOKS</span><small>MANY PAPERS</small>
            </button>
          </div>
          <p className="choice-note">THIS DECISION IS FINAL, EXCEPT IT IS NOT SAVED ANYWHERE.</p>
        </section>
      ) : screen === "game" ? (
        <section className="play-screen" aria-labelledby="character-title">
          <p className="play-kicker">YOUR CHOSEN CHARACTER</p>
          <div className="game-top-row">
            <div className="character-card">
              <div className="character-army" aria-hidden="true">
                <span className="character-emoji">{characterEmoji}</span>
                {Array.from({ length: Math.max(0, companions - 1) }, (_, index) => {
                  const position = armyPosition(index);
                  return (
                    <span
                      className="army-member"
                      style={{ left: position.left, top: position.top, animationDelay: position.delay }}
                      key={index}
                    >
                      {characterEmoji}
                    </span>
                  );
                })}
              </div>
              <h1 id="character-title">{character}</h1>
              <p>{character === "HORSE" ? "BIG ANIMAL. LITTLE THOUGHT." : "MANY PAPERS. NO LEGS."}</p>
            </div>
            <div className="game-gauges">
              <div className="power-panel" aria-label={`Power ${roundedPower}`}>
                <div className="power-heading"><span>POWER</span><strong>{roundedPower}</strong></div>
                <div className="power-meter"><div className="power-fill" style={{ width: `${meterWidth}%` }} /></div>
                <small>{power < 100 ? "MORE IS ALWAYS BETTER." : "POWER IS NOW CONCERNING."}</small>
              </div>
              <div className="companion-panel" aria-label={`${companions} ${companionLabel}`}>
                <div><span>{companionLabel}</span><strong>{companions}</strong></div>
                <small>{companions === 0 ? "NO AUTOMATIC POWER. SAD." : `+${companions} POWER EVERY 5 SECONDS.`}</small>
              </div>
            </div>
          </div>
          <div className="game-actions">
            <button className={`more-button ${character === "HORSE" ? "more-horse" : "more-books"}`} type="button" onClick={collect} aria-label={`Increase ${character.toLowerCase()} power`}>
              <span>{moreLabel}</span><small>FOR {character === "HORSE" ? "HORSES" : "BOOKS"}</small>
            </button>
            <button
              className={`recruit-button ${character === "HORSE" ? "more-horse" : "more-books"}`}
              type="button"
              onClick={recruitCompanion}
              disabled={!recruitAvailable}
              aria-label={recruitAvailable ? `${recruitLabel}, costs 50 power` : `${recruitLabel} locked: requires 50 power`}
            >
              <span>{recruitLabel}</span><small>COSTS 50 POWER · MAKES POWER ITSELF</small>
            </button>
            <button
              className="fight-button"
              type="button"
              onClick={goToWar}
              disabled={!canFight}
              aria-label={canFight ? `Fight ${opponentLabel.toLowerCase()}` : `Fight ${opponentLabel.toLowerCase()} locked: requires more than one entity`}
            >
              <span>FIGHT {opponentLabel}</span><small>GO TO WAR</small>
            </button>
          </div>
        </section>
      ) : (
        <section className="result-screen" aria-labelledby="result-title">
          <p className="play-kicker">THE FINAL SCREEN</p>
          <span className="result-emoji" aria-hidden="true">{fightResult?.winner === "player" ? "🏆" : fightResult?.winner === "opponent" ? "💀" : "⚔️"}</span>
          <h1 id="result-title">{fightResult?.winner === "player" ? "YOU WIN" : fightResult?.winner === "opponent" ? "YOU LOSE" : "DRAW"}</h1>
          <div className="war-counts" aria-label={`You had ${fightResult?.playerCount ?? 0}; opponent had ${fightResult?.opponentCount ?? 0}`}>
            <div><span>YOUR {character}</span><strong>{fightResult?.playerCount}</strong></div>
            <div><span>THEIR {opponentLabel}</span><strong>{fightResult?.opponentCount}</strong></div>
          </div>
          <p className="war-reason">{fightResult?.reason}</p>
          {fightResult?.winner === "player" ? (
            <button className="start-again-button" type="button" onClick={startAgain}><span>START AGAIN</span><small>ALL PROGRESS WAS HEROICALLY ERASED</small></button>
          ) : (
            <button className="start-again-button" type="button" onClick={startAgain}><span>FIGHT AGAIN</span></button>
          )}
        </section>
      )}
      <div className="reward-layer" aria-live="polite" aria-atomic="true">
        {rewards.map((reward) => <span className={`reward-pop ${reward.kind === "loot" ? "loot-pop" : reward.kind === "unit" ? "unit-pop" : "credit-pop"}`} key={reward.id} style={{ left: `${reward.x}%`, top: `${reward.y}%` }}>{reward.label}</span>)}
      </div>
      <div className="ground" aria-hidden="true" />
    </main>
  );
}
