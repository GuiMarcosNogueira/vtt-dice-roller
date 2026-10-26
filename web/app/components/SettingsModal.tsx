"use client";

import { useState } from "react";
import { AppSettings } from "../types";

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [formData, setFormData] = useState<AppSettings>(settings);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl flex flex-col gap-4 text-white">
        <div className="flex justify-between items-center border-b border-neutral-800 pb-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            ⚙️ Configurações
          </h2>
          <button
            onClick={onClose}
            className="text-neutral-400 hover:text-white p-1 rounded-lg"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-sm">
          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1">
              Endereço da API Backend
            </label>
            <input
              type="text"
              value={formData.apiUrl}
              onChange={(e) => setFormData({ ...formData, apiUrl: e.target.value })}
              placeholder="http://localhost:8000"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
            />
            <span className="text-[11px] text-neutral-500 mt-1 block">
              Dica: No celular, utilize o IP local da sua máquina (ex: http://192.168.1.50:8000).
            </span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1">
              Nome do Jogador no VTT
            </label>
            <input
              type="text"
              value={formData.playerName}
              onChange={(e) => setFormData({ ...formData, playerName: e.target.value })}
              placeholder="Jogador"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
            />
          </div>

          <div className="flex items-center justify-between p-3 bg-neutral-800/60 rounded-xl border border-neutral-700/60">
            <div>
              <span className="block font-medium text-xs text-white">
                Envio Automático
              </span>
              <span className="text-[11px] text-neutral-400">
                Dispara para o VTT após detecção sem clique extra
              </span>
            </div>
            <input
              type="checkbox"
              checked={formData.autoSend}
              onChange={(e) => setFormData({ ...formData, autoSend: e.target.checked })}
              className="w-4 h-4 accent-emerald-500 rounded cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-neutral-400 mb-1">
              Sensibilidade de Movimento ({formData.motionSensitivity})
            </label>
            <input
              type="range"
              min="5"
              max="40"
              value={formData.motionSensitivity}
              onChange={(e) => setFormData({ ...formData, motionSensitivity: Number(e.target.value) })}
              className="w-full accent-amber-500"
            />
            <div className="flex justify-between text-[10px] text-neutral-500">
              <span>Mais sensível</span>
              <span>Menos sensível</span>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 font-medium"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold"
            >
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
