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

export interface RecognitionError {
  code: string;
  message: string;
}

export interface VisionProvider {
  id: string;
  name: string;
  default_model: string;
  requires_user_key: boolean;
}

export interface VisionModel {
  id: string;
  name: string;
}

export const SERVER_PROVIDER_ID = "server";

// Usado quando o backend não responde /api/providers: o padrão do servidor sempre existe
export const SERVER_PROVIDER: VisionProvider = {
  id: SERVER_PROVIDER_ID,
  name: "Padrão do servidor",
  default_model: "",
  requires_user_key: false,
};

export interface AppSettings {
  apiUrl: string;
  apiToken: string;
  visionProvider: string;
  visionApiKey: string;
  visionModel: string;
  playerName: string;
  autoCapture: boolean; // envia à IA sozinho quando o dado para; desligado, só pelo botão
  autoSend: boolean;
  autoSendDelayMs: number;
  motionSensitivity: number; // lower means more sensitive
  stabilizeMs: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  apiUrl: "http://localhost:8000",
  apiToken: "",
  visionProvider: SERVER_PROVIDER_ID,
  visionApiKey: "",
  visionModel: "",
  playerName: "Jogador",
  autoCapture: true,
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
