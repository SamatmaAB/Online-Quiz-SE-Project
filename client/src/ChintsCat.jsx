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
// Stage 1
