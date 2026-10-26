"use client";

import { useState, useEffect } from "react";
import { DieType, RecognitionResult, DIE_MAX_VALUES } from "../types";

interface ReviewModalProps {
  imageSrc: string | null;
  result: RecognitionResult | null;
  isLoading: boolean;
  onConfirm: (dieType: DieType, value: number) => void;
  onCancel: () => void;
  autoSend?: boolean;
  autoSendDelayMs?: number;
}

export function ReviewModal({
  imageSrc,
  result,
  isLoading,
  onConfirm,
  onCancel,
  autoSend = false,
  autoSendDelayMs = 2500,
}: ReviewModalProps) {
  const [userSelectedDie, setUserSelectedDie] = useState<DieType | null>(null);
  const [userSelectedValue, setUserSelectedValue] = useState<number | null>(null);
  const [countdown, setCountdown] = useState<number>(100);

  const selectedDie = userSelectedDie ?? result?.die_type ?? "d20";
  const selectedValue = userSelectedValue ?? result?.value ?? 20;

  useEffect(() => {
    setUserSelectedDie(null);
    setUserSelectedValue(null);
  }, [result]);

  // Contagem regressiva para auto-send caso habilitado
  useEffect(() => {
    if (!autoSend || isLoading || !result) return;

    const intervalMs = 50;
    const step = (intervalMs / autoSendDelayMs) * 100;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 0) {
          clearInterval(timer);
          onConfirm(selectedDie, selectedValue);
          return 0;
        }
        return Math.max(0, prev - step);
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [autoSend, autoSendDelayMs, isLoading, result, selectedDie, selectedValue, onConfirm]);

  const maxVal = DIE_MAX_VALUES[selectedDie] || 20;
  const numbers = selectedDie === "d100" 
    ? [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]
    : Array.from({ length: maxVal }, (_, i) => i + 1);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-md w-full p-5 shadow-2xl flex flex-col gap-4 text-white">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            🎲 Resultado da Rolagem
          </h2>
          <button
            onClick={onCancel}
            className="text-neutral-400 hover:text-white p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        {/* Snapshot da Câmera */}
        <div className="relative aspect-video rounded-xl overflow-hidden bg-black border border-neutral-800 flex items-center justify-center">
          {imageSrc ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={imageSrc}
              alt="Snapshot do dado"
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="text-neutral-500 text-sm">Sem imagem capturada</div>
          )}

          {isLoading && (
            <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center gap-2">
              <div className="w-8 h-8 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-amber-300">
                Lendo dado com IA...
              </span>
            </div>
          )}
        </div>

        {/* Informações Reconhecidas */}
        {!isLoading && result && (
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between bg-neutral-800/80 p-3 rounded-xl border border-neutral-700">
              <div className="flex flex-col">
                <span className="text-xs text-neutral-400 uppercase font-semibold">
                  Dado Detectado
                </span>
                <span className="text-xl font-black text-amber-400 uppercase">
                  {selectedDie}
                </span>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-xs text-neutral-400 uppercase font-semibold">
                  Valor no Zênite
                </span>
                <span className="text-3xl font-black text-emerald-400">
                  {selectedValue}
                </span>
              </div>
            </div>

            {result.raw_explanation && (
              <p className="text-xs text-neutral-400 italic bg-neutral-950/60 p-2.5 rounded-lg border border-neutral-800/50">
                💡 {result.raw_explanation}
              </p>
            )}

            {/* Ajuste Rápido de Valor */}
            <div>
              <span className="text-xs font-semibold text-neutral-400 block mb-1.5">
                Corrigir número (se necessário):
              </span>
              <div className="flex gap-1.5 overflow-x-auto pb-2 scrollbar-thin">
                {numbers.map((num) => (
                  <button
                    key={num}
                    onClick={() => {
                      setUserSelectedValue(num);
                      setCountdown(100); // Reseta countdown se jogador interagir
                    }}
                    className={`min-w-9 h-9 rounded-lg font-bold text-sm transition-all flex items-center justify-center ${
                      selectedValue === num
                        ? "bg-emerald-500 text-black shadow-lg shadow-emerald-500/30 scale-105"
                        : "bg-neutral-800 text-neutral-300 hover:bg-neutral-700 border border-neutral-700"
                    }`}
                  >
                    {num}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Barra de Progresso Auto-Send */}
        {autoSend && !isLoading && (
          <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-75 ease-linear"
              style={{ width: `${countdown}%` }}
            />
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onCancel}
            className="flex-1 py-3 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-semibold text-sm transition-colors border border-neutral-700"
          >
            Descartar
          </button>
          <button
            onClick={() => onConfirm(selectedDie, selectedValue)}
            disabled={isLoading}
            className="flex-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-sm shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center gap-2"
          >
            <span>Confirmar & Enviar VTT</span>
            <span>➔</span>
          </button>
        </div>
      </div>
    </div>
  );
}
