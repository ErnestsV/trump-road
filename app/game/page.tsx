"use client";

import { useEffect, useRef, useState } from "react";
import "./game.css";
import BottomPanel from "./components/BottomPanel";
import GameCanvas from "./components/GameCanvas";
import GameHeader from "./components/GameHeader";

type DifficultyKey = "easy" | "medium" | "hard" | "hardcore";

const TOTAL_ROADS = 18;
const PLAY_ROADS = TOTAL_ROADS - 1;
const BET_OPTIONS = [1.5, 2.5, 7, 15];
const MIN_BET = 0.01;
const MAX_BET = 150;

const DIFFICULTY_PRESETS: Record<
  DifficultyKey,
  { multipliers: number[]; collisionChance: number }
> = {
  easy: {
    multipliers: [1.03, 1.06, 1.1, 1.15, 1.19, 1.24, 1.3],
    collisionChance: 0.13,
  },
  medium: {
    multipliers: [1.12, 1.2, 1.35, 1.5, 1.7, 1.9],
    collisionChance: 0.28,
  },
  hard: {
    multipliers: [1.35, 1.6, 2.1, 2.75, 3.4],
    collisionChance: 0.4,
  },
  hardcore: {
    multipliers: [1.63, 2.8, 4.95, 9.08],
    collisionChance: 0.55,
  },
};

const formatMoney = (value: number) => value.toFixed(2);

const pickRandom = (values: number[]) =>
  values[Math.floor(Math.random() * values.length)];

// Defines the payout growth curve per difficulty.
const MULTIPLIER_CURVES: Record<
  DifficultyKey,
  { start: number; end: number; curve: number; jitter: number }
> = {
  easy: { start: 1.03, end: 19, curve: 1.35, jitter: 0.05 },
  medium: { start: 1.1, end: 28, curve: 1.45, jitter: 0.06 },
  hard: { start: 1.2, end: 40, curve: 1.55, jitter: 0.07 },
  hardcore: { start: 1.44, end: 60, curve: 1.7, jitter: 0.08 },
};

// Builds an increasing multiplier list for each road, with slight jitter.
const buildMultipliers = (difficulty: DifficultyKey) => {
  const { start, end, curve, jitter } = MULTIPLIER_CURVES[difficulty];
  const values: number[] = [];

  for (let i = 0; i < PLAY_ROADS; i += 1) {
    const t = i / (PLAY_ROADS - 1);
    const curved = Math.pow(t, curve);
    const baseValue = start + (end - start) * curved;
    const noise = (Math.random() * 2 - 1) * jitter;
    const value = Math.max(start, baseValue + noise);

    values.push(Number(value.toFixed(2)));
  }

  for (let i = 1; i < values.length; i += 1) {
    values[i] = Math.max(values[i], Number((values[i - 1] + 0.01).toFixed(2)));
  }

  return values;
};

// Picks roads that can shoot (visual bullets and forced loss events).
const buildHazards = (difficulty: DifficultyKey) =>
  Array.from(
    { length: PLAY_ROADS },
    () => Math.random() < DIFFICULTY_PRESETS[difficulty].collisionChance,
  );

export default function GamePage() {
  // Core gameplay state.
  const [difficulty, setDifficulty] = useState<DifficultyKey>("easy");
  const [multipliers, setMultipliers] = useState<number[]>(
    () => buildMultipliers("easy"),
  );
  const [hazards, setHazards] = useState<boolean[]>(() =>
    buildHazards("easy"),
  );
  const [walls, setWalls] = useState<boolean[]>(
    () => Array(PLAY_ROADS).fill(false),
  );
  const [playerRoadIndex, setPlayerRoadIndex] = useState(-1);
  // Player balance and bet configuration.
  const [balance, setBalance] = useState(1000);
  const [selectedBet, setSelectedBet] = useState(BET_OPTIONS[0]);
  const [betInput, setBetInput] = useState(`${BET_OPTIONS[0]}`);
  // Round lifecycle state.
  const [roundActive, setRoundActive] = useState(false);
  const [activeBet, setActiveBet] = useState(0);
  const [currentPayout, setCurrentPayout] = useState(0);
  const [crashed, setCrashed] = useState(false);
  const [resetPending, setResetPending] = useState(false);
  const [resetStartTime, setResetStartTime] = useState<number | null>(null);
  const [wonRound, setWonRound] = useState(false);
  const [winMultiplier, setWinMultiplier] = useState(0);
  const [winProfit, setWinProfit] = useState(0);
  const winTimeoutRef = useRef<number | null>(null);
  const [difficultyOpen, setDifficultyOpen] = useState(true);
  const resetTimeoutRef = useRef<number | null>(null);

  const difficultyData = DIFFICULTY_PRESETS[difficulty];
  const statusMessage = crashed
    ? "Shot down. Resetting the run."
    : wonRound
      ? `You won with x${winMultiplier.toFixed(2)}.`
      : playerRoadIndex >= 0
        ? `Moved to road ${playerRoadIndex + 1}.`
        : "Ready to play.";
  // Resets round state; optionally re-rolls multipliers and hazards.
  const resetRound = (seedNewRoads: boolean) => {
    setPlayerRoadIndex(-1);
    setWalls(Array(PLAY_ROADS).fill(false));
    setRoundActive(false);
    setActiveBet(0);
    setCurrentPayout(0);
    setCrashed(false);
    setResetPending(false);
    setResetStartTime(null);
    setWonRound(false);
    setWinMultiplier(0);
    setWinProfit(0);

    forcedBulletRef.current = null;
    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }

    if (winTimeoutRef.current !== null) {
      window.clearTimeout(winTimeoutRef.current);
      winTimeoutRef.current = null;
    }

    if (seedNewRoads) {
      setMultipliers(buildMultipliers(difficulty));
      setHazards(buildHazards(difficulty));
    }
  };

  const handleDifficultyChange = (next: DifficultyKey) => {
    setDifficulty(next);
  };

  const clampBet = (value: number) =>
    Math.min(MAX_BET, Math.max(MIN_BET, value));

  const syncBetValue = (value: number) => {
    const clamped = clampBet(value);

    setSelectedBet(clamped);
    setBetInput(clamped.toFixed(2));
  };

  const handleBetInputChange = (value: string) => {
    setBetInput(value);

    const parsed = Number(value);
    if (!Number.isNaN(parsed) && Number.isFinite(parsed)) {
      setSelectedBet(clampBet(parsed));
    }
  };

  const handleBetInputBlur = () => {
    const parsed = Number(betInput);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed)) {
      syncBetValue(MIN_BET);
      return;
    }

    syncBetValue(parsed);
  };

  // Loss chance scales with bet size to keep payouts in check.
  const getLossChance = (betAmount: number) => {
    const baseChance = difficultyData.collisionChance;
    const betFactor = betAmount / MAX_BET;
    const adjusted = baseChance * (1 + betFactor * 0.9);

    return Math.min(0.95, adjusted);
  };

  // Advances one road, applying loss roll, wall placement, and payout update.
  const handlePlay = () => {
    // Allow a manual reset if the player clicks during end states.
    if (crashed) {
      resetRound(true);
      return;
    }

    if (wonRound) {
      resetRound(true);
      return;
    }

    // Move one lane forward; the final lane is reserved for the limo.
    const nextIndex = playerRoadIndex + 1;
    if (nextIndex >= TOTAL_ROADS) return;

    const betAmount = roundActive ? activeBet : selectedBet;

    if (!roundActive) {
      // Lock in the bet on the first move of the run.
      if (balance < betAmount) return;

      setBalance((prev) => prev - betAmount);
      setRoundActive(true);
      setActiveBet(betAmount);
    }

    // Decide whether this step is a loss (bullets, crash, delayed reset).
    const lossRoll = Math.random() < getLossChance(betAmount);
    if (lossRoll) {
      const now = performance.now();
      forcedBulletRef.current = { roadIndex: nextIndex, until: now + 900 };
      const bulletState = bulletStateRef.current[nextIndex];

      bulletState.active = true;
      bulletState.nextToggle = now + 600 + Math.random() * 600;

      setCurrentPayout(0);
      setRoundActive(false);
      setActiveBet(0);
      setResetPending(true);
      setResetStartTime(performance.now());
      setPlayerRoadIndex(nextIndex);
      setCrashed(true);

      if (resetTimeoutRef.current !== null) {
        window.clearTimeout(resetTimeoutRef.current);
      }

      resetTimeoutRef.current = window.setTimeout(() => {
        resetRound(true);
      }, 2000);

      return;
    }

    // Successful move: place barrier, update payout, and check for win.
    setPlayerRoadIndex(nextIndex);
    setWalls((prev) => {
      const next = [...prev];
      next[nextIndex] = true;
      return next;
    });

    const nextMultiplier = multipliers[nextIndex];
    const payout = betAmount * nextMultiplier;

    setCurrentPayout(payout);

    if (nextIndex >= PLAY_ROADS - 1) {
      // Winning state triggers overlay and auto reset after a short delay.
      setWinMultiplier(nextMultiplier);
      setWinProfit(payout - betAmount);
      setWonRound(true);
      setRoundActive(false);

      if (winTimeoutRef.current !== null) {
        window.clearTimeout(winTimeoutRef.current);
      }

      winTimeoutRef.current = window.setTimeout(() => {
        resetRound(true);
      }, 2000);
    }
  };

  // Cashes out current payout and resets the run.
  const handleCashOut = () => {
    if (!roundActive || currentPayout <= 0) return;
    setBalance((prev) => prev + currentPayout);
    resetRound(true);
  };

  // Initialize bullet toggling timers for each road.
  const createBulletStates = () =>
    Array.from({ length: PLAY_ROADS }, () => ({
      active: false,
      nextToggle: Infinity,
      startTime: 0,
    }));

  const bulletStateRef = useRef(createBulletStates());
  const forcedBulletRef = useRef<{ roadIndex: number; until: number } | null>(
    null,
  );

  useEffect(() => {
    setMultipliers(buildMultipliers(difficulty));
    setHazards(buildHazards(difficulty));
    setWalls(Array(PLAY_ROADS).fill(false));
    setPlayerRoadIndex(-1);
    setRoundActive(false);
    setActiveBet(0);
    setCurrentPayout(0);
    setCrashed(false);
    setResetPending(false);
    setResetStartTime(null);
    setWonRound(false);
    setWinMultiplier(0);
    setWinProfit(0);

    forcedBulletRef.current = null;
    if (resetTimeoutRef.current !== null) {
      window.clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }

    if (winTimeoutRef.current !== null) {
      window.clearTimeout(winTimeoutRef.current);
      winTimeoutRef.current = null;
    }

    bulletStateRef.current = createBulletStates();
  }, [difficulty]);

  return (
    <main className="gameRoot">
      <div className="srOnly" aria-live="polite">
        {statusMessage}
      </div>
      <GameHeader
        balanceLabel={`${formatMoney(balance)} $`}
        title="Trump Road (Demo)"
      />

      <section className="gameStage">
        <GameCanvas
          bulletStateRef={bulletStateRef}
          crashed={crashed}
          forcedBulletRef={forcedBulletRef}
          hazards={hazards}
          limousineActive={playerRoadIndex >= PLAY_ROADS - 1}
          multipliers={multipliers}
          playerRoadIndex={playerRoadIndex}
          resetPending={resetPending}
          resetStartTime={resetStartTime}
          totalRoads={TOTAL_ROADS}
          showWinOverlay={wonRound}
          winMultiplier={winMultiplier}
          winProfit={winProfit}
          walls={walls}
        />
        {crashed && <div className="crashBanner">Shot down</div>}
      </section>

      <BottomPanel
        betInput={betInput}
        betOptions={BET_OPTIONS}
        cashoutDisabled={!roundActive || currentPayout <= 0}
        cashoutLabel={`Cash out ${formatMoney(currentPayout)} EUR`}
        difficulty={difficulty}
        difficultyOpen={difficultyOpen}
        maxBet={MAX_BET}
        minBet={MIN_BET}
        playLabel={crashed ? "Reset" : roundActive ? "Go" : "Play"}
        roundActive={roundActive}
        selectedBet={selectedBet}
        onBetChipClick={syncBetValue}
        onBetInputBlur={handleBetInputBlur}
        onBetInputChange={handleBetInputChange}
        onCashOut={handleCashOut}
        onDifficultyChange={handleDifficultyChange}
        onMaxClick={() => syncBetValue(MAX_BET)}
        onMinClick={() => syncBetValue(MIN_BET)}
        onPlay={handlePlay}
        onToggleDifficulty={() => setDifficultyOpen((prev) => !prev)}
      />
    </main>
  );
}
