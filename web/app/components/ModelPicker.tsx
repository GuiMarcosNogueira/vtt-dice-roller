"use client";

import { useState } from "react";
import { VisionModel } from "../types";

interface ModelPickerProps {
  models: VisionModel[];
  selectedId: string;
  onSelect: (modelId: string) => void;
}

export function ModelPicker({ models, selectedId, onSelect }: ModelPickerProps) {
  const [query, setQuery] = useState("");

  const needle = query.trim().toLowerCase();
  const visible = needle
    ? models.filter(
        (m) => m.name.toLowerCase().includes(needle) || m.id.toLowerCase().includes(needle)
      )
    : models;

  return (
    <div className="flex flex-col gap-1.5">
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Buscar entre ${models.length} modelos`}
        aria-label="Buscar modelo"
        className="w-full bg-neutral-800 border border-neutral-700 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-amber-500"
      />
      <div
        role="listbox"
        aria-label="Modelos com suporte a imagem"
        className="max-h-40 overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-950/60"
      >
        {visible.length === 0 ? (
          <p className="p-3 text-[11px] text-neutral-500">Nenhum modelo encontrado.</p>
        ) : (
          visible.map((model) => (
            <button
              key={model.id}
              type="button"
              role="option"
              aria-selected={model.id === selectedId}
              onClick={() => onSelect(model.id)}
              className={`w-full text-left px-3 py-2 text-xs border-b border-neutral-800 last:border-b-0 ${
                model.id === selectedId
                  ? "bg-amber-500/20 text-amber-300"
                  : "text-neutral-300 hover:bg-neutral-800"
              }`}
            >
              <span className="block font-medium">{model.name}</span>
              {model.name !== model.id && (
                <span className="block text-[10px] text-neutral-500">{model.id}</span>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}
