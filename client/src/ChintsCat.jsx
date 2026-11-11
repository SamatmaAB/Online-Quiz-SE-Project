import { useCallback, useEffect, useRef, useState } from "react";

export const CAT_BREED_KEY = "oqs_cat_breed_v1";

export const CAT_BREEDS = {
  ginger: {
    id: "ginger",
    name: "Ginger Tabby",
    desc: "Warm orange stripes & emerald eyes",
    coat: "#f97316",
    coatDark: "#c2410c",
    belly: "#ffedd5",
    earInner: "#fda4af",
    eye: "#10b981",
    stripes: "#9a3412",
    nose: "#fb7185",
    yarn: "#ec4899",
    closedEye: "#431407"
  },
  tuxedo: {
    id: "tuxedo",
    name: "Midnight Tuxedo",
    desc: "Sleek black coat, white paws & gold eyes",
    coat: "#1e293b",
    coatDark: "#0f172a",
    belly: "#f8fafc",
    earInner: "#f472b6",
    eye: "#f59e0b",
    stripes: "#0f172a",
    nose: "#f472b6",
    yarn: "#ef4444",
    closedEye: "#f8fafc"
  },
  siamese: {
    id: "siamese",
    name: "Royal Siamese",
    desc: "Cream coat, chocolate ears & sapphire eyes",
    coat: "#fef3c7",
    coatDark: "#78350f",
    belly: "#fffbeb",
    earInner: "#d97706",
    eye: "#0284c7",
    stripes: "#451a03",
    nose: "#fb7185",
    yarn: "#8b5cf6",
    closedEye: "#fef3c7"
  },
  calico: {
    id: "calico",
    name: "Lucky Calico",
    desc: "Spotted orange & charcoal patches",
    coat: "#fff7ed",
    coatDark: "#ea580c",
    belly: "#ffffff",
    earInner: "#fda4af",
    eye: "#d97706",
    stripes: "#1e293b",
    nose: "#fb7185",
    yarn: "#10b981",
    closedEye: "#1e293b"
  },
  snow: {
    id: "snow",
    name: "Snow Persian",
    desc: "Fluffy pure white coat & sky-blue eyes",
    coat: "#f1f5f9",
    coatDark: "#cbd5e1",
    belly: "#ffffff",
    earInner: "#f9a8d4",
    eye: "#38bdf8",
    stripes: "#94a3b8",
    nose: "#f472b6",
    yarn: "#f43f5e",
    closedEye: "#1e293b"
  },
  cyber: {
    id: "cyber",
    name: "Neon Cyber-Cat",
    desc: "Glowing indigo coat & electric cyan eyes",
    coat: "#6366f1",
    coatDark: "#4338ca",
    belly: "#e0e7ff",
    earInner: "#c084fc",
    eye: "#22d3ee",
    stripes: "#312e81",
    nose: "#38bdf8",
    yarn: "#facc15",
    closedEye: "#e0e7ff"
  }
};

const SLEEP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes of inactivity -> cat goes through sleep routine

/**
 * Interactive virtual cat ("Chints") with full in-between transition animations:
 *
 * Poses (`pose`):
 * - "sitting": Default alert sitting pose, eyes track mouse cursor, swats when cursor is near
 * - "wool-bonk": When sleeping & wool ball is clicked -> wool ball rolls in and bonks the sleeping cat loaf on the head!
 * - "wool-notice": Cat wakes up startled (!), sees the wool ball, and rolls onto its back
 * - "wool-rollin": When sitting & wool ball is clicked -> wool ball rolls in and cat flops onto its back
 * - "wool-biting": Lying on its back/belly with wool ball on top of its belly, biting it with eyes closed (opens eyes if cursor is near)
 * - "wool-rollaway": Wool ball slips off belly and rolls away, cat sits back up
 * - "slip-off": When playing with wool & Nap is clicked -> wool ball slips off belly first
 * - "stand-up": Cat stands up on all 4 legs and stretches
 * - "spin-360": Cat does a slow 360° circle turn from right to left before lying down
 * - "settle-loaf": Cat lowers down and tucks paws into a cat loaf
 * - "sleeping": Cozy sleeping cat loaf with Zzz and visible closed eyelashes
 * - "wake-stretch": Stretching awake from loaf back to sitting
 */
export default function ChintsCat({
  breed = "ginger",
  size = 88,
  onClick,
  woolTrigger = 0,
  napRequest = false,
  onStatusText,
  badgeText = "",
  interactive = true,
  className = ""
}) {
  const wrapRef = useRef(null);
  const [pose, setPose] = useState("sitting");
  const poseRef = useRef("sitting");

  const updatePose = useCallback((nextPose) => {
    poseRef.current = nextPose;
    setPose(nextPose);
  }, []);

  const [eyeOffset, setEyeOffset] = useState({ x: 0, y: 0 });
  const [nearCursor, setNearCursor] = useState(false);
  const [blinking, setBlinking] = useState(false);

  const lastActivityRef = useRef(Date.now());
  const timersRef = useRef([]);
  const prevWoolTriggerRef = useRef(woolTrigger);
  const prevNapRequestRef = useRef(napRequest);

  const palette = CAT_BREEDS[breed] || CAT_BREEDS.ginger;

  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }, []);

  const schedule = useCallback((fn, delayMs) => {
    const id = window.setTimeout(fn, delayMs);
    timersRef.current.push(id);
    return id;
  }, []);

  // Report current status label to parent (`ChintsChat`) so the stage header matches the exact in-between animation!
  useEffect(() => {
    if (!onStatusText) return;
    const labels = {
      sitting: nearCursor ? "🐾 Batting at your cursor!" : "👀 Watching your cursor!",
      "wool-bonk": "🧶 *Bonk!* Wool ball hit Chints on the head!",
      "wool-notice": "😺 Chints woke up and spotted the wool ball!",
      "wool-rollin": "🧶 Wool ball rolling in — flopping onto belly!",
      "wool-biting": nearCursor ? "👀 Peeking at your cursor while holding the wool!" : "🧶 On its belly biting the wool ball!",
      "wool-rollaway": "🧶 The wool ball rolled away!",
      "slip-off": "🧶 Letting the wool ball slip off…",
      "stand-up": "🐾 Standing up & stretching…",
      "spin-360": "🔄 Circling 360° right-to-left before bed…",
      "settle-loaf": "🍞 Tucking paws into a cozy cat loaf…",
      sleeping: "😴 Loafing & napping (Zzz)…",
      "wake-stretch": "☀️ Yawning & stretching awake…"
    };
    onStatusText(labels[pose] || "👀 Watching your cursor!");
  }, [pose, nearCursor, onStatusText]);

  // Sequence 1: Start playing with the wool ball (with full in-between animation if sleeping or sitting!)
  const runWoolSequence = useCallback(() => {
    clearTimers();
    const current = poseRef.current;
    const wasAsleep = current === "sleeping" || current === "settle-loaf" || current === "spin-360";

    if (wasAsleep) {
      // 1. Wool ball rolls in from the side and bonks the sleeping cat on the head!
      updatePose("wool-bonk");
      // 2. Cat wakes up startled (!), looks at the wool ball on its head/front
      schedule(() => updatePose("wool-notice"), 950);
      // 3. Cat flips onto its back with the wool ball on its belly and bites it!
      schedule(() => updatePose("wool-biting"), 1850);
      // 4. After biting for 3.6s, the wool ball rolls away off its belly
      schedule(() => updatePose("wool-rollaway"), 5450);
      // 5. Return to sitting
      schedule(() => updatePose("sitting"), 6850);
    } else {
      // Sitting -> wool ball rolls in -> cat flops onto its back -> bites wool -> wool rolls away -> sits up
      updatePose("wool-rollin");
      schedule(() => updatePose("wool-biting"), 650);
      schedule(() => updatePose("wool-rollaway"), 4250);
      schedule(() => updatePose("sitting"), 5650);
    }
  }, [clearTimers, schedule, updatePose]);

  // Sequence 2: Go to sleep (with full in-between animation: ball slips off -> stands up -> slow 360 spin right-to-left -> settles into cat loaf!)
  const runSleepSequence = useCallback(() => {
    clearTimers();
    const current = poseRef.current;
    if (current === "sleeping") return;

    const wasPlayingWool = ["wool-bonk", "wool-notice", "wool-rollin", "wool-biting", "wool-rollaway"].includes(current);
    let offset = 0;

    if (wasPlayingWool) {
      // Step 1: Wool ball slips off the belly and rolls away first!
      updatePose("slip-off");
      offset += 950;
    }

    // Step 2: Cat stands up on all four legs
    schedule(() => updatePose("stand-up"), offset);
    offset += 700;

    // Step 3: Cat does its slow 360° circle turn from right to left
    schedule(() => updatePose("spin-360"), offset);
    offset += 1450;

    // Step 4: Cat slowly lowers down into a loaf
    schedule(() => updatePose("settle-loaf"), offset);
    offset += 700;

    // Step 5: Fast asleep as a cat loaf (Zzz)
    schedule(() => updatePose("sleeping"), offset);
  }, [clearTimers, schedule, updatePose]);

  // Sequence 3: Wake up from sleeping loaf -> stretch -> sit
  const runWakeSequence = useCallback(() => {
    clearTimers();
    if (poseRef.current === "sitting") return;
    updatePose("wake-stretch");
    schedule(() => updatePose("sitting"), 650);
  }, [clearTimers, schedule, updatePose]);

  // Handle parent `woolTrigger` button clicks
  useEffect(() => {
    if (woolTrigger !== prevWoolTriggerRef.current) {
      prevWoolTriggerRef.current = woolTrigger;
      if (woolTrigger > 0) runWoolSequence();
    }
  }, [woolTrigger, runWoolSequence]);

  // Handle parent `napRequest` toggle clicks
  useEffect(() => {
    if (napRequest !== prevNapRequestRef.current) {
      prevNapRequestRef.current = napRequest;
      if (napRequest) {
        runSleepSequence();
      } else if (["sleeping", "settle-loaf", "spin-360", "stand-up", "slip-off"].includes(poseRef.current)) {
        runWakeSequence();
      }
    }
  }, [napRequest, runSleepSequence, runWakeSequence]);

  // Clean up timers on unmount
  useEffect(() => clearTimers, [clearTimers]);

  // Periodic automatic wool play every ~32 seconds when sitting idle
  useEffect(() => {
    if (!interactive) return undefined;
    const id = window.setInterval(() => {
      if (poseRef.current === "sitting" && !napRequest) {
        runWoolSequence();
      }
    }, 32000);
    return () => window.clearInterval(id);
  }, [interactive, napRequest, runWoolSequence]);

  // Track mouse cursor position for eye tracking, proximity detection, and 5-minute sleep timer
  useEffect(() => {
    if (!interactive) return undefined;

    const onMouseMove = (event) => {
      lastActivityRef.current = Date.now();
      // If the cat fell asleep from 5-min idle (not manual nap button), waking up uses the wake stretch!
      if (!napRequest && poseRef.current === "sleeping") {
        runWakeSequence();
      }

      const el = wrapRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = event.clientX - cx;
      const dy = event.clientY - cy;
      const dist = Math.hypot(dx, dy);

      const angle = Math.atan2(dy, dx);
      const maxShift = Math.min(4.5, dist / 28);
      setEyeOffset({
        x: Number((Math.cos(angle) * maxShift).toFixed(2)),
        y: Number((Math.sin(angle) * maxShift).toFixed(2))
      });

      setNearCursor(dist < 125);
    };

    const onAnyActivity = () => {
      lastActivityRef.current = Date.now();
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("keydown", onAnyActivity, { passive: true });
    window.addEventListener("mousedown", onAnyActivity, { passive: true });

    const sleepChecker = window.setInterval(() => {
      if (Date.now() - lastActivityRef.current >= SLEEP_TIMEOUT_MS && poseRef.current === "sitting") {
        runSleepSequence();
      }
    }, 5000);

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("keydown", onAnyActivity);
      window.removeEventListener("mousedown", onAnyActivity);
      window.clearInterval(sleepChecker);
    };
  }, [interactive, napRequest, runSleepSequence, runWakeSequence]);

  // Natural occasional blink when sitting
  useEffect(() => {
    if (pose !== "sitting") return undefined;
    const id = window.setInterval(() => {
      setBlinking(true);
      window.setTimeout(() => setBlinking(false), 160);
    }, 4200);
    return () => window.clearInterval(id);
  }, [pose]);

  const isLoafPose = ["sleeping", "settle-loaf", "wool-bonk", "wool-notice"].includes(pose);
  const isBellyPose = ["wool-biting", "wool-rollaway", "slip-off"].includes(pose);
  const isStandingPose = ["stand-up", "spin-360", "wake-stretch"].includes(pose);

  // While biting the wool ball, eyes stay happily closed UNLESS the cursor comes near Chints!
  const eyesClosedInWool = pose === "wool-biting" && !nearCursor;

  const stateClass = [
    "chints-cat-wrap",
    `pose-${pose}`,
    nearCursor && pose === "sitting" ? "cat-play-cursor" : "",
    className
  ].filter(Boolean).join(" ");

  return (
    <div
      ref={wrapRef}
      className={stateClass}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") onClick(e); } : undefined}
      style={{ width: size, height: size }}
      title="Chints the Cat — Move cursor close or click to interact!"
    >
      {/* Floating Zzz only when fully asleep */}
      {pose === "sleeping" && (
        <div className="cat-zzz" aria-hidden="true">
          <span>z</span><span>Z</span><span>Z</span>
        </div>
      )}

      {/* Startled '!' when the wool ball bonks the sleeping cat on the head! */}
      {(pose === "wool-bonk" || pose === "wool-notice") && (
        <div className="cat-bonk-pop" aria-hidden="true">!</div>
      )}

      {/* Playful paw indicator when swatting at cursor in sitting mode */}
      {nearCursor && pose === "sitting" && (
        <div className="cat-cursor-pop" aria-hidden="true">🐾</div>
      )}

      <svg
        viewBox="0 0 130 120"
        width={size}
        height={size}
        className="chints-cat-svg"
        aria-label={`Chints the ${palette.name} cat`}
      >
        {/* ───────── GROUP A: LOAF POSES (Sleeping, Settling, Wool-Bonk on Head, Waking Notice) ───────── */}
        {isLoafPose && (
          <g className={`cat-loaf-group ${pose}`}>
            <ellipse cx="66" cy="105" rx="48" ry="7" fill="rgba(0,0,0,0.28)" />

            {/* Curled tail tucked around the back of the loaf */}
            <path
              d="M 104 92 Q 122 86 114 74 Q 108 68 98 76"
              fill="none"
              stroke={palette.coatDark}
              strokeWidth="8"
              strokeLinecap="round"
            />

            {/* Main Loaf Body */}
            <path
              d="M 24 96 C 22 68, 52 60, 82 62 C 106 64, 114 78, 110 96 C 108 103, 26 103, 24 96 Z"
              fill={palette.coat}
              stroke={palette.coatDark}
              strokeWidth="1.5"
            />

            {breed === "calico" && (
              <>
                <circle cx="76" cy="76" r="10" fill={palette.coatDark} />
                <circle cx="94" cy="84" r="8" fill={palette.stripes} />
              </>
            )}
            {(breed === "ginger" || breed === "cyber") && (
              <g stroke={palette.stripes} strokeWidth="3" strokeLinecap="round" opacity="0.65">
                <path d="M 72 63 Q 74 75 70 84" fill="none" />
                <path d="M 84 64 Q 86 76 82 85" fill="none" />
                <path d="M 95 67 Q 97 77 93 86" fill="none" />
              </g>
            )}

            {/* Tucked front loaf chest */}
            <ellipse cx="44" cy="94" rx="16" ry="9" fill={palette.belly} />

            {/* Resting Loaf Head */}
            <g className={pose === "wool-bonk" ? "cat-head-bonked" : pose === "wool-notice" ? "cat-head-alert" : "cat-loaf-head"}>
              <polygon points="22,68 12,48 34,56" fill={palette.coatDark} stroke={palette.coat} strokeWidth="1.5" strokeLinejoin="round" />
              <polygon points="23,65 16,52 31,57" fill={palette.earInner} />
              <polygon points="62,66 70,46 50,55" fill={palette.coatDark} stroke={palette.coat} strokeWidth="1.5" strokeLinejoin="round" />
              <polygon points="60,63 66,50 52,56" fill={palette.earInner} />

              <ellipse cx="42" cy="76" rx="25" ry="19" fill={palette.coat} />
              {breed === "siamese" && (
                <ellipse cx="42" cy="79" rx="16" ry="12" fill={palette.coatDark} opacity="0.88" />
              )}

              <ellipse cx="24" cy="82" rx="4.5" ry="2.6" fill="#fb7185" opacity="0.55" />
              <ellipse cx="60" cy="82" rx="4.5" ry="2.6" fill="#fb7185" opacity="0.55" />

              {/* Eyes: Closed when sleeping/settling, wide open looking at the wool ball when bonked/noticing! */}
              {pose === "wool-notice" ? (
                <g>
                  <circle cx="32" cy="74" r="6.5" fill="#ffffff" />
                  <circle cx="52" cy="74" r="6.5" fill="#ffffff" />
                  <circle cx="29.5" cy="75" r="4.6" fill={palette.eye} />
                  <circle cx="49.5" cy="75" r="4.6" fill={palette.eye} />
                  <circle cx="29.5" cy="75" r="2.6" fill="#0f172a" />
                  <circle cx="49.5" cy="75" r="2.6" fill="#0f172a" />
                  <circle cx="28" cy="73.5" r="1.3" fill="#ffffff" />
                  <circle cx="48" cy="73.5" r="1.3" fill="#ffffff" />
                </g>
              ) : (
                <g stroke={palette.closedEye} strokeWidth="2.8" fill="none" strokeLinecap="round">
                  <path d="M 26 74 Q 32 80 38 74" />
                  <line x1="28" y1="77" x2="26" y2="80" strokeWidth="2" />
                  <line x1="32" y1="78" x2="32" y2="81" strokeWidth="2" />
                  <path d="M 46 74 Q 52 80 58 74" />
                  <line x1="52" y1="78" x2="52" y2="81" strokeWidth="2" />
                  <line x1="56" y1="77" x2="58" y2="80" strokeWidth="2" />
                </g>
              )}

              <polygon points="39,81 45,81 42,84" fill={palette.nose} />
              <path
                d="M 37 86 Q 40 88 42 86 Q 44 88 47 86"
                fill="none"
                stroke={palette.closedEye}
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </g>

            {/* Incoming Wool Ball rolling in and bonking the sleeping cat on the head! */}
            {(pose === "wool-bonk" || pose === "wool-notice") && (
              <g className={pose === "wool-bonk" ? "wool-bonk-anim" : "wool-bonk-settled"}>
                <circle cx="38" cy="54" r="11" fill={palette.yarn} stroke="#ffffff" strokeWidth="1.2" />
                <path d="M 30 50 Q 38 45 46 52" stroke="#ffffff" strokeWidth="1.7" fill="none" opacity="0.85" />
                <path d="M 29 56 Q 38 52 47 58" stroke="#ffffff" strokeWidth="1.7" fill="none" opacity="0.85" />
                <path d="M 34 45 Q 41 54 35 63" stroke="#ffffff" strokeWidth="1.7" fill="none" opacity="0.85" />
              </g>
            )}
          </g>
        )}

        {/* ───────── GROUP B: BELLY-UP WOOL BITING & SLIP-OFF POSES ───────── */}
        {isBellyPose && (
          <g className="cat-belly-wool-pose">
            <ellipse cx="66" cy="106" rx="46" ry="7" fill="rgba(0,0,0,0.24)" />

            <path
              className="cat-tail"
              d="M 98 92 Q 122 80 116 58"
              fill="none"
              stroke={palette.coatDark}
              strokeWidth="8"
              strokeLinecap="round"
            />

            {/* Cat lying on its back/side horizontally */}
            <ellipse cx="68" cy="88" rx="34" ry="18" fill={palette.coat} />
            <ellipse cx="68" cy="82" rx="23" ry="12" fill={palette.belly} />

            {/* Back Paws kicking */}
            <g className={pose === "wool-biting" ? "cat-kick-paws" : ""}>
              <ellipse cx="94" cy="76" rx="7" ry="5" fill={palette.belly} stroke={palette.coatDark} strokeWidth="1.5" />
              <ellipse cx="98" cy="86" rx="7" ry="5" fill={palette.belly} stroke={palette.coatDark} strokeWidth="1.5" />
            </g>

            {/* Wool Ball on top of belly (or slipping/rolling off in wool-rollaway / slip-off!) */}
            <g className={pose === "wool-rollaway" || pose === "slip-off" ? "cat-wool-rollaway" : "cat-wool-on-belly"}>
              <circle cx="67" cy="74" r="12" fill={palette.yarn} stroke="#ffffff" strokeWidth="1.2" />
              <path d="M 58 70 Q 67 64 76 72" stroke="#ffffff" strokeWidth="1.8" fill="none" opacity="0.85" />
              <path d="M 57 76 Q 67 71 77 78" stroke="#ffffff" strokeWidth="1.8" fill="none" opacity="0.85" />
              <path d="M 63 64 Q 70 74 64 84" stroke="#ffffff" strokeWidth="1.8" fill="none" opacity="0.85" />
              <path d="M 78 78 Q 88 82 92 75" stroke={palette.yarn} strokeWidth="2.5" fill="none" strokeLinecap="round" />
            </g>

            {/* Front Paw hugging the wool ball */}
            <g className={pose === "wool-biting" ? "cat-hug-paws" : ""}>
              <ellipse cx="54" cy="75" rx="7" ry="5" fill={palette.belly} stroke={palette.coatDark} strokeWidth="1.5" />
            </g>

            {/* Head leaning over the belly trying to bite the wool ball */}
            <g className={pose === "wool-biting" && !nearCursor ? "cat-head-biting" : "cat-head"}>
              <polygon points="18,62 10,38 30,48" fill={palette.coatDark} stroke={palette.coat} strokeWidth="1.5" strokeLinejoin="round" />
              <polygon points="20,59 14,42 28,49" fill={palette.earInner} />
              <polygon points="52,54 58,32 40,44" fill={palette.coatDark} stroke={palette.coat} strokeWidth="1.5" strokeLinejoin="round" />
              <polygon points="50,52 54,36 42,45" fill={palette.earInner} />

              <ellipse cx="38" cy="68" rx="23" ry="19" fill={palette.coat} />
              {breed === "siamese" && (
                <ellipse cx="40" cy="70" rx="15" ry="12" fill={palette.coatDark} opacity="0.85" />
              )}

              {eyesClosedInWool ? (
                <g stroke={palette.closedEye} strokeWidth="2.8" fill="none" strokeLinecap="round">
                  <path d="M 25 63 L 33 67 L 25 71" />
                  <path d="M 51 63 L 43 67 L 51 71" />
                </g>
              ) : (
                <g>
                  <circle cx="30" cy="65" r="6.5" fill="#ffffff" />
                  <circle cx="48" cy="65" r="6.5" fill="#ffffff" />
                  <g style={{ transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)` }}>
                    <circle cx="30" cy="65" r="4.6" fill={palette.eye} />
                    <circle cx="48" cy="65" r="4.6" fill={palette.eye} />
                    <ellipse cx="30" cy="65" rx="2.8" ry="3.6" fill="#0f172a" />
                    <ellipse cx="48" cy="65" rx="2.8" ry="3.6" fill="#0f172a" />
                    <circle cx="28.5" cy="63.5" r="1.3" fill="#ffffff" />
                    <circle cx="46.5" cy="63.5" r="1.3" fill="#ffffff" />
                  </g>
                </g>
              )}

              <polygon points="39,71 44,71 41.5,74" fill={palette.nose} />

              {pose === "wool-biting" ? (
                <g>
                  <ellipse cx="44" cy="78" rx="5.5" ry="4" fill="#fb7185" stroke={palette.closedEye} strokeWidth="1.5" />
                  <polygon points="41,75 43,75 42,78" fill="#ffffff" />
                  <polygon points="45,75 47,75 46,78" fill="#ffffff" />
                </g>
              ) : (
                <path
                  d="M 37 77 Q 40 80 42 77 Q 44 80 47 77"
                  fill="none"
                  stroke={palette.closedEye}
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}
            </g>
          </g>
        )}

        {/* ───────── GROUP C: STANDING UP & SLOW 360° RIGHT-TO-LEFT TURN BEFORE SLEEP ───────── */}
        {isStandingPose && (
          <g className={pose === "spin-360" ? "cat-standing-spin360" : pose === "wake-stretch" ? "cat-standing-stretch" : "cat-standing-rise"}>
            <ellipse cx="65" cy="106" rx="40" ry="6.5" fill="rgba(0,0,0,0.24)" />

            {/* Upright curved tail */}
            <path
              d="M 94 74 Q 116 54 108 34"
              fill="none"
              stroke={palette.coatDark}
              strokeWidth="8"
              strokeLinecap="round"
            />

            {/* 4 Standing Legs with little stepping motion during the 360 spin */}
            <g className="cat-standing-legs">
              <rect x="40" y="82" width="9" height="22" rx="4.5" fill={palette.coatDark} />
              <ellipse cx="44.5" cy="103" rx="6" ry="3.5" fill={palette.belly} />
              <rect x="53" y="84" width="9" height="21" rx="4.5" fill={palette.coat} />
              <ellipse cx="57.5" cy="104" rx="6" ry="3.5" fill={palette.belly} />
              <rect x="74" y="82" width="9" height="22" rx="4.5" fill={palette.coatDark} />
              <ellipse cx="78.5" cy="103" rx="6" ry="3.5" fill={palette.belly} />
              <rect x="85" y="84" width="9" height="21" rx="4.5" fill={palette.coat} />
              <ellipse cx="89.5" cy="104" rx="6" ry="3.5" fill={palette.belly} />
            </g>

            {/* Standing Arched Body */}
            <ellipse cx="68" cy="76" rx="30" ry="16" fill={palette.coat} />
            <ellipse cx="66" cy="80" rx="18" ry="9" fill={palette.belly} />

            {/* Head while standing / turning */}
            <g>
              <polygon points="24,52 16,28 38,38" fill={palette.coatDark} stroke={palette.coat} strokeWidth="1.5" strokeLinejoin="round" />
              <polygon points="26,49 20,33 35,40" fill={palette.earInner} />
              <polygon points="62,50 68,28 48,38" fill={palette.coatDark} stroke={palette.coat} strokeWidth="1.5" strokeLinejoin="round" />
              <polygon points="60,48 64,33 50,40" fill={palette.earInner} />

              <ellipse cx="44" cy="58" rx="24" ry="20" fill={palette.coat} />
              {breed === "siamese" && (
                <ellipse cx="44" cy="60" rx="15" ry="12" fill={palette.coatDark} opacity="0.85" />
              )}

              {/* Sleepy half-closed eyes during pre-bed ritual */}
              <g stroke={palette.closedEye} strokeWidth="2.6" fill="none" strokeLinecap="round">
                <path d="M 30 56 Q 35 60 40 56" />
                <path d="M 48 56 Q 53 60 58 56" />
              </g>
              <polygon points="41,62 47,62 44,65" fill={palette.nose} />
            </g>
          </g>
        )}

        {/* ───────── GROUP D: SITTING POSE (+ WOOL ROLLING IN) ───────── */}
        {(pose === "sitting" || pose === "wool-rollin") && (
          <g className={pose === "wool-rollin" ? "cat-flopping-back" : ""}>
            <ellipse cx="65" cy="108" rx="36" ry="7" fill="rgba(0,0,0,0.22)" />

            <path
              className="cat-tail"
              d="M 91 92 Q 117 82 111 56 Q 108 46 101 52"
              fill="none"
              stroke={palette.coatDark}
              strokeWidth="9"
              strokeLinecap="round"
            />

            <ellipse cx="65" cy="84" rx="28" ry="23" fill={palette.coat} />
            <ellipse cx="65" cy="87" rx="17" ry="15" fill={palette.belly} />

            {breed === "calico" && (
              <>
                <circle cx="47" cy="78" r="9" fill={palette.coatDark} />
                <circle cx="82" cy="82" r="8" fill={palette.stripes} />
              </>
            )}

            <g
              className="cat-head"
              style={{
                transform: `translate(${eyeOffset.x * 0.6}px, ${eyeOffset.y * 0.4}px) rotate(${eyeOffset.x * 1.4}deg)`,
                transformOrigin: "65px 54px"
              }}
            >
              <polygon points="35,42 29,14 53,28" fill={palette.coatDark} stroke={palette.coat} strokeWidth="2" strokeLinejoin="round" />
              <polygon points="37,38 33,20 49,29" fill={palette.earInner} />
              <polygon points="95,42 101,14 77,28" fill={palette.coatDark} stroke={palette.coat} strokeWidth="2" strokeLinejoin="round" />
              <polygon points="93,38 97,20 81,29" fill={palette.earInner} />

              <ellipse cx="65" cy="50" rx="30" ry="25" fill={palette.coat} />
              {breed === "siamese" && (
                <ellipse cx="65" cy="53" rx="19" ry="15" fill={palette.coatDark} opacity="0.85" />
              )}

              {(breed === "ginger" || breed === "cyber") && (
                <g stroke={palette.stripes} strokeWidth="2.6" strokeLinecap="round" opacity="0.75">
                  <line x1="65" y1="28" x2="65" y2="36" />
                  <line x1="58" y1="30" x2="60" y2="37" />
                  <line x1="72" y1="30" x2="70" y2="37" />
                </g>
              )}

              <ellipse cx="43" cy="57" rx="5" ry="3" fill="#fb7185" opacity="0.45" />
              <ellipse cx="87" cy="57" rx="5" ry="3" fill="#fb7185" opacity="0.45" />

              {blinking ? (
                <g stroke={palette.closedEye} strokeWidth="3" fill="none" strokeLinecap="round">
                  <path d="M 46 48 Q 52 54 58 48" />
                  <path d="M 72 48 Q 78 54 84 48" />
                </g>
              ) : (
                <g>
                  <circle cx="52" cy="48" r="7.5" fill="#ffffff" />
                  <circle cx="78" cy="48" r="7.5" fill="#ffffff" />
                  <g style={{ transform: `translate(${eyeOffset.x}px, ${eyeOffset.y}px)` }}>
                    <circle cx="52" cy="48" r="5.2" fill={palette.eye} />
                    <circle cx="78" cy="48" r="5.2" fill={palette.eye} />
                    <ellipse cx="52" cy="48" rx={nearCursor ? "3.2" : "2.3"} ry="4.2" fill="#0f172a" />
                    <ellipse cx="78" cy="48" rx={nearCursor ? "3.2" : "2.3"} ry="4.2" fill="#0f172a" />
                    <circle cx="50" cy="46" r="1.5" fill="#ffffff" />
                    <circle cx="76" cy="46" r="1.5" fill="#ffffff" />
                  </g>
                </g>
              )}

              <polygon points="62,55 68,55 65,59" fill={palette.nose} />
              <path
                d="M 59 62 Q 62 65 65 61 Q 68 65 71 62"
                fill="none"
                stroke={palette.closedEye}
                strokeWidth="2.2"
                strokeLinecap="round"
              />

              <g stroke={palette.closedEye} strokeWidth="1.4" strokeLinecap="round" opacity="0.7">
                <line x1="27" y1="53" x2="40" y2="55" />
                <line x1="26" y1="59" x2="40" y2="59" />
                <line x1="103" y1="53" x2="90" y2="55" />
                <line x1="104" y1="59" x2="90" y2="59" />
              </g>
            </g>

            <g className={nearCursor ? "cat-paw-active" : "cat-paw"}>
              <ellipse cx="49" cy="101" rx="8" ry="6" fill={palette.belly} stroke={palette.coatDark} strokeWidth="1.5" />
              <circle cx="46" cy="100" r="1.4" fill={palette.earInner} />
              <circle cx="49" cy="99" r="1.4" fill={palette.earInner} />
              <circle cx="52" cy="100" r="1.4" fill={palette.earInner} />
            </g>

            <g>
              <ellipse cx="81" cy="101" rx="8" ry="6" fill={palette.belly} stroke={palette.coatDark} strokeWidth="1.5" />
              <circle cx="78" cy="100" r="1.4" fill={palette.earInner} />
              <circle cx="81" cy="99" r="1.4" fill={palette.earInner} />
              <circle cx="84" cy="100" r="1.4" fill={palette.earInner} />
            </g>

            {pose === "wool-rollin" && (
              <g className="wool-rollin-anim">
                <circle cx="28" cy="96" r="11" fill={palette.yarn} stroke="#ffffff" strokeWidth="1.2" />
                <path d="M 20 92 Q 28 87 36 94" stroke="#ffffff" strokeWidth="1.7" fill="none" />
                <path d="M 19 98 Q 28 94 37 100" stroke="#ffffff" strokeWidth="1.7" fill="none" />
              </g>
            )}
          </g>
        )}
      </svg>

      {badgeText && <span className="cat-badge-pill">{badgeText}</span>}
    </div>
  );
}
