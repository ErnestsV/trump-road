import { useEffect, useRef } from "react";

type BulletState = {
  active: boolean;
  nextToggle: number;
};

type ForcedBullet = {
  roadIndex: number;
  until: number;
};

type RefValue<T> = {
  current: T;
};

type GameCanvasProps = {
  bulletStateRef: RefValue<BulletState[]>;
  crashed: boolean;
  forcedBulletRef: RefValue<ForcedBullet | null>;
  hazards: boolean[];
  multipliers: number[];
  playerRoadIndex: number;
  resetPending: boolean;
  resetStartTime: number | null;
  totalRoads: number;
  walls: boolean[];
};

const COLORS = {
  background: "#1c1f26",
  road: "#5b5b5b",
  sidewalk: "#8b8b8b",
  sidewalkLines: "rgba(255,255,255,0.15)",
  laneLines: "rgba(255,255,255,0.7)",
  token: "#3c3c3c",
  tokenText: "#f1f1f1",
  bullet: "#ff4d4d",
  wallFill: "#f0b54a",
  wallStroke: "#2d2d2d",
  player: "#00e5ff",
  playerCrashed: "#ff4d4d",
};

const getVisibleRoads = (widthPx: number) => {
  if (widthPx < 420) return 2.2;
  if (widthPx < 560) return 2.6;
  if (widthPx < 720) return 3.2;
  if (widthPx < 900) return 4.2;
  return 5.5;
};

const formatMultiplier = (value: number) => `${value.toFixed(2)}x`;

export default function GameCanvas({
  bulletStateRef,
  crashed,
  forcedBulletRef,
  hazards,
  multipliers,
  playerRoadIndex,
  resetPending,
  resetStartTime,
  totalRoads,
  walls,
}: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraOffsetRef = useRef(0);
  const gameStateRef = useRef({
    crashed,
    hazards,
    multipliers,
    playerRoadIndex,
    resetPending,
    resetStartTime,
    walls,
  });

  useEffect(() => {
    gameStateRef.current = {
      crashed,
      hazards,
      multipliers,
      playerRoadIndex,
      resetPending,
      resetStartTime,
      walls,
    };
  }, [
    crashed,
    hazards,
    multipliers,
    playerRoadIndex,
    resetPending,
    resetStartTime,
    walls,
  ]);

  // Toggle bullet visibility per road with randomized on/off windows.
  const updateBulletState = (roadIndex: number, time: number) => {
    const bulletState = bulletStateRef.current[roadIndex];
    if (!bulletState) {
      return false;
    }
    
    while (time >= bulletState.nextToggle) {
      bulletState.active = !bulletState.active;
      const duration = bulletState.active
        ? 120 + Math.random() * 480
        : 220 + Math.random() * 1400;
      bulletState.nextToggle = time + duration;
    }

    return bulletState.active;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId = 0;

    // Core render loop: layout, draw roads/tokens/bullets/walls, then player.
    const render = (time: number) => {
      const rect = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      const width = Math.max(1, Math.floor(rect.width * dpr));
      const height = Math.max(1, Math.floor(rect.height * dpr));

      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      ctx.clearRect(0, 0, width, height);
      ctx.fillStyle = COLORS.background;
      ctx.fillRect(0, 0, width, height);

      // Camera rules: keep player anchored (mobile vs desktop) and animate offsets.
      // Convert to CSS pixels for responsive layout thresholds.
      const screenWidth = width / dpr;
      const playerIndex = gameStateRef.current.playerRoadIndex;
      const visibleRoads = getVisibleRoads(screenWidth);
      const isMobile = screenWidth < 720;
      const scrollActive = isMobile ? playerIndex >= 0 : playerIndex >= 1;
      const hideSidewalk =
        playerIndex >= 2 && !gameStateRef.current.resetPending;
      const sidewalkWidth = hideSidewalk
        ? 0
        : Math.max(90 * dpr, Math.min(width * 0.22, 220 * dpr));
      const roadWidth = (width - sidewalkWidth) / visibleRoads;
      const anchorIndex = isMobile ? 0 : 1;
      const resetReady =
        gameStateRef.current.resetPending &&
        gameStateRef.current.resetStartTime !== null &&
        time - gameStateRef.current.resetStartTime >= 2000;
      // Offset target jumps per move; smoothing gives a slider-like scroll.
      const targetOffset =
        resetReady || playerIndex < 0
          ? 0
          : scrollActive
            ? Math.max(0, playerIndex - anchorIndex)
            : 0;
      cameraOffsetRef.current +=
        (targetOffset - cameraOffsetRef.current) * 0.12;
      const playerOffset = cameraOffsetRef.current;
      const baseX = sidewalkWidth - roadWidth * playerOffset;
      const sidewalkX = baseX - sidewalkWidth;

      ctx.fillStyle = COLORS.road;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = COLORS.laneLines;
      ctx.lineWidth = 2 * dpr;
      ctx.setLineDash([18 * dpr, 18 * dpr]);
      for (let i = 1; i <= totalRoads; i += 1) {
        const x = baseX + roadWidth * i;
        if (x < 0 || x > width) continue;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      const tokenY = height * 0.4;
      const bulletTravel = height * 0.6;

      // Draw token, bullet (if active), and optional wall per road.
      for (let roadIndex = 0; roadIndex < totalRoads; roadIndex += 1) {
        const centerX = baseX + roadWidth * (roadIndex + 0.5);
        const tokenRadius = Math.min(34 * dpr, roadWidth * 0.32);
        if (centerX + tokenRadius < 0 || centerX - tokenRadius > width) {
          continue;
        }

        ctx.fillStyle = COLORS.token;
        ctx.beginPath();
        ctx.arc(centerX, tokenY, tokenRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = COLORS.tokenText;
        ctx.font = `${14 * dpr}px Trebuchet MS, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const tokenValue = gameStateRef.current.multipliers[roadIndex];
        ctx.fillText(formatMultiplier(tokenValue), centerX, tokenY);

        // Force a bullet flash on loss so the visual matches the outcome.
        const forcedBullet = forcedBulletRef.current;
        const forcedActive =
          forcedBullet &&
          forcedBullet.roadIndex === roadIndex &&
          time <= forcedBullet.until;
        if (forcedBullet && time > forcedBullet.until) {
          forcedBulletRef.current = null;
        }

        const hazardActive = gameStateRef.current.hazards[roadIndex]
          ? updateBulletState(roadIndex, time)
          : false;
        if (forcedActive || hazardActive) {
          const phase = ((time / 420 + roadIndex * 0.63) % 1) as number;
          const bulletY = height * 0.18 + phase * bulletTravel;
          ctx.fillStyle = COLORS.bullet;
          ctx.fillRect(centerX - 4 * dpr, bulletY, 8 * dpr, 18 * dpr);
        }

        if (gameStateRef.current.walls[roadIndex]) {
          const wallX = baseX + roadWidth * roadIndex + roadWidth * 0.12;
          const wallY = height * 0.68;
          const wallWidth = roadWidth * 0.76;
          const wallHeight = 20 * dpr;
          ctx.fillStyle = COLORS.wallFill;
          ctx.fillRect(wallX, wallY, wallWidth, wallHeight);
          ctx.strokeStyle = COLORS.wallStroke;
          ctx.lineWidth = 2 * dpr;
          ctx.strokeRect(wallX, wallY, wallWidth, wallHeight);
        }
      }

      // Sidewalk is drawn last to stay visually on top of road elements.
      if (
        sidewalkWidth > 0 &&
        sidewalkX < width &&
        sidewalkX + sidewalkWidth > 0
      ) {
        ctx.fillStyle = COLORS.sidewalk;
        ctx.fillRect(sidewalkX, 0, sidewalkWidth, height);
        ctx.strokeStyle = COLORS.sidewalkLines;
        ctx.lineWidth = 1 * dpr;
        for (let y = 0; y < height; y += 42 * dpr) {
          ctx.beginPath();
          ctx.moveTo(sidewalkX, y);
          ctx.lineTo(sidewalkX + sidewalkWidth, y);
          ctx.stroke();
        }
      }

      // Player marker stays near the lower third of the viewport.
      const playerY = height * 0.78;
      const playerRadius = 14 * dpr;
      let playerX = sidewalkWidth * 0.5;
      if (playerIndex >= 0) {
        playerX = baseX + roadWidth * (playerIndex + 0.5);
      }

      ctx.fillStyle = gameStateRef.current.crashed
        ? COLORS.playerCrashed
        : COLORS.player;
      ctx.beginPath();
      ctx.arc(playerX, playerY, playerRadius, 0, Math.PI * 2);
      ctx.fill();

      animationId = window.requestAnimationFrame(render);
    };

    animationId = window.requestAnimationFrame(render);
    return () => window.cancelAnimationFrame(animationId);
  }, [bulletStateRef, forcedBulletRef, totalRoads]);

  return <canvas ref={canvasRef} className="gameCanvas" />;
}
