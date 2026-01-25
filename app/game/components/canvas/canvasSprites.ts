import {
  BULLET_SRC,
  LIMO_SRC,
  LOST_SRC,
  MANHOLE_SRC,
  SIDEWALK_SRC,
  SPRITES,
  SWAT_SRC,
} from "./canvasConstants";

type RefValue<T> = { current: T };

export type SpriteMap = Record<keyof typeof SPRITES, HTMLImageElement | null>;

export const loadSprites = (
  spriteRef: RefValue<SpriteMap>,
  manholeRef: RefValue<HTMLImageElement | null>,
  swatRef: RefValue<HTMLImageElement | null>,
  bulletRef: RefValue<HTMLImageElement | null>,
  lostRef: RefValue<HTMLImageElement | null>,
  sidewalkRef: RefValue<HTMLImageElement | null>,
  limoRef: RefValue<HTMLImageElement | null>,
) => {
  const entries = Object.entries(SPRITES) as Array<[keyof typeof SPRITES, string]>;
  entries.forEach(([key, src]) => {
    const image = new Image();
    image.src = src;
    spriteRef.current[key] = image;
  });

  const manholeImage = new Image();
  manholeImage.src = MANHOLE_SRC;
  manholeRef.current = manholeImage;

  const swatImage = new Image();
  swatImage.src = SWAT_SRC;
  swatRef.current = swatImage;

  const bulletImage = new Image();
  bulletImage.src = BULLET_SRC;
  bulletRef.current = bulletImage;

  const lostImage = new Image();
  lostImage.src = LOST_SRC;
  lostRef.current = lostImage;

  const sidewalkImage = new Image();
  sidewalkImage.src = SIDEWALK_SRC;
  sidewalkRef.current = sidewalkImage;

  const limoImage = new Image();
  limoImage.src = LIMO_SRC;
  limoRef.current = limoImage;
};
