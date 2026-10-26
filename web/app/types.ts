export type DieType = "d4" | "d6" | "d8" | "d10" | "d12" | "d20" | "d100";

export type DetectionState =
  | "IDLE"
  | "ROLLING"
  | "STABILIZING"
  | "CAPTURING"
  | "REVIEWING"
  | "SENDING"
  | "ERROR";

export interface RecognitionResult {
  die_type: DieType;
  value: number;
  confidence: number;
  raw_explanation?: string;
}

export interface RollEvent {
  id: string;
  die_type: DieType;
  value: number;
  player_name?: string;
  timestamp?: string;
  source?: string;
}

export interface AppSettings {
  apiUrl: string;
  playerName: string;
  autoSend: boolean;
  autoSendDelayMs: number;
  motionSensitivity: number; // lower means more sensitive
  stabilizeMs: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiUrl: "http://localhost:8000",
  playerName: "Jogador",
  autoSend: false,
  autoSendDelayMs: 2500,
  motionSensitivity: 15,
  stabilizeMs: 800,
};

export const DIE_MAX_VALUES: Record<DieType, number> = {
  d4: 4,
  d6: 6,
  d8: 8,
  d10: 10,
  d12: 12,
  d20: 20,
  d100: 100,
};
