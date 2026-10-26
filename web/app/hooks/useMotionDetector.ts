"use client";

import { useState, useRef, useEffect, useCallback, RefObject } from "react";
import { DetectionState } from "../types";

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
  const [detectionState, setDetectionState] = useState<DetectionState>("IDLE");
  const [motionLevel, setMotionLevel] = useState<number>(0);
  
  const prevImageDataRef = useRef<Uint8ClampedArray | null>(null);
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
  }, [captureHighResFrame, onFrameCaptured]);

  // Reset do detector para nova rolagem
  const resetDetector = useCallback(() => {
    prevImageDataRef.current = null;
    stabilizeStartTimeRef.current = null;
    setDetectionState("IDLE");
    setMotionLevel(0);
  }, []);

  useEffect(() => {
    if (!isStreaming || !enabled || detectionState === "CAPTURING" || detectionState === "REVIEWING" || detectionState === "SENDING") {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    if (!lowResCanvasRef.current) {
      lowResCanvasRef.current = document.createElement("canvas");
      lowResCanvasRef.current.width = 160;
      lowResCanvasRef.current.height = 120;
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
          lowResCtx.drawImage(video, 0, 0, 160, 120);
          const currentData = lowResCtx.getImageData(0, 0, 160, 120).data;

          if (prevImageDataRef.current) {
            let totalDiff = 0;
            const prev = prevImageDataRef.current;
            const numPixels = 160 * 120;

            // Compara intensidade de cinza em cada pixel
            for (let i = 0; i < currentData.length; i += 4) {
              const currentGray = (currentData[i] + currentData[i + 1] + currentData[i + 2]) / 3;
              const prevGray = (prev[i] + prev[i + 1] + prev[i + 2]) / 3;
              totalDiff += Math.abs(currentGray - prevGray);
            }

            const avgDiff = totalDiff / numPixels;
            setMotionLevel(Math.min(100, Math.round(avgDiff * 4)));

            // Lógica da máquina de estados
            if (avgDiff > sensitivity) {
              // Movimento significativo detectado (dado rolando)
              setDetectionState("ROLLING");
              stabilizeStartTimeRef.current = null;
            } else if (avgDiff <= sensitivity) {
              setDetectionState((prevState) => {
                if (prevState === "ROLLING" || prevState === "STABILIZING") {
                  const now = Date.now();
                  if (!stabilizeStartTimeRef.current) {
                    stabilizeStartTimeRef.current = now;
                    return "STABILIZING";
                  }

                  // Dado em repouso pelo tempo necessário
                  if (now - stabilizeStartTimeRef.current >= stabilizeMs) {
                    // Aciona captura automática
                    const frame = captureHighResFrame();
                    if (frame && onFrameCaptured) {
                      onFrameCaptured(frame);
                    }
                    return "CAPTURING";
                  }
                  return "STABILIZING";
                }
                return prevState;
              });
            }
          }

          // Armazena cópia do frame anterior
          prevImageDataRef.current = new Uint8ClampedArray(currentData);
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
  }, [isStreaming, enabled, detectionState, sensitivity, stabilizeMs, videoRef, captureHighResFrame, onFrameCaptured]);

  return {
    detectionState,
    setDetectionState,
    motionLevel,
    triggerManualCapture,
    resetDetector,
    captureHighResFrame,
  };
}
