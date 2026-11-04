"use client";

import { useState, useRef, useEffect, useCallback, RefObject } from "react";
import { DetectionState } from "../types";
import {
  FRAME_HEIGHT,
  FRAME_WIDTH,
  GLOBAL_CHANGED_RATIO,
  MIN_CHANGED_RATIO,
  blockMeans,
  changedRatio,
  meanDifference,
} from "../lib/motion";

// Quadros seguidos com movimento local para considerar que um dado está rolando
// (descarta um único quadro "sujo", como um salto de exposição)
const MIN_ROLLING_FRAMES = 2;
// Depois de uma revisão, ignora o movimento por um tempo (a mão saindo da cena)
const COOLDOWN_MS = 1500;

interface UseMotionDetectorProps {
  videoRef: RefObject<HTMLVideoElement | null>;
  isStreaming: boolean;
  sensitivity?: number;
  stabilizeMs?: number;
  onFrameCaptured?: (base64Image: string) => void;
  enabled?: boolean;
}

export function useMotionDetector({
  videoRef,
  isStreaming,
  sensitivity = 15,
  stabilizeMs = 800,
  onFrameCaptured,
  enabled = true,
}: UseMotionDetectorProps) {
  const [detectionState, setDetectionStateValue] = useState<DetectionState>("IDLE");
  const [motionLevel, setMotionLevel] = useState<number>(0);
  // Espelho síncrono do estado: a máquina de estados decide em cima dele, e não dentro de
  // uma função de atualização do React (que pode rodar duas vezes e duplicaria o envio).
  const stateRef = useRef<DetectionState>("IDLE");
  const setDetectionState = useCallback((next: DetectionState) => {
    stateRef.current = next;
    setDetectionStateValue(next);
  }, []);

  const prevBlocksRef = useRef<Float32Array | null>(null);
  // Cena "de referência" parada, sem dado novo. Uma captura só acontece se a cena, depois
  // de assentar, for diferente dela; assim balançar a câmera, ou pegar o dado de volta, não
  // dispara envio.
  const baselineRef = useRef<Float32Array | null>(null);
  const rollingFramesRef = useRef(0);
  const armedAtRef = useRef(0);
  const lowResCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const highResCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const stabilizeStartTimeRef = useRef<number | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastCheckTimeRef = useRef<number>(0);

  // Captura quadro em alta resolução do elemento de vídeo
  const captureHighResFrame = useCallback((): string | null => {
    const video = videoRef.current;
    if (!video || video.readyState < 2) return null;

    if (!highResCanvasRef.current) {
      highResCanvasRef.current = document.createElement("canvas");
    }
    const canvas = highResCanvasRef.current;
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    // Retorna JPEG com qualidade balanceada para rapidez e nitidez
    return canvas.toDataURL("image/jpeg", 0.85);
  }, [videoRef]);

  // Disparo manual
  const triggerManualCapture = useCallback(() => {
    setDetectionState("CAPTURING");
    const frame = captureHighResFrame();
    if (frame && onFrameCaptured) {
      onFrameCaptured(frame);
    }
  }, [captureHighResFrame, onFrameCaptured, setDetectionState]);

  // Reset do detector para nova rolagem. A cena de referência é mantida de propósito:
  // é ela que permite saber que o dado foi recolhido em vez de tratar isso como nova rolagem.
  const resetDetector = useCallback(() => {
    prevBlocksRef.current = null;
    stabilizeStartTimeRef.current = null;
    rollingFramesRef.current = 0;
    armedAtRef.current = Date.now() + COOLDOWN_MS;
    setDetectionState("IDLE");
    setMotionLevel(0);
  }, [setDetectionState]);

  useEffect(() => {
    if (!isStreaming || !enabled || detectionState === "CAPTURING" || detectionState === "REVIEWING" || detectionState === "SENDING") {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    if (!lowResCanvasRef.current) {
      lowResCanvasRef.current = document.createElement("canvas");
      lowResCanvasRef.current.width = FRAME_WIDTH;
      lowResCanvasRef.current.height = FRAME_HEIGHT;
    }

    const lowResCanvas = lowResCanvasRef.current;
    const lowResCtx = lowResCanvas.getContext("2d", { willReadFrequently: true });
    if (!lowResCtx) return;

    const processMotion = (currentTime: number) => {
      // Processa em ~15 a 20 FPS (a cada ~60ms) para poupar bateria no smartphone
      if (currentTime - lastCheckTimeRef.current >= 60) {
        lastCheckTimeRef.current = currentTime;
        const video = videoRef.current;

        if (video && video.readyState >= 2) {
          lowResCtx.drawImage(video, 0, 0, FRAME_WIDTH, FRAME_HEIGHT);
          const blocks = blockMeans(lowResCtx.getImageData(0, 0, FRAME_WIDTH, FRAME_HEIGHT).data);
          const prev = prevBlocksRef.current;

          if (prev) {
            const now = Date.now();
            const ratio = changedRatio(prev, blocks, sensitivity);
            setMotionLevel(Math.min(100, Math.round(meanDifference(prev, blocks) * 4)));

            if (ratio >= GLOBAL_CHANGED_RATIO) {
              // A imagem inteira mudou: câmera balançou ou a luz variou. Não é uma rolagem,
              // então descarta o que estava em andamento e refaz a referência depois.
              baselineRef.current = null;
              stabilizeStartTimeRef.current = null;
              rollingFramesRef.current = 0;
              if (stateRef.current !== "IDLE") setDetectionState("IDLE");
            } else if (ratio >= MIN_CHANGED_RATIO) {
              // Mudança só em parte da cena: algo (um dado) se movendo
              stabilizeStartTimeRef.current = null;
              rollingFramesRef.current += 1;
              if (rollingFramesRef.current >= MIN_ROLLING_FRAMES && now >= armedAtRef.current) {
                setDetectionState("ROLLING");
              }
            } else {
              // Cena parada
              rollingFramesRef.current = 0;
              const state = stateRef.current;

              if (state === "ROLLING" || state === "STABILIZING") {
                if (!stabilizeStartTimeRef.current) {
                  stabilizeStartTimeRef.current = now;
                  setDetectionState("STABILIZING");
                } else if (now - stabilizeStartTimeRef.current >= stabilizeMs) {
                  stabilizeStartTimeRef.current = null;
                  const baseline = baselineRef.current;
                  const sinceBaseline = baseline
                    ? changedRatio(baseline, blocks, sensitivity)
                    : null;

                  if (sinceBaseline === null || sinceBaseline >= GLOBAL_CHANGED_RATIO) {
                    // Sem referência, ou a câmera se mexeu: só refaz a referência
                    baselineRef.current = blocks;
                    setDetectionState("IDLE");
                  } else if (sinceBaseline >= MIN_CHANGED_RATIO) {
                    // A cena assentou diferente da referência: há algo novo para ler.
                    // Marca CAPTURING antes de enviar, para nenhum quadro seguinte repetir.
                    setDetectionState("CAPTURING");
                    const frame = captureHighResFrame();
                    if (frame && onFrameCaptured) {
                      onFrameCaptured(frame);
                    }
                  } else {
                    // Voltou a ser igual à referência (dado recolhido, mão que saiu): nada a ler
                    setDetectionState("IDLE");
                  }
                }
              } else if (
                !baselineRef.current ||
                changedRatio(baselineRef.current, blocks, sensitivity) < MIN_CHANGED_RATIO
              ) {
                // Em repouso: forma a referência e acompanha variações lentas de luz,
                // mas nunca absorve um dado que apareceu na cena
                baselineRef.current = blocks;
              }
            }
          }

          // Armazena os blocos do quadro anterior
          prevBlocksRef.current = blocks;
        }
      }

      animationFrameRef.current = requestAnimationFrame(processMotion);
    };

    animationFrameRef.current = requestAnimationFrame(processMotion);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isStreaming, enabled, detectionState, sensitivity, stabilizeMs, videoRef, captureHighResFrame, onFrameCaptured, setDetectionState]);

  return {
    detectionState,
    setDetectionState,
    motionLevel,
    triggerManualCapture,
    resetDetector,
    captureHighResFrame,
  };
}
