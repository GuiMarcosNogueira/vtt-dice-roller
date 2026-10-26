"use client";

import { useState, useEffect, useCallback } from "react";
import { useCamera } from "./hooks/useCamera";
import { useMotionDetector } from "./hooks/useMotionDetector";
import { ReviewModal } from "./components/ReviewModal";
import { SettingsModal } from "./components/SettingsModal";
import { RecentRolls } from "./components/RecentRolls";
import {
  DieType,
  DetectionState,
  RecognitionResult,
  RollEvent,
  AppSettings,
  DEFAULT_SETTINGS,
} from "./types";

export default function Home() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [showSettings, setShowSettings] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [recognitionResult, setRecognitionResult] = useState<RecognitionResult | null>(null);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [recentRolls, setRecentRolls] = useState<RollEvent[]>([]);
  const [apiStatus, setApiStatus] = useState<"connected" | "disconnected" | "checking">("checking");

  // Carrega configurações salvas
  useEffect(() => {
    try {
      const saved = localStorage.getItem("vtt_dice_settings");
      if (saved) {
        setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(saved) });
      }
    } catch (e) {
      console.warn("Não foi possível carregar configurações do localStorage:", e);
    }
  }, []);

  const saveSettings = (newSettings: AppSettings) => {
    setSettings(newSettings);
    localStorage.setItem("vtt_dice_settings", JSON.stringify(newSettings));
  };

  // Verifica status da API backend
  const checkApiHealth = useCallback(async () => {
    try {
      const res = await fetch(`${settings.apiUrl}/health`, { method: "GET" });
      if (res.ok) {
        setApiStatus("connected");
      } else {
        setApiStatus("disconnected");
      }
    } catch {
      setApiStatus("disconnected");
    }
  }, [settings.apiUrl]);

  useEffect(() => {
    checkApiHealth();
    const interval = setInterval(checkApiHealth, 10000);
    return () => clearInterval(interval);
  }, [checkApiHealth]);

  // Hook da câmera
  const { videoRef, isStreaming, error: cameraError, switchCamera } = useCamera();

  // Envio para a API de reconhecimento
  const handleFrameCaptured = useCallback(
    async (base64Image: string) => {
      setCapturedImage(base64Image);
      setShowReview(true);
      setIsRecognizing(true);
      setRecognitionResult(null);

      try {
        const response = await fetch(`${settings.apiUrl}/api/recognize`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image_base64: base64Image }),
        });

        if (!response.ok) {
          throw new Error(`Erro na API (${response.status})`);
        }

        const data: RecognitionResult = await response.json();
        setRecognitionResult(data);
      } catch (err) {
        console.error("Falha no reconhecimento:", err);
        // Fallback padrão para permitir correção manual mesmo se a API falhar
        setRecognitionResult({
          die_type: "d20",
          value: 1,
          confidence: 0.1,
          raw_explanation: "Não foi possível conectar à IA. Selecione o valor manualmente.",
        });
      } finally {
        setIsRecognizing(false);
      }
    },
    [settings.apiUrl]
  );

  // Hook do detector de movimento
  const {
    detectionState,
    motionLevel,
    triggerManualCapture,
    resetDetector,
  } = useMotionDetector({
    videoRef,
    isStreaming,
    sensitivity: settings.motionSensitivity,
    stabilizeMs: settings.stabilizeMs,
    onFrameCaptured: handleFrameCaptured,
    enabled: !showReview,
  });

  // Confirmação e envio da rolagem para o backend / VTT
  const handleConfirmRoll = async (dieType: DieType, value: number) => {
    setShowReview(false);
    resetDetector();

    const rollPayload: RollEvent = {
      id: `roll_${Date.now()}`,
      die_type: dieType,
      value: value,
      player_name: settings.playerName,
      timestamp: new Date().toISOString(),
      source: "camera_mobile",
    };

    setRecentRolls((prev) => [rollPayload, ...prev.slice(0, 19)]);

    try {
      await fetch(`${settings.apiUrl}/api/rolls`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rollPayload),
      });
    } catch (e) {
      console.error("Erro ao enviar rolagem para o backend:", e);
    }
  };

  const handleCancelRoll = () => {
    setShowReview(false);
    setCapturedImage(null);
    setRecognitionResult(null);
    resetDetector();
  };

  const getStatusBadge = (state: DetectionState) => {
    switch (state) {
      case "ROLLING":
        return { text: "Dado Rolando...", color: "bg-amber-500/20 text-amber-400 border-amber-500/40" };
      case "STABILIZING":
        return { text: "Estabilizando...", color: "bg-blue-500/20 text-blue-400 border-blue-500/40" };
      case "CAPTURING":
        return { text: "Capturando...", color: "bg-purple-500/20 text-purple-400 border-purple-500/40" };
      case "REVIEWING":
        return { text: "Revisando", color: "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" };
      default:
        return { text: "Aguardando Rolagem", color: "bg-neutral-800 text-neutral-300 border-neutral-700" };
    }
  };

  const badge = getStatusBadge(showReview ? "REVIEWING" : detectionState);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-between p-3 sm:p-6 select-none">
      {/* Barra de Topo */}
      <header className="w-full max-w-md flex items-center justify-between py-2 border-b border-neutral-900">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎲</span>
          <div>
            <h1 className="font-extrabold text-sm tracking-tight leading-none text-white">
              VTT DICE ROLLER
            </h1>
            <span className="text-[10px] text-neutral-500">Leitor Óptico IA</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Indicador de Status da API */}
          <div
            title={`API: ${apiStatus}`}
            className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-[11px]"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                apiStatus === "connected"
                  ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                  : apiStatus === "disconnected"
                  ? "bg-rose-500"
                  : "bg-amber-500 animate-pulse"
              }`}
            />
            <span className="text-neutral-400 text-[10px]">
              {apiStatus === "connected" ? "VTT Conectado" : "Offline"}
            </span>
          </div>

          <button
            onClick={() => setShowSettings(true)}
            className="p-2 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-neutral-300"
          >
            ⚙️
          </button>
        </div>
      </header>

      {/* Área Central: Visualizador da Câmera */}
      <div className="w-full max-w-md flex-1 flex flex-col items-center justify-center my-3 relative">
        <div className="relative w-full aspect-[4/3] rounded-3xl overflow-hidden bg-black border border-neutral-800 shadow-2xl flex items-center justify-center">
          {cameraError ? (
            <div className="p-6 text-center flex flex-col items-center gap-2">
              <span className="text-3xl">📷</span>
              <p className="text-xs text-rose-400 max-w-xs">{cameraError}</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                className="w-full h-full object-cover"
                autoPlay
                playsInline
                muted
              />

              {/* Retículo Alvo para a Bandeja de Dados */}
              <div className="absolute inset-8 border-2 border-dashed border-amber-500/30 rounded-2xl pointer-events-none flex items-center justify-center">
                <div className="w-4 h-4 border-t-2 border-l-2 border-amber-400 absolute top-2 left-2" />
                <div className="w-4 h-4 border-t-2 border-r-2 border-amber-400 absolute top-2 right-2" />
                <div className="w-4 h-4 border-b-2 border-l-2 border-amber-400 absolute bottom-2 left-2" />
                <div className="w-4 h-4 border-b-2 border-r-2 border-amber-400 absolute bottom-2 right-2" />
                <span className="text-[10px] text-amber-300/40 font-mono tracking-widest uppercase">
                  Área do Dado
                </span>
              </div>

              {/* Badge de Estado no Topo do Vídeo */}
              <div className="absolute top-3 left-3 right-3 flex justify-between items-center pointer-events-none">
                <span
                  className={`text-xs font-semibold px-2.5 py-1 rounded-full border backdrop-blur-md shadow-md ${badge.color}`}
                >
                  {badge.text}
                </span>

                <button
                  type="button"
                  onClick={switchCamera}
                  className="pointer-events-auto p-1.5 rounded-full bg-black/60 hover:bg-black/80 backdrop-blur-md text-white text-xs border border-white/10"
                  title="Trocar Câmera"
                >
                  🔄
                </button>
              </div>

              {/* Medidor de Movimento */}
              <div className="absolute bottom-3 left-3 right-3 flex items-center gap-2 pointer-events-none">
                <div className="flex-1 bg-black/60 backdrop-blur-md h-2 rounded-full overflow-hidden p-0.5 border border-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-100 ${
                      motionLevel > settings.motionSensitivity
                        ? "bg-amber-500"
                        : "bg-emerald-500"
                    }`}
                    style={{ width: `${motionLevel}%` }}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Histórico Recente */}
        <RecentRolls rolls={recentRolls} />
      </div>

      {/* Controles na Base */}
      <footer className="w-full max-w-md pb-2 flex flex-col gap-2">
        <button
          onClick={triggerManualCapture}
          disabled={!isStreaming || showReview}
          className="w-full py-4 rounded-2xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] disabled:opacity-40 text-neutral-950 font-black text-base shadow-xl shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
        >
          <span>📸</span>
          <span>Capturar Dado Agora</span>
        </button>

        <p className="text-[11px] text-center text-neutral-500">
          A detecção automática dispara ~800ms após o dado parar na bandeja.
        </p>
      </footer>

      {/* Modais */}
      {showReview && (
        <ReviewModal
          imageSrc={capturedImage}
          result={recognitionResult}
          isLoading={isRecognizing}
          onConfirm={handleConfirmRoll}
          onCancel={handleCancelRoll}
          autoSend={settings.autoSend}
          autoSendDelayMs={settings.autoSendDelayMs}
        />
      )}

      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={saveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </main>
  );
}
