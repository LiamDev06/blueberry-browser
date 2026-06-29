export type Point = {
  x: number;
  y: number;
};

export type RemixState = {
  active: boolean;
};

export type HudPatch = {
  goal?: string;
  remix?: RemixState;
};
