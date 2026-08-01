"use client";

import { useEffect, useState } from "react";

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

type Reward = { id: number; label: string; x: number; y: number; kind?: "loot" };
type Character = "HORSE" | "BOOKS";

export default function Home() {
  const [screen, setScreen] = useState<"landing" | "choose" | "game">("landing");
  const [character, setCharacter] = useState<Character | null>(null);
  const [power, setPower] = useState(0);
  const [rewards, setRewards] = useState<Reward[]>([]);

  useEffect(() => {
    const canvas = document.querySelector<HTMLCanvasElement>("#logo");
    if (canvas) drawLogo(canvas);
  }, []);

  function chooseCharacter(side: Character) {
    setCharacter(side);
    setPower(0);
    setScreen("game");
  }

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

  const characterEmoji = character === "HORSE" ? "🐴" : "📚";
  const moreLabel = character === "HORSE" ? "MORE HORSE" : "MORE BOOKS";
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
      ) : (
        <section className="play-screen" aria-labelledby="character-title">
          <p className="play-kicker">YOUR CHOSEN CHARACTER</p>
          <div className="character-card">
            <span className="character-emoji" aria-hidden="true">{characterEmoji}</span>
            <h1 id="character-title">{character}</h1>
            <p>{character === "HORSE" ? "BIG ANIMAL. LITTLE THOUGHT." : "MANY PAPERS. NO LEGS."}</p>
          </div>
          <div className="power-panel" aria-label={`Power ${power}`}>
            <div className="power-heading"><span>POWER</span><strong>{power}</strong></div>
            <div className="power-meter"><div className="power-fill" style={{ width: `${meterWidth}%` }} /></div>
            <small>{power < 100 ? "MORE IS ALWAYS BETTER." : "POWER IS NOW CONCERNING."}</small>
          </div>
          <button className={`more-button ${character === "HORSE" ? "more-horse" : "more-books"}`} type="button" onClick={collect} aria-label={`Add more ${character.toLowerCase()} and increase power`}>
            <span>{moreLabel}</span><small>INCREASE POWER</small>
          </button>
        </section>
      )}
      <div className="reward-layer" aria-live="polite" aria-atomic="true">
        {rewards.map((reward) => <span className={`reward-pop ${reward.kind === "loot" ? "loot-pop" : "credit-pop"}`} key={reward.id} style={{ left: `${reward.x}%`, top: `${reward.y}%` }}>{reward.label}</span>)}
      </div>
      <div className="ground" aria-hidden="true"><span className="tuft tuft-a">♠</span><span className="tuft tuft-b">♠</span><span className="tuft tuft-c">♠</span><span className="rock">◆</span><span className="daisy">✦</span></div>
    </main>
  );
}
