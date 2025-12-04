// Generador de nombres para bots

const BOT_NAMES = [
  "CurveMaster",
  "TrailBlazer",
  "SpeedDemon",
  "LineRider",
  "PathFinder",
  "VectorVortex",
  "ArcAngel",
  "LoopLegend",
  "DashDragon",
  "SwiftSnake",
  "NeonNinja",
  "PixelPilot",
  "GridGlider",
  "FlowFighter",
  "TraceTitan",
  "BoltBot",
  "ZigZag",
  "WarpWizard",
  "SpinSpecter",
  "DriftDroid",
  "TurboTron",
  "FlashFury",
  "BeamBender",
  "RushRacer",
  "SlashSprint",
  "NitroNexus",
  "BlazeBot",
  "StreakStorm",
  "JetJumper",
  "ZoomZephyr",
];

export function generateBotName(): string {
  const name = BOT_NAMES[Math.floor(Math.random() * BOT_NAMES.length)];
  const number = Math.floor(Math.random() * 1000);
  return `${name}${number}`;
}

