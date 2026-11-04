"use client";

import { useState } from "react";
import { AppSettings } from "../types";
import { useProviders } from "../hooks/useProviders";
import { useVisionModels } from "../hooks/useVisionModels";
import { ModelPicker } from "./ModelPicker";

const MODEL_ERROR_MESSAGES: Record<string, string> = {
  provider_auth_error: "Chave recusada pelo provedor. Confira se a API key está correta.",
  missing_api_key: "Informe a API key do provedor.",
  unknown_provider: "Provedor não reconhecido pelo servidor.",
  unauthorized: "Token de acesso do servidor inválido ou ausente (campo acima).",
  upstream_timeout: "O provedor demorou demais para responder.",
  upstream_error: "O provedor está indisponível ou respondeu algo inesperado.",
  network_error: "Não foi possível conectar ao servidor. Verifique o endereço da API.",
};

interface SettingsModalProps {
  settings: AppSettings;
  onSave: (newSettings: AppSettings) => void;
  onClose: () => void;
}

export function SettingsModal({ settings, onSave, onClose }: SettingsModalProps) {
  const [formData, setFormData] = useState<AppSettings>(settings);

  // Usa os valores do formulário (ainda não salvos) para testar a chave antes de salvar
  const { providers, failed: providersFailed } = useProviders(formData.apiUrl, formData.apiToken);
  const provider = providers.find((p) => p.id === formData.visionProvider);
  const needsUserKey = provider?.requires_user_key ?? false;
  const { models, isLoading, error, retry } = useVisionModels({
    apiUrl: formData.apiUrl,
    apiToken: formData.apiToken,
    provider,
    apiKey: formData.visionApiKey,
  });

  // Modelo escolhido; se o salvo não está na lista, cai no padrão do provedor ou no primeiro
  const effectiveModel = models.some((m) => m.id === formData.visionModel)
    ? formData.visionModel
    : (models.find((m) => m.id === provider?.default_model)?.id ?? models[0]?.id ?? "");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      visionModel: models.length > 0 ? effectiveModel : formData.visionModel,
    });
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
              Token de Acesso (opcional)
            </label>
            <input
              type="password"
              value={formData.apiToken}
              onChange={(e) => setFormData({ ...formData, apiToken: e.target.value })}
              placeholder="Em branco se o servidor não exigir"
              autoComplete="off"
              className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
            />
            <span className="text-[11px] text-neutral-500 mt-1 block">
              Mesmo valor de API_TOKEN configurado no servidor. Fica salvo apenas neste navegador.
            </span>
          </div>

          <div className="flex flex-col gap-3 p-3 rounded-xl border border-neutral-700/60 bg-neutral-800/40">
            <div>
              <label
                htmlFor="vision-provider"
                className="block text-xs font-semibold text-neutral-400 mb-1"
              >
                Provedor de IA
              </label>
              <select
                id="vision-provider"
                value={formData.visionProvider}
                onChange={(e) =>
                  setFormData({ ...formData, visionProvider: e.target.value, visionModel: "" })
                }
                className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
              >
                {provider === undefined && (
                  <option value={formData.visionProvider}>{formData.visionProvider}</option>
                )}
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              {providersFailed && (
                <span className="text-[11px] text-rose-300 mt-1 block">
                  Não foi possível carregar a lista de provedores do servidor.
                </span>
              )}
            </div>

            {needsUserKey && (
              <>
                <div>
                  <label
                    htmlFor="vision-api-key"
                    className="block text-xs font-semibold text-neutral-400 mb-1"
                  >
                    API key do provedor
                  </label>
                  <input
                    id="vision-api-key"
                    type="password"
                    value={formData.visionApiKey}
                    onChange={(e) => setFormData({ ...formData, visionApiKey: e.target.value })}
                    placeholder="Cole aqui a sua API key"
                    autoComplete="off"
                    className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
                  />
                  <span className="text-[11px] text-neutral-500 mt-1 block">
                    As leituras são cobradas na sua conta do provedor. A chave fica salva
                    apenas neste navegador e é enviada ao servidor a cada leitura.
                  </span>
                </div>

                {formData.visionApiKey !== "" && (
                  <div>
                    <span className="block text-xs font-semibold text-neutral-400 mb-1">
                      Modelo (com suporte a imagem)
                    </span>
                    {isLoading && (
                      <span className="text-[11px] text-amber-300">Carregando modelos...</span>
                    )}
                    {error && (
                      <div role="alert" className="flex flex-col gap-1.5">
                        <span className="text-[11px] text-rose-300">
                          {MODEL_ERROR_MESSAGES[error.code] ?? error.message}
                        </span>
                        <button
                          type="button"
                          onClick={retry}
                          className="self-start px-3 py-1.5 rounded-lg bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 text-xs text-neutral-200"
                        >
                          Tentar novamente
                        </button>
                      </div>
                    )}
                    {!isLoading && !error && (
                      <ModelPicker
                        models={models}
                        selectedId={effectiveModel}
                        onSelect={(id) => setFormData({ ...formData, visionModel: id })}
                      />
                    )}
                  </div>
                )}
              </>
            )}
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
