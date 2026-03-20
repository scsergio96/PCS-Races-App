"use client";

import { useState } from "react";
import { RaceCard } from "./race-card";
import type { Race } from "@/types/api";

const PAGE_SIZE = 10;

interface RaceListClientProps {
  races: Race[];
}

export function RaceListClient({ races }: RaceListClientProps) {
  const [displayCount, setDisplayCount] = useState(PAGE_SIZE);
  const visible = races.slice(0, displayCount);
  const hasMore = displayCount < races.length;

  if (races.length === 0) {
    return (
      <div className="text-center py-16 text-[#cac8aa]">
        <p className="tech-label">Nessuna gara trovata.</p>
        <p className="text-xs mt-1 text-[#484831]">
          Prova a cambiare i filtri o controlla che il backend sia avviato.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="divide-y divide-[#484831]">
        {visible.map((race, i) => (
          <RaceCard key={race.raceUrl} race={race} striped={i % 2 === 0} />
        ))}
      </div>

      {hasMore && (
        <div className="p-4">
          <button
            type="button"
            onClick={() => setDisplayCount((c) => c + PAGE_SIZE)}
            className="w-full border border-[#484831] text-[#cac8aa] tech-label py-3 hover:border-[#ffff00] hover:text-[#ffff00] transition-colors"
          >
            LOAD MORE ({races.length - displayCount} remaining)
          </button>
        </div>
      )}
    </>
  );
}
