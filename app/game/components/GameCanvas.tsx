import { useEffect, useRef } from "react";
import { COLORS, TEXT_STYLE } from "./canvas/canvasConstants";
import { clamp, formatMultiplier, getVisibleRoads } from "./canvas/canvasMath";
import { loadSprites, type SpriteMap } from "./canvas/canvasSprites";

type BulletState = {
  active: boolean;
  nextToggle: number;
  startTime: number;
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
  limousineActive: boolean;
  multipliers: number[];
  playerRoadIndex: number;
  resetPending: boolean;
  resetStartTime: number | null;
  showWinOverlay: boolean;
  winMultiplier: number;
  winProfit: number;
  totalRoads: number;
  walls: boolean[];
};

export default function GameCanvas({
  bulletStateRef,
  crashed,
  forcedBulletRef,
  hazards,
  limousineActive,
  multipliers,
  playerRoadIndex,
  resetPending,
  resetStartTime,
  showWinOverlay,
  winMultiplier,
  winProfit,
  totalRoads,
  walls,
}: GameCanvasProps) {
  // Canvas + animation state kept outside React render to avoid jitter.
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraOffsetRef = useRef(0);
  const lastRoadIndexRef = useRef(playerRoadIndex);
  const lastMoveTimeRef = useRef(0);
  const prevRoadIndexRef = useRef(playerRoadIndex);
  // Sprite and texture cache (images are loaded once).
  const spriteRef = useRef<SpriteMap>({
    hair: null,
    head: null,
    body: null,
    mouth: null,
    eyesOpen: null,
    eyesClosed: null,
    legsIdle: null,
    legsWalk: null,
  });
  // Individual sprite handles.
  const manholeRef = useRef<HTMLImageElement | null>(null);
  const swatRef = useRef<HTMLImageElement | null>(null);
  const bulletRef = useRef<HTMLImageElement | null>(null);
  const lostRef = useRef<HTMLImageElement | null>(null);
  const sidewalkRef = useRef<HTMLImageElement | null>(null);
  const limoRef = useRef<HTMLImageElement | null>(null);
  // Per-road animation timestamps and crash timing.
  const wallSpawnRef = useRef<number[]>([]);
  const limoStartRef = useRef(0);
  const crashStartRef = useRef(0);
  const wasCrashedRef = useRef(false);
  // Snapshot of gameplay state used inside the render loop.
  const gameStateRef = useRef({
    crashed,
    hazards,
    limousineActive,
    multipliers,
    playerRoadIndex,
    resetPending,
    resetStartTime,
    showWinOverlay,
    winMultiplier,
    winProfit,
    walls,
  });

  useEffect(() => {
    // One-time image preload for sprite-based canvas drawing.
    loadSprites(
      spriteRef,
      manholeRef,
      swatRef,
      bulletRef,
      lostRef,
      sidewalkRef,
      limoRef,
    );
  }, []);

  useEffect(() => {
    // Mirror incoming props into a ref so the render loop stays stable.
    gameStateRef.current = {
      crashed,
      hazards,
      limousineActive,
      multipliers,
      playerRoadIndex,
      resetPending,
      resetStartTime,
      showWinOverlay,
      winMultiplier,
      winProfit,
      walls,
    };
  }, [
    crashed,
    hazards,
    limousineActive,
    multipliers,
    playerRoadIndex,
    resetPending,
    resetStartTime,
    showWinOverlay,
    winMultiplier,
    winProfit,
    walls,
  ]);

  // Toggle bullet visibility per road with randomized on/off windows.
  const updateBulletState = (roadIndex: number, time: number) => {
    const bulletState = bulletStateRef.current[roadIndex];
    if (!bulletState) {
      return false;
    }
    if (!bulletState.active) {
      bulletState.active = true;
      bulletState.startTime = time;
    }
    return true;
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
      if (playerIndex < 0) {
        prevRoadIndexRef.current = -1;
        lastRoadIndexRef.current = -1;
        lastMoveTimeRef.current = time;
      }
      
      if (playerIndex !== lastRoadIndexRef.current) {
        prevRoadIndexRef.current = lastRoadIndexRef.current;
        lastRoadIndexRef.current = playerIndex;
        lastMoveTimeRef.current = time;
      }

      const moveDuration = 260;
      const moveProgress = Math.min(
        (time - lastMoveTimeRef.current) / moveDuration,
        1,
      );
      const easeOut = 1 - Math.pow(1 - moveProgress, 2);
      const fromIndex = prevRoadIndexRef.current;
      const renderIndex =
        playerIndex < 0
          ? playerIndex
          : fromIndex + (playerIndex - fromIndex) * easeOut;
      const moving = moveProgress < 1 && playerIndex >= 0;

      const visibleRoads = getVisibleRoads(screenWidth);
      const isMobile = screenWidth < 720;
      const scrollActive = isMobile ? playerIndex >= 0 : playerIndex >= 1;
      const nominalSidewalkWidth = Math.max(
        110 * dpr,
        Math.min(width * 0.26, 260 * dpr),
      );
      const shrinkProgress =
        playerIndex >= 2 && !gameStateRef.current.resetPending
          ? clamp((cameraOffsetRef.current - 1.2) / 0.7, 0, 1)
          : 0;
      const sidewalkWidth = nominalSidewalkWidth * (1 - shrinkProgress);
      const roadWidth = (width - nominalSidewalkWidth) / visibleRoads;
      const characterRoadWidth = roadWidth;
      const anchorIndex = isMobile ? 0 : 1;
      const resetReady =
        gameStateRef.current.resetPending &&
        gameStateRef.current.resetStartTime !== null &&
        time - gameStateRef.current.resetStartTime >= 2000;
      // Offset target jumps per move; smoothing gives a slider-like scroll.
      // Camera scroll target with extra headroom for the right sidewalk.
      const endOffset = Math.max(0, totalRoads - visibleRoads);
      const rightSidewalkWidth = nominalSidewalkWidth;
      const extraOffset = rightSidewalkWidth / roadWidth;
      const extendEnd = endOffset + extraOffset;
      let targetOffset =
        resetReady || playerIndex < 0
          ? 0
          : scrollActive
            ? Math.max(0, renderIndex - anchorIndex)
            : 0;
      const shouldExtend = playerIndex >= totalRoads - 2;
      const maxOffset = shouldExtend ? extendEnd : endOffset;
      if (shouldExtend) {
        targetOffset = Math.min(extendEnd, Math.max(targetOffset, endOffset));
      }
      targetOffset = Math.min(maxOffset, targetOffset);
      cameraOffsetRef.current +=
        (targetOffset - cameraOffsetRef.current) * 0.12;
      const playerOffset = cameraOffsetRef.current;
      const baseX = nominalSidewalkWidth - roadWidth * playerOffset;
      const sidewalkX = baseX - sidewalkWidth;

      // Road background and lane dividers.
      ctx.fillStyle = COLORS.road;
      ctx.fillRect(0, 0, width, height);

      ctx.strokeStyle = COLORS.laneLines;
      ctx.lineWidth = 4 * dpr;
      ctx.setLineDash([40 * dpr, 32 * dpr]);
      for (let i = 1; i < totalRoads; i += 1) {
        const x = baseX + roadWidth * i;
        if (x < 0 || x > width) continue;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      ctx.setLineDash([]);

      const tokenY = height * 0.34;
      const tokenScale = clamp(characterRoadWidth / (260 * dpr), 0.5, 1);
      const tokenBaseRadius =
        Math.min(34 * dpr, characterRoadWidth * 0.32) * tokenScale;
      const bulletTravel = height * 0.6;

      // Limo lane detection and right-side sidewalk visibility.
      const emptyLaneCenterX = baseX + roadWidth * (totalRoads - 0.5);
      const limoInView =
        emptyLaneCenterX + roadWidth * 0.5 > 0 &&
        emptyLaneCenterX - roadWidth * 0.5 < width;
      const showLimo = limoInView || gameStateRef.current.limousineActive;
      const rightSidewalkX = baseX + roadWidth * totalRoads;
      const showRightSidewalk =
        limoInView &&
        rightSidewalkX + rightSidewalkWidth > 0 &&
        rightSidewalkX < width;

      if (showLimo) {
        const limo = limoRef.current;
        if (limo && limo.naturalWidth > 0) {
          const limoWidth = roadWidth * 1.6;
          const limoHeight =
            (limo.naturalHeight / limo.naturalWidth) * limoWidth;
          if (!limoStartRef.current) {
            limoStartRef.current = time;
          }
          
          const t = Math.min((time - limoStartRef.current) / 700, 1);
          const easeOut = 1 - Math.pow(1 - t, 2);
          const startY = -limoHeight;
          const stopY = height * 0.12;
          const limoX = baseX + roadWidth * (totalRoads - 0.5);
          const y = startY + (stopY - startY) * easeOut;

          ctx.drawImage(
            limo,
            limoX - limoWidth / 2,
            y,
            limoWidth,
            limoHeight,
          );
        }
      } else {
        limoStartRef.current = 0;
      }

      // Draw tokens, bullets, and barriers for each road.
      for (let roadIndex = 0; roadIndex < totalRoads; roadIndex += 1) {
        const centerX = baseX + roadWidth * (roadIndex + 0.5);
        const tokenRadius = tokenBaseRadius;
        if (centerX + tokenRadius < 0 || centerX - tokenRadius > width) {
          continue;
        }

        const hasMultiplier =
          roadIndex < gameStateRef.current.multipliers.length;
        const wallActive = hasMultiplier && gameStateRef.current.walls[roadIndex];
        const hazardEnabled = hasMultiplier && gameStateRef.current.hazards[roadIndex];

        if (!wallActive) {
          wallSpawnRef.current[roadIndex] = 0;
        }

        if (hasMultiplier) {
          const manhole = manholeRef.current;
          if (manhole && manhole.naturalWidth > 0) {
            const size = tokenBaseRadius * 10;
            const aspect = manhole.naturalHeight / manhole.naturalWidth;
            const width = size;
            const height = size * aspect;

            ctx.drawImage(
              manhole,
              centerX - width / 2,
              tokenY - height / 2,
              width,
              height,
            );
          } else {
            ctx.fillStyle = COLORS.token;
            ctx.beginPath();
            ctx.arc(centerX, tokenY, tokenRadius, 0, Math.PI * 2);
            ctx.fill();
          }
        }

        if (hasMultiplier && !wallActive) {
          ctx.font = `700 ${32 * dpr * tokenScale}px Trebuchet MS, sans-serif`;
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillStyle = TEXT_STYLE.fill;
          ctx.shadowColor = TEXT_STYLE.shadow;
          ctx.shadowBlur = 2 * dpr * tokenScale;
          ctx.lineWidth = 3 * dpr * tokenScale;
          ctx.strokeStyle = "rgba(50, 58, 90, 0.9)";

          const tokenValue = gameStateRef.current.multipliers[roadIndex];
          const textY = tokenY - 12 * dpr;

          ctx.strokeText(formatMultiplier(tokenValue), centerX, textY);
          ctx.fillText(formatMultiplier(tokenValue), centerX, textY);

          ctx.shadowBlur = 0;
          ctx.shadowColor = "transparent";
        }

        // Force a bullet flash on loss so the visual matches the outcome.
        const forcedBullet = forcedBulletRef.current;
        const forcedActive =
          forcedBullet &&
          forcedBullet.roadIndex === roadIndex &&
          time <= forcedBullet.until;
        if (forcedBullet && time > forcedBullet.until) {
          forcedBulletRef.current = null;
        }

        const hazardActive = hazardEnabled
          ? updateBulletState(roadIndex, time)
          : false;
        if (forcedActive || hazardActive) {
          const bulletState = bulletStateRef.current[roadIndex];
          const startTime = bulletState?.startTime ?? time;
          const phase = Math.min((time - startTime) / 1600, 1);
          if (phase >= 1 && bulletState) {
            bulletState.startTime = time;
          }

          const bulletScale = clamp(characterRoadWidth / (260 * dpr), 0.5, 1);
          const bullet = bulletRef.current;
          if (bullet && bullet.naturalWidth > 0) {
            const bulletWidth = 140 * dpr * bulletScale;
            const bulletHeight =
              (bullet.naturalHeight / bullet.naturalWidth) * bulletWidth;
            const endY = wallActive
              ? tokenY - bulletHeight * 0.7
              : height - bulletHeight;
            const startY = -bulletHeight;
            const bulletY = startY + phase * (endY - startY);

            ctx.save();
            ctx.shadowColor = "rgba(255, 120, 120, 0.6)";
            ctx.shadowBlur = 6 * dpr * bulletScale;
            ctx.drawImage(
              bullet,
              centerX - bulletWidth / 2,
              bulletY,
              bulletWidth,
              bulletHeight,
            );
            ctx.restore();
          } else {
            const endY = wallActive
              ? tokenY - tokenRadius * 1.2
              : height;
            const startY = 0;
            const bulletY = startY + phase * (endY - startY);

            ctx.fillStyle = COLORS.bullet;
            ctx.fillRect(
              centerX - 4 * dpr * bulletScale,
              bulletY,
              8 * dpr * bulletScale,
              18 * dpr * bulletScale,
            );
          }
        }

        if (wallActive) {
          const swat = swatRef.current;
          if (swat && swat.naturalWidth > 0) {
            const swatWidth = characterRoadWidth * 1.5;
            const swatHeight = (swat.naturalHeight / swat.naturalWidth) * swatWidth;
            const targetY = tokenY - tokenRadius * 3.1;
            const spawnTime = wallSpawnRef.current[roadIndex] || time;

            if (!wallSpawnRef.current[roadIndex]) {
              wallSpawnRef.current[roadIndex] = time;
            }

            const dropDuration = 320;
            const t = Math.min((time - spawnTime) / dropDuration, 1);
            const easeOut = 1 - Math.pow(1 - t, 2);
            const startY = -swatHeight;
            const y = startY + (targetY - startY) * easeOut;
            const swatShadowWidth = swatWidth * 0.2;
            const swatShadowHeight = swatShadowWidth * 0.24;

            ctx.fillStyle = "rgba(0,0,0,0.2)";
            ctx.beginPath();
            ctx.ellipse(
              centerX,
              y + swatHeight * 0.8,
              swatShadowWidth,
              swatShadowHeight,
              0,
              0,
              Math.PI * 2,
            );
            ctx.fill();
            ctx.drawImage(
              swat,
              centerX - swatWidth / 2,
              y,
              swatWidth,
              swatHeight,
            );
          }
        }
      }

      // Sidewalk is drawn last to stay visually on top of road elements.
      if (
        sidewalkWidth > 0 &&
        sidewalkX < width &&
        sidewalkX + sidewalkWidth > 0
      ) {
        const sidewalkImage = sidewalkRef.current;
        if (sidewalkImage && sidewalkImage.naturalWidth > 0) {
          ctx.drawImage(sidewalkImage, sidewalkX, 0, sidewalkWidth, height);
        } else {
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
      }

      if (showRightSidewalk) {
        const sidewalkImage = sidewalkRef.current;
        if (sidewalkImage && sidewalkImage.naturalWidth > 0) {
          ctx.save();
          ctx.translate(rightSidewalkX + rightSidewalkWidth, 0);
          ctx.scale(-1, 1);
          ctx.drawImage(sidewalkImage, 0, 0, rightSidewalkWidth, height);
          ctx.restore();
        } else {
          ctx.fillStyle = COLORS.sidewalk;
          ctx.fillRect(rightSidewalkX, 0, rightSidewalkWidth, height);
          ctx.strokeStyle = COLORS.sidewalkLines;
          ctx.lineWidth = 1 * dpr;
          for (let y = 0; y < height; y += 42 * dpr) {
            ctx.beginPath();
            ctx.moveTo(rightSidewalkX, y);
            ctx.lineTo(rightSidewalkX + rightSidewalkWidth, y);
            ctx.stroke();
          }
        }
      }

      // Player marker stays near the lower third of the viewport.
      const playerY = height * 0.86;
      let playerX = sidewalkWidth * 0.67;
      if (playerIndex >= 0) {
        if (fromIndex < 0) {
          const sidewalkX = sidewalkWidth * 0.62;
          const roadX = baseX + roadWidth * 0.5;

          playerX = sidewalkX + (roadX - sidewalkX) * easeOut;
        } else {
          playerX = baseX + roadWidth * (renderIndex + 0.5);
        }
      }

      const blinkPhase = (time / 1000) % 5.2;
      const eyesClosed = blinkPhase < 0.12;
      const mouthOpen = (time / 1000) % 3.6 < 0.4;
      const wobble = Math.sin(time / 700) * 1.2 * dpr;
      const hairSway = Math.sin(time / 500) * 1.6 * dpr;
      const breathe = Math.sin(time / 900) * 0.02 + 1;

      const sprites = spriteRef.current;
      const legs = sprites.legsIdle;
      const body = sprites.body;
      const head = sprites.head;
      const hair = sprites.hair;
      const lostSprite = lostRef.current;
      const spriteAvailable =
        !!legs &&
        legs.naturalWidth > 0 &&
        !!body &&
        body.naturalWidth > 0 &&
        !!head &&
        head.naturalWidth > 0;
      const partHeights = {
        legs: legs?.naturalHeight ?? 0,
        body: body?.naturalHeight ?? 0,
        head: head?.naturalHeight ?? 0,
        hair: hair?.naturalHeight ?? 0,
      };
      const partWidths = [
        legs?.naturalWidth ?? 0,
        body?.naturalWidth ?? 0,
        head?.naturalWidth ?? 0,
        hair?.naturalWidth ?? 0,
      ];
      const totalHeight =
        partHeights.legs + partHeights.body + partHeights.head + partHeights.hair;
      const maxWidth = Math.max(...partWidths, 1);
      const targetWidth = characterRoadWidth * 1.4;
      const targetHeight = characterRoadWidth * 2.4;
      const scale = Math.min(
        targetWidth / maxWidth,
        targetHeight / Math.max(1, totalHeight),
      );
      const spriteWidth = maxWidth * scale;
      const originX = playerX - spriteWidth / 2;
      const legsHeight = partHeights.legs * scale;
      const bodyHeight = partHeights.body * scale;
      const headHeight = partHeights.head * scale;
      const hairHeight = partHeights.hair * scale;
      const legsY = playerY - legsHeight;
      const bodyY = legsY - bodyHeight * 0.35;
      const headY = bodyY - headHeight * 0.4;
      const hairY = headY - hairHeight * 0.32;

      if (!spriteAvailable) {
        const playerRadius = 14 * dpr;

        ctx.fillStyle = gameStateRef.current.crashed
          ? COLORS.playerCrashed
          : COLORS.player;
        ctx.beginPath();
        ctx.arc(playerX, playerY, playerRadius, 0, Math.PI * 2);
        ctx.fill();
        animationId = window.requestAnimationFrame(render);

        return;
      }

      if (gameStateRef.current.crashed) {
        if (!wasCrashedRef.current) {
          crashStartRef.current = time;
          wasCrashedRef.current = true;
        }
      } else {
        wasCrashedRef.current = false;
      }

      const showLostState =
        gameStateRef.current.crashed &&
        lostSprite?.naturalWidth &&
        time - crashStartRef.current >= 300;

      // Soft ground shadow under the character.
      const shadowWidth = characterRoadWidth * 0.26;
      const shadowHeight = shadowWidth * 0.15;

      ctx.fillStyle = "rgba(0,0,0,0.2)";
      ctx.beginPath();
      ctx.ellipse(
        playerX + 5,
        playerY - legsHeight * 0.12,
        shadowWidth,
        shadowHeight,
        0,
        0,
        Math.PI * 2,
      );
      ctx.fill();

      if (showLostState && lostSprite?.naturalWidth) {
        const lostWidth = characterRoadWidth * 1;
        const lostHeight =
          (lostSprite.naturalHeight / lostSprite.naturalWidth) * lostWidth;
        const t = Math.min((time - crashStartRef.current - 100) / 320, 1);
        const easeOut = 1 - Math.pow(1 - t, 2);
        const fallDrop = lostHeight * 0.01 * easeOut;

        ctx.save();
        ctx.drawImage(
          lostSprite,
          playerX - lostWidth / 2,
          playerY - lostHeight * 0.95 + fallDrop,
          lostWidth,
          lostHeight,
        );
        ctx.restore();

        animationId = window.requestAnimationFrame(render);

        return;
      }

      const drawPart = (
        image: HTMLImageElement | null,
        x: number,
        y: number,
        w: number,
        h: number,
      ) => {
        if (image && image.naturalWidth > 0) {
          ctx.drawImage(image, x, y, w, h);
        }
      };

      const legsSprite = moving ? sprites.legsWalk : sprites.legsIdle;
      const legsScale = moving ? 0.67 : 0.82;
      const legsOffsetX = moving ? spriteWidth * 0.08 : 0;
      const legsOffsetY = moving ? legsHeight * 0.05 : 0;

      drawPart(
        legsSprite,
        originX + spriteWidth * 0.08 + legsOffsetX,
        legsY + legsHeight * 0.35 + legsOffsetY,
        spriteWidth * (legsScale + 0.04),
        legsHeight * legsScale,
      );

      ctx.save();
      ctx.translate(playerX, bodyY + bodyHeight);
      ctx.scale(1, breathe);
      ctx.translate(-playerX, -(bodyY + bodyHeight));
      ctx.translate(playerX, bodyY + bodyHeight * 0.2);
      ctx.rotate(wobble / 120);
      ctx.translate(-playerX, -(bodyY + bodyHeight * 0.2));

      drawPart(body, originX, bodyY, spriteWidth, bodyHeight);
      drawPart(head, originX, headY, spriteWidth, headHeight);

      const headX = originX;
      const headW = spriteWidth;
      const eyesSprite = eyesClosed ? sprites.eyesClosed : sprites.eyesOpen;
      if (eyesSprite && eyesSprite.naturalWidth > 0) {
        const eyeW = headW * 0.2;
        const eyeH = (eyesSprite.naturalHeight / eyesSprite.naturalWidth) * eyeW;
        const eyeY = headY + headHeight * 0.34;
        const leftEyeX = headX + headW * 0.38;
        const rightEyeX = headX + headW * 0.52;

        drawPart(eyesSprite, leftEyeX, eyeY, eyeW, eyeH);
        ctx.save();
        ctx.translate(rightEyeX + eyeW, eyeY);
        ctx.scale(-1, 1);
        drawPart(eyesSprite, 0, 0, eyeW, eyeH);
        ctx.restore();
      }
      if (mouthOpen && sprites.mouth) {
        const mouthW = headW * 0.12;
        const mouthH =
          (sprites.mouth.naturalHeight / sprites.mouth.naturalWidth) * mouthW;

        drawPart(
          sprites.mouth,
          headX + headW * 0.53,
          headY + headHeight * 0.53,
          mouthW,
          mouthH,
        );
      }

      drawPart(
        hair,
        originX + spriteWidth * 0.12 + hairSway,
        hairY,
        spriteWidth * 0.78,
        hairHeight,
      );
      ctx.restore();

      // Win overlay floats above the action.
      if (gameStateRef.current.showWinOverlay) {
        const overlayWidth = Math.min(width * 0.5, 360 * dpr);
        const overlayHeight = overlayWidth * 0.55;
        const overlayX = width / 2 - overlayWidth / 2;
        const overlayY = height * 0.18;

        ctx.save();
        ctx.fillStyle = "rgba(20, 26, 44, 0.72)";
        ctx.strokeStyle = "rgba(255,255,255,0.2)";
        ctx.lineWidth = 2 * dpr;
        ctx.fillRect(overlayX, overlayY, overlayWidth, overlayHeight);
        ctx.strokeRect(overlayX, overlayY, overlayWidth, overlayHeight);
        ctx.fillStyle = "#ffffff";
        ctx.font = `700 ${28 * dpr}px Trebuchet MS, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          "You Won!",
          overlayX + overlayWidth / 2,
          overlayY + overlayHeight * 0.28,
        );
        ctx.fillStyle = "#f1c04c";
        ctx.font = `700 ${34 * dpr}px Trebuchet MS, sans-serif`;

        const winMultiplierValue = gameStateRef.current.winMultiplier ?? 0;
        const winProfitValue = gameStateRef.current.winProfit ?? 0;

        ctx.fillText(
          `x${winMultiplierValue.toFixed(2)}`,
          overlayX + overlayWidth / 2,
          overlayY + overlayHeight * 0.56,
        );
        ctx.fillStyle = "#35d06a";
        ctx.font = `700 ${24 * dpr}px Trebuchet MS, sans-serif`;
        ctx.fillText(
          `+ ${winProfitValue.toFixed(2)} $`,
          overlayX + overlayWidth / 2,
          overlayY + overlayHeight * 0.8,
        );
        ctx.restore();
      }

      animationId = window.requestAnimationFrame(render);
    };

    animationId = window.requestAnimationFrame(render);

    return () => window.cancelAnimationFrame(animationId);
  }, [bulletStateRef, forcedBulletRef, totalRoads]);

  return <canvas ref={canvasRef} className="gameCanvas" />;
}
