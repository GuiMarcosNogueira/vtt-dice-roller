"use client";

import { useState, useEffect, useRef, useCallback } from "react";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  // Cada início/parada invalida os anteriores: o React executa o efeito duas vezes em
  // desenvolvimento e a troca de câmera reinicia o vídeo, e o resultado de uma tentativa
  // superada (inclusive o AbortError do play()) não pode virar erro nem deixar stream aberto.
  const attemptRef = useRef(0);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");

  const startCamera = useCallback(async (facing: "environment" | "user" = facingMode) => {
    const attempt = ++attemptRef.current;
    const isStale = () => attempt !== attemptRef.current;
    setError(null);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Seu navegador não suporta acesso à câmera (getUserMedia).");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      if (isStale()) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", "true");
        await videoRef.current.play();
        if (!isStale()) {
          setIsStreaming(true);
        }
      }
    } catch (err: unknown) {
      if (isStale()) return;
      console.error("Erro ao acessar câmera:", err);
      setIsStreaming(false);
      if (err instanceof Error) {
        if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
          setError("Permissão da câmera foi negada. Por favor, habilite o acesso nas configurações do navegador.");
        } else if (err.name === "NotFoundError" || err.name === "DevicesNotFoundError") {
          setError("Nenhuma câmera encontrada no dispositivo.");
        } else {
          setError(`Erro ao iniciar câmera: ${err.message}`);
        }
      } else {
        setError("Erro desconhecido ao acessar câmera.");
      }
    }
  }, [facingMode]);

  const stopCamera = useCallback(() => {
    attemptRef.current++;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsStreaming(false);
  }, []);

  const switchCamera = useCallback(() => {
    const nextFacing = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  }, [facingMode, startCamera]);

  useEffect(() => {
    startCamera();
    return () => {
      stopCamera();
    };
  }, [startCamera, stopCamera]);

  return {
    videoRef,
    isStreaming,
    error,
    facingMode,
    startCamera,
    stopCamera,
    switchCamera,
  };
}
