"use client";

import { useEffect, useRef, useState } from "react";

const STATUS_MESSAGES = [
  "KI überlegt noch…",
  "Fragt kurz den Designer-Geist…",
  "Wählt die perfekte Pixelkombination…",
  "Fast. Wirklich.",
  "Drucker schwitzt. Bitte warten.",
  "Tinte nachgefüllt. Fast…",
  "Optimiert letzte Details…",
  "Manifestiert dein Meisterwerk…",
  "Pixel werden liebevoll arrangiert…",
  "Qualitätskontrolle läuft. Noch.",
];

const RAGE_MESSAGES = [
  "WARUM IST DAS SO LAHM?! 🤬",
  "Ich hab einen Termin um 3!!",
  "*atmet tief durch* …NEIN.",
  "Das ist SABOTAGE. 🕵️",
  "Ich kündige... Nein warte!? Doch nicht.",
  "Mein Opa war schneller... Auf Papier. Mit Stift.",
  "73%?! SEIT EINER EWIGKEIT?!",
  "Ich ruf den Chef des Internets an.",
  "AAAAAAAAAAAAAAAAHHHHHH!!!!!!!",
];

// ── Timings (ms) ─────────────────────────────────────────────────────────────
const T_HEADLINE = 1_000;   // headline fades in
const T_SUBTITLE = 4_000;   // subtitle fades in
const T_BAR      = 7_000;   // bar appears + starts filling
const T_PRINTER  = 16_000;  // printer fades in
const T_TEXT     = 22_000;  // status text appears
const T_BUNNY    = 40_000;  // bunny slides in (arms crossed, foot tap)
const T_RAGE     = 57_000;  // rage mode

// Bar fills over 43 s (starts at T_BAR = 7s, stalls at the 50s mark)
const BAR_DURATION_MS = 43_000;

// Keyframes: [elapsedMs into bar animation, bar%]
const BAR_KF: [number, number][] = [
  [0,          0],
  [2_600,     10],
  [7_700,     24],
  [13_700,    38],
  [20_600,    52],
  [26_600,    62],
  [32_600,    69],
  [38_700,    73],
  [BAR_DURATION_MS, 73],
];

function lerpPct(elapsedMs: number): number {
  if (elapsedMs <= 0) return 0;
  for (let i = 1; i < BAR_KF.length; i++) {
    const [t0, v0] = BAR_KF[i - 1];
    const [t1, v1] = BAR_KF[i];
    if (elapsedMs <= t1) {
      const p = (elapsedMs - t0) / (t1 - t0);
      return Math.round(v0 + p * (v1 - v0));
    }
  }
  return 73;
}
// ─────────────────────────────────────────────────────────────────────────────

type ShirtLoadingAnimationProps = {
  variantCount?: number;
};

export default function ShirtLoadingAnimation({
  variantCount = 1,
}: ShirtLoadingAnimationProps) {
  const [showHeadline, setShowHeadline] = useState(false);
  const [showSubtitle, setShowSubtitle] = useState(false);
  const [showBar,      setShowBar]      = useState(false);
  const [showPrinter,  setShowPrinter]  = useState(false);
  const [showText,     setShowText]     = useState(false);
  const [showBunny,    setShowBunny]    = useState(false);
  const [raging,       setRaging]       = useState(false);

  const [statusIdx, setStatusIdx] = useState(0);
  const [statusVis, setStatusVis] = useState(true);
  const [rageIdx,   setRageIdx]   = useState(0);
  const [rageVis,   setRageVis]   = useState(true);
  const [barPct,    setBarPct]    = useState(0);

  const rafRef  = useRef<number>(0);
  const barStart = useRef<number>(0);

  // Main timeline
  useEffect(() => {
    const timelineTimers: ReturnType<typeof setTimeout>[] = [];
    const addTimeline = (timer: ReturnType<typeof setTimeout>) => {
      timelineTimers.push(timer);
    };

    addTimeline(setTimeout(() => setShowHeadline(true), T_HEADLINE));
    addTimeline(setTimeout(() => setShowSubtitle(true), T_SUBTITLE));
    addTimeline(setTimeout(() => {
      setShowBar(true);
      barStart.current = performance.now();
      const tick = () => {
        const elapsed = performance.now() - barStart.current;
        const pct = lerpPct(elapsed);
        setBarPct(pct);
        if (pct < 73) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    }, T_BAR));
    addTimeline(setTimeout(() => setShowPrinter(true), T_PRINTER));
    addTimeline(setTimeout(() => setShowText(true),    T_TEXT));
    addTimeline(setTimeout(() => setShowBunny(true),   T_BUNNY));
    addTimeline(setTimeout(() => setRaging(true),      T_RAGE));
    return () => {
      timelineTimers.forEach(clearTimeout);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Status messages
  useEffect(() => {
    if (!showText) return;
    const statusTimers: ReturnType<typeof setTimeout>[] = [];
    const iv = setInterval(() => {
      setStatusVis(false);
      statusTimers.push(setTimeout(() => { setStatusIdx(i => (i + 1) % STATUS_MESSAGES.length); setStatusVis(true); }, 500));
    }, 5_000);
    return () => {
      statusTimers.forEach(clearTimeout);
      clearInterval(iv);
    };
  }, [showText]);

  // Rage messages
  useEffect(() => {
    if (!raging) return;
    const rageTimers: ReturnType<typeof setTimeout>[] = [];
    rageTimers.push(setTimeout(() => {
      setRageIdx(Math.floor(Math.random() * RAGE_MESSAGES.length));
    }, 0));
    const iv = setInterval(() => {
      setRageVis(false);
      rageTimers.push(setTimeout(() => { setRageIdx(i => (i + 1) % RAGE_MESSAGES.length); setRageVis(true); }, 500));
    }, 5_500);
    return () => {
      rageTimers.forEach(clearTimeout);
      clearInterval(iv);
    };
  }, [raging]);

  const fadeStyle = (show: boolean, delay = "0s"): React.CSSProperties => ({
    opacity: show ? 1 : 0,
    transform: show ? "translateY(0)" : "translateY(10px)",
    transition: `opacity 1.8s ease ${delay}, transform 1.8s ease ${delay}`,
  });
  const headline =
    variantCount > 1
      ? `Deine ${variantCount} Designvorschläge werden vorbereitet…`
      : "Dein Shirt wird magisch herbeigerufen…";

  return (
    <div className="flex flex-col items-center justify-center min-h-[520px] px-4 select-none">
      <style>{`
        @keyframes barfill {
          0%  {width:0%}   6%  {width:10%}  18% {width:24%}
          32% {width:38%}  48% {width:52%}  62% {width:62%}
          76% {width:69%}  88% {width:73%}  100%{width:73%}
        }
        @keyframes msgIn  { from{opacity:0;transform:translateY(6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes msgOut { from{opacity:1} to{opacity:0;transform:translateY(-5px)} }

        @keyframes wobble {
          0%,100%{transform:rotate(-1.5deg) translateY(0)}
          25%{transform:rotate(1.5deg) translateY(-1.5px)}
          50%{transform:rotate(-1deg) translateY(1px)}
          75%{transform:rotate(1deg) translateY(-1px)}
        }
        @keyframes puff {
          0%{opacity:0;transform:translate(0,0) scale(0.4)}
          25%{opacity:0.45}
          100%{opacity:0;transform:translate(var(--dx),-38px) scale(1.5)}
        }
        @keyframes sweat {
          0%,45%{opacity:0;transform:translateY(0)}
          55%{opacity:0.85}
          100%{opacity:0;transform:translateY(16px)}
        }
        @keyframes paperout {
          0%,35%{transform:translateY(0)} 65%{transform:translateY(8px)}
          82%{transform:translateY(5px)} 100%{transform:translateY(8px)}
        }
        @keyframes blink {
          0%,90%,100%{transform:scaleY(1)} 95%{transform:scaleY(0.08)}
        }
        @keyframes spark {
          0%{opacity:0;transform:translate(0,0) scale(0)}
          40%{opacity:1;transform:translate(var(--sx),var(--sy)) scale(1)}
          100%{opacity:0;transform:translate(calc(var(--sx)*2),calc(var(--sy)*2)) scale(0.3)}
        }
        @keyframes bunnySlide { from{transform:translateX(240px)} to{transform:translateX(0)} }
        @keyframes idleSway { 0%,100%{transform:rotate(0deg)} 30%{transform:rotate(-0.8deg)} 70%{transform:rotate(0.6deg)} }
        @keyframes footTap  { 0%,45%,100%{transform:translateY(0)} 55%,90%{transform:translateY(-6px)} }
        @keyframes browTwitch { 0%,80%,100%{transform:translateY(0)} 85%,95%{transform:translateY(-2px)} }
        @keyframes fistShake {
          0%,100%{transform:translateY(0) rotate(0deg)}
          22%{transform:translateY(-16px) rotate(-7deg)}
          45%{transform:translateY(-9px) rotate(5deg)}
          68%{transform:translateY(-18px) rotate(-4deg)}
          85%{transform:translateY(-7px) rotate(3deg)}
        }
        @keyframes rageBounce {
          0%,100%{transform:translateY(0) rotate(0deg)}
          35%{transform:translateY(-4px) rotate(-1.5deg)}
          70%{transform:translateY(-2px) rotate(1deg)}
        }
        @keyframes steam {
          0%{opacity:0;transform:translateY(0) scaleX(1)} 20%{opacity:0.75}
          100%{opacity:0;transform:translateY(-20px) scaleX(1.6)}
        }
        @keyframes veinPulse  { 0%,100%{opacity:0.15} 50%{opacity:1} }
        @keyframes headSpark  {
          0%,100%{opacity:0;transform:translate(0,0) scale(0)}
          50%{opacity:1;transform:translate(var(--hx),var(--hy)) scale(1)}
        }
        @keyframes panelPop {
          0%{opacity:0;transform:scale(0.88) translateY(-8px)}
          65%{transform:scale(1.03)} 100%{opacity:1;transform:scale(1)}
        }
        @keyframes comicIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }

        .bar-fill-anim { animation: barfill 43s cubic-bezier(.4,0,.3,1) forwards; }
        .msg-in  { animation: msgIn  0.7s ease-out forwards; }
        .msg-out { animation: msgOut 0.6s ease-in  forwards; }
        .printer-wobble { animation: wobble 0.7s ease-in-out infinite; }
        .puff-1 { animation: puff 2.8s ease-out infinite;      --dx:-16px; }
        .puff-2 { animation: puff 2.8s ease-out infinite 0.8s; --dx:5px;   }
        .puff-3 { animation: puff 2.8s ease-out infinite 1.6s; --dx:19px;  }
        .sweat-1 { animation: sweat 3s ease-in infinite 0.5s; }
        .sweat-2 { animation: sweat 3s ease-in infinite 1.6s; }
        .paper-roll { animation: paperout 1.4s ease-in-out infinite; }
        .eye-blink  { animation: blink 4s ease-in-out infinite; transform-origin: center 57px; }
        .spark-1 { animation: spark 1.8s ease-out infinite;      --sx:-12px; --sy:-9px;  }
        .spark-2 { animation: spark 1.8s ease-out infinite 0.5s; --sx:12px;  --sy:-11px; }
        .spark-3 { animation: spark 1.8s ease-out infinite 1s;   --sx:-3px;  --sy:-15px; }
        .bunny-slide { animation: bunnySlide 0.75s cubic-bezier(.15,1.3,.4,1) forwards; }
        .idle-sway   { animation: idleSway  1.4s ease-in-out infinite; }
        .foot-tap    { animation: footTap   0.7s  ease-in-out infinite; transform-origin: center top; }
        .foot-stomp  { animation: footTap   0.32s ease-in-out infinite; transform-origin: center top; }
        .brow-twitch { animation: browTwitch 3s ease-in-out infinite; }
        .fist-shake  { animation: fistShake  0.8s ease-in-out infinite; transform-origin: 26px 96px; }
        .rage-bounce { animation: rageBounce 0.8s ease-in-out infinite; }
        .steam-l { animation: steam 1.6s ease-out infinite; }
        .steam-r { animation: steam 1.6s ease-out infinite 0.55s; }
        .vein-pulse { animation: veinPulse 0.65s ease-in-out infinite; }
        .hs1 { animation: headSpark 0.9s ease-in-out infinite;       --hx:-11px; --hy:-8px;  }
        .hs2 { animation: headSpark 0.9s ease-in-out infinite 0.3s;  --hx:13px;  --hy:-9px;  }
        .hs3 { animation: headSpark 0.9s ease-in-out infinite 0.6s;  --hx:5px;   --hy:-13px; }
        .panel-pop { animation: panelPop 0.55s cubic-bezier(.2,1.2,.4,1) forwards; }
        .comic-in  { animation: comicIn  0.7s ease-out forwards; }
      `}</style>

      {/* Headline */}
      <h2 className="text-xl font-medium text-center mb-1 text-gray-900 dark:text-gray-100" style={fadeStyle(showHeadline)}>
        {headline}
      </h2>

      {/* Subtitle */}
      <p className="text-sm text-gray-500 dark:text-gray-400 text-center mb-8" style={fadeStyle(showSubtitle, "0.2s")}>
        Hinter den Kulissen schuftet gerade eine sehr engagierte KI für dich
      </p>

      {/* Rage panel */}
      {raging && (
        <div className="panel-pop relative text-center mb-5" style={{ width: 320, minHeight: 52, background: "#FFF9E6", border: "2.5px solid #FF8C00", borderRadius: 14, padding: "10px 16px" }}>
          <div style={{ position: "absolute", bottom: -12, right: 52, width: 0, height: 0, borderLeft: "10px solid transparent", borderRight: "10px solid transparent", borderTop: "12px solid #FF8C00" }} />
          <div style={{ position: "absolute", bottom: -9,  right: 55, width: 0, height: 0, borderLeft: "7px solid transparent",  borderRight: "7px solid transparent",  borderTop: "9px solid #FFF9E6" }} />
          <span
            key={rageIdx}
            className={`block text-sm font-medium leading-snug ${rageVis ? "comic-in" : ""}`}
            style={{ color: "#8B3A00", opacity: rageVis ? 1 : 0, transition: rageVis ? undefined : "opacity 0.5s ease, transform 0.5s ease", transform: rageVis ? undefined : "translateY(-4px)" }}
          >
            {RAGE_MESSAGES[rageIdx]}
          </span>
        </div>
      )}

      {/* Scene */}
      <div className="relative mb-6" style={{ width: 320, height: 210, overflow: "hidden" }}>

        {/* Smoke */}
        {showPrinter && (
          <>
            <div className="puff-1 absolute rounded-full bg-gray-400/60" style={{ left: 64, top: 12, width: 18, height: 18, opacity: 0 }} />
            <div className="puff-2 absolute rounded-full bg-gray-300/55" style={{ left: 72, top: 8,  width: 14, height: 14, opacity: 0 }} />
            <div className="puff-3 absolute rounded-full bg-gray-300/50" style={{ left: 79, top: 14, width: 11, height: 11, opacity: 0 }} />
          </>
        )}

        {/* ── PRINTER ── */}
        <div className="absolute" style={{ left: 8, top: 16, opacity: showPrinter ? 1 : 0, transition: "opacity 2s ease" }}>
          <svg className="printer-wobble" width="148" height="148" viewBox="0 0 148 148" fill="none" aria-hidden="true">
            <rect x="17" y="47" width="114" height="62" rx="11" fill="#4A90D9" stroke="#2C6FAC" strokeWidth="2.5"/>
            <rect x="17" y="51" width="114" height="14" fill="#5BA0E8" opacity="0.6"/>
            <rect x="34" y="27" width="80" height="24" rx="6" fill="#EAEAEA" stroke="#C0C0C0" strokeWidth="2"/>
            <rect x="34" y="27" width="80" height="9"  rx="6" fill="#F5F5F5"/>
            <g className="paper-roll">
              <rect x="52" y="91" width="44" height="30" rx="3" fill="white" stroke="#DDD" strokeWidth="1.5"/>
              <line x1="59" y1="99"  x2="89" y2="99"  stroke="#FF6B6B" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="59" y1="105" x2="85" y2="105" stroke="#4ECDC4" strokeWidth="1.5" strokeLinecap="round"/>
              <line x1="59" y1="111" x2="87" y2="111" stroke="#FFE66D" strokeWidth="1.5" strokeLinecap="round"/>
            </g>
            <rect x="25" y="62" width="9" height="9" rx="2" fill="#FF6B6B"/>
            <rect x="38" y="62" width="9" height="9" rx="2" fill="#FFE66D"/>
            <rect x="51" y="62" width="9" height="9" rx="2" fill="#4ECDC4"/>
            <rect x="102" y="60" width="18" height="13" rx="4" fill="#2C6FAC"/>
            <g className="eye-blink">
              <circle cx="80" cy="57" r="5.5" fill="white" stroke="#2C6FAC" strokeWidth="1.5"/>
              <circle cx="81.2" cy="56.8" r="2.4" fill="#111"/>
              <circle cx="82"   cy="55.5" r="0.9" fill="white"/>
            </g>
            <g className="eye-blink">
              <circle cx="98"   cy="57"   r="5.5" fill="white" stroke="#2C6FAC" strokeWidth="1.5"/>
              <circle cx="99.2" cy="56.8" r="2.4" fill="#111"/>
              <circle cx="100"  cy="55.5" r="0.9" fill="white"/>
            </g>
            <path d="M85 67 Q90 72 95 67" stroke="#FF8C42" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
            <g className="sweat-1"><ellipse cx="112" cy="52" rx="4"   ry="5.5" fill="#74C0FC" opacity="0.9"/><ellipse cx="112" cy="48" rx="2.8" ry="2.8" fill="#74C0FC" opacity="0.9"/></g>
            <g className="sweat-2"><ellipse cx="121" cy="60" rx="3.2" ry="4.2" fill="#74C0FC" opacity="0.8"/><ellipse cx="121" cy="57" rx="2"   ry="2"   fill="#74C0FC" opacity="0.8"/></g>
            <g className="spark-1" transform="translate(89,51)"><line x1="0" y1="0" x2="-4" y2="-6" stroke="#FFD700" strokeWidth="2.2" strokeLinecap="round"/></g>
            <g className="spark-2" transform="translate(89,51)"><line x1="0" y1="0" x2="4"  y2="-6" stroke="#FF6B35" strokeWidth="2.2" strokeLinecap="round"/></g>
            <g className="spark-3" transform="translate(89,51)"><line x1="0" y1="0" x2="-2" y2="-8" stroke="#FFD700" strokeWidth="1.8" strokeLinecap="round"/></g>
            <circle cx="31"  cy="107" r="5.5" fill="#1a3a5c"/>
            <circle cx="117" cy="107" r="5.5" fill="#1a3a5c"/>
          </svg>
        </div>

        {/* ── BUNNY ── */}
        {showBunny && (
          <div className="bunny-slide absolute" style={{ right: 0, top: 0 }}>
            <svg
              className={raging ? "rage-bounce" : "idle-sway"}
              width="128" height="205" viewBox="0 0 128 205" fill="none" aria-hidden="true"
            >
              <ellipse cx="40" cy="26" rx="9" ry="24" fill="#F0C0C0" stroke="#D08080" strokeWidth="1.5"/>
              <ellipse cx="40" cy="26" rx="5" ry="18" fill="#FFB0B0" opacity="0.7"/>
              <ellipse cx="72" cy="24" rx="9" ry="24" fill="#F0C0C0" stroke="#D08080" strokeWidth="1.5"/>
              <ellipse cx="72" cy="24" rx="5" ry="18" fill="#FFB0B0" opacity="0.7"/>
              {raging && (
                <>
                  <ellipse className="steam-l" cx="34" cy="8" rx="5" ry="3" fill="#FF6B35" opacity="0"/>
                  <ellipse className="steam-r" cx="78" cy="6" rx="5" ry="3" fill="#FF6B35" opacity="0"/>
                </>
              )}
              <circle cx="56" cy="64" r="27" fill="#F5E6D3" stroke="#C9956B" strokeWidth="2"/>
              {raging && (
                <>
                  <g className="hs1" transform="translate(56,64)"><line x1="0" y1="0" x2="-5" y2="-5" stroke="#FF3333" strokeWidth="2" strokeLinecap="round"/></g>
                  <g className="hs2" transform="translate(56,64)"><line x1="0" y1="0" x2="5"  y2="-5" stroke="#FF3333" strokeWidth="2" strokeLinecap="round"/></g>
                  <g className="hs3" transform="translate(56,64)"><line x1="0" y1="0" x2="2"  y2="-7" stroke="#FFAA00" strokeWidth="2" strokeLinecap="round"/></g>
                </>
              )}
              <g className={raging ? "" : "brow-twitch"}>
                <line x1="40" y1="51" x2="53" y2="56" stroke="#8B4513" strokeWidth="2.8" strokeLinecap="round"/>
                <line x1="72" y1="51" x2="59" y2="56" stroke="#8B4513" strokeWidth="2.8" strokeLinecap="round"/>
              </g>
              <path d="M41 60 Q45 57 49 60" fill="#8B4513"/>
              <path d="M61 60 Q65 57 69 60" fill="#8B4513"/>
              <ellipse cx="56" cy="67" rx="3" ry="2" fill="#FF8888"/>
              {raging
                ? <path d="M47 74 Q56 69 65 74" stroke="#8B4513" strokeWidth="2" strokeLinecap="round" fill="none"/>
                : <line x1="47" y1="74" x2="65" y2="74" stroke="#8B4513" strokeWidth="2.2" strokeLinecap="round"/>
              }
              <ellipse cx="42" cy="68" rx="6" ry="3.5" fill="#FF9999" opacity={raging ? 0.4 : 0.22}/>
              <ellipse cx="70" cy="68" rx="6" ry="3.5" fill="#FF9999" opacity={raging ? 0.4 : 0.22}/>
              {raging && (
                <g className="vein-pulse">
                  <path d="M48 48 L51 45 L49 42 L52 39" stroke="#FF3333" strokeWidth="2.2" strokeLinecap="round" fill="none"/>
                </g>
              )}
              <path d="M26 92 Q21 114 20 158 L92 158 Q91 114 86 92 Q70 85 56 88 Q41 85 26 92Z" fill="#2C3E6B" stroke="#1a2540" strokeWidth="1.5"/>
              <path d="M56 88 L43 106 L56 101Z" fill="#F5E6D3"/>
              <path d="M56 88 L69 106 L56 101Z" fill="#F5E6D3"/>
              <path d="M53 98 L56 95 L59 98 L57 121 L56 125 L55 121Z" fill="#E74C3C"/>
              <polygon points="56,125 52,117 60,117" fill="#C0392B"/>
              <rect x="50" y="95" width="12" height="10" rx="1" fill="white"/>
              <circle cx="56" cy="116" r="2" fill="#1a2540"/>
              <circle cx="56" cy="124" r="2" fill="#1a2540"/>
              {raging ? (
                <>
                  <path d="M86 96 Q98 112 96 132" stroke="#2C3E6B" strokeWidth="13" strokeLinecap="round" fill="none"/>
                  <circle cx="96" cy="134" r="8" fill="#F5E6D3" stroke="#C9956B" strokeWidth="1.5"/>
                  <g className="fist-shake" style={{ transformOrigin: "26px 96px" }}>
                    <path d="M26 96 Q16 78 18 60" stroke="#2C3E6B" strokeWidth="14" strokeLinecap="round" fill="none"/>
                    <circle cx="18" cy="57" r="11" fill="#F5E6D3" stroke="#C9956B" strokeWidth="1.8"/>
                    <line x1="9"  y1="53" x2="27" y2="53" stroke="#C9956B" strokeWidth="1.2" strokeLinecap="round"/>
                    <line x1="8"  y1="57" x2="28" y2="57" stroke="#C9956B" strokeWidth="1.2" strokeLinecap="round"/>
                    <path d="M26 50 Q32 46 30 54" stroke="#C9956B" strokeWidth="1.5" strokeLinecap="round" fill="none"/>
                  </g>
                </>
              ) : (
                <>
                  <path d="M86 96 Q78 106 48 112" stroke="#2C3E6B" strokeWidth="13" strokeLinecap="round" fill="none"/>
                  <circle cx="45" cy="113" r="8" fill="#F5E6D3" stroke="#C9956B" strokeWidth="1.5"/>
                  <path d="M26 96 Q34 108 64 112" stroke="#2C3E6B" strokeWidth="13" strokeLinecap="round" fill="none"/>
                  <circle cx="67" cy="113" r="8" fill="#F5E6D3" stroke="#C9956B" strokeWidth="1.5"/>
                </>
              )}
              <rect x="36" y="156" width="18" height="24" rx="5" fill="#2C3E6B" stroke="#1a2540" strokeWidth="1.5"/>
              <rect x="31" y="174" width="26" height="10" rx="4" fill="#1a1a2e"/>
              <g className={raging ? "foot-stomp" : "foot-tap"}>
                <rect x="60" y="156" width="18" height="24" rx="5" fill="#2C3E6B" stroke="#1a2540" strokeWidth="1.5"/>
                <rect x="57" y="174" width="26" height="10" rx="4" fill="#1a1a2e"/>
              </g>
            </svg>
          </div>
        )}
      </div>

      {/* Status text */}
      <div
        className="flex items-center justify-center mb-5 w-80"
        style={{ height: 30, overflow: "hidden", position: "relative", ...fadeStyle(showText, "0s") }}
      >
        <span
          key={statusIdx}
          className={`text-sm font-medium text-gray-800 dark:text-gray-200 text-center absolute w-full ${statusVis ? "msg-in" : "msg-out"}`}
        >
          {STATUS_MESSAGES[statusIdx]}
        </span>
      </div>

      {/* Progress bar */}
      <div
        className="w-80 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden border border-gray-200 dark:border-gray-700 mb-2"
        style={{ height: 10, opacity: showBar ? 1 : 0, transition: "opacity 1.8s ease" }}
      >
        <div
          className={showBar ? "bar-fill-anim" : ""}
          style={{ height: "100%", background: "linear-gradient(90deg,#4ECDC4,#4A90D9)", borderRadius: 99, width: 0 }}
        />
      </div>

      {/* Live percentage counter */}
      <p
        className="text-xs text-gray-400 dark:text-gray-500 tabular-nums"
        style={{ margin: 0, opacity: showBar ? 1 : 0, transition: "opacity 1.8s ease 0.6s" }}
      >
        {barPct}%
      </p>
    </div>
  );
}
