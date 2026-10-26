"use client";

import { RollEvent } from "../types";

interface RecentRollsProps {
  rolls: RollEvent[];
}

export function RecentRolls({ rolls }: RecentRollsProps) {
  if (rolls.length === 0) return null;

  return (
    <div className="w-full max-w-md flex flex-col gap-2 mt-4 px-2">
      <h3 className="text-xs font-bold text-neutral-400 uppercase tracking-wider">
        Últimas Rolagens
      </h3>
      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-thin">
        {rolls.map((roll) => (
          <div
            key={roll.id}
            className="flex items-center gap-2 bg-neutral-900 border border-neutral-800 px-3 py-2 rounded-xl shrink-0 shadow"
          >
            <span className="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
              {roll.die_type}
            </span>
            <span className="text-base font-extrabold text-white">
              {roll.value}
            </span>
            <span className="text-[10px] text-neutral-400 max-w-[80px] truncate">
              {roll.player_name || "Jogador"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
