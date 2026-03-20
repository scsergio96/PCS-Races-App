"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SlidersHorizontal } from "lucide-react";
import { useState } from "react";

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export function RaceFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all" && key !== "future") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/races?${params.toString()}`);
  }

  const yearValue: string = searchParams.get("year") ?? String(currentYear);
  const levelValue: string = searchParams.get("level") ?? "all";
  const genderValue: string = searchParams.get("gender") ?? "all";
  const futureValue: string = searchParams.get("future") ?? "true";

  return (
    <div>
      {/* Future / All toggle chips */}
      <div className="flex gap-2 mb-2">
        {(["true", "all"] as const).map((val) => (
          <button
            key={val}
            type="button"
            onClick={() => setParam("future", val)}
            className={`tech-label px-3 py-1.5 border transition-colors ${
              futureValue === val
                ? "bg-[#ffff00] text-black border-[#ffff00]"
                : "bg-transparent text-[#cac8aa] border-[#484831] hover:border-[#ffff00]/50"
            }`}
          >
            {val === "true" ? "FUTURE" : "TUTTE"}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-center gap-2 bg-[#ffff00] text-black font-black py-3 tech-label text-sm hover:bg-[#cdcd00] transition-colors"
      >
        <SlidersHorizontal className="w-4 h-4" />
        FILTER RACES
      </button>

      {open && (
        <div className="flex flex-wrap gap-2 mt-2 p-3 bg-[#2b2b1d] border border-[#484831]">
          <Select
            value={yearValue}
            onValueChange={(v) => { if (v !== null) setParam("year", v); }}
          >
            <SelectTrigger className="shrink-0 bg-[#2b2b1d] border-[#484831] text-[#f8f8f5] text-sm h-8 min-w-[90px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-[#202013] border-[#484831]">
              {years.map((y) => (
                <SelectItem key={y} value={String(y)} className="text-[#f8f8f5]">
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={levelValue}
            onValueChange={(v) => { if (v !== null) setParam("level", v); }}
          >
            <SelectTrigger className="shrink-0 bg-[#2b2b1d] border-[#484831] text-[#f8f8f5] text-sm h-8 min-w-[100px]">
              <SelectValue placeholder="Livello" />
            </SelectTrigger>
            <SelectContent className="bg-[#202013] border-[#484831]">
              <SelectItem value="all" className="text-[#f8f8f5]">Tutti i livelli</SelectItem>
              <SelectItem value="1" className="text-[#f8f8f5]">UCI 1</SelectItem>
              <SelectItem value="2" className="text-[#f8f8f5]">UCI 2</SelectItem>
              <SelectItem value="3" className="text-[#f8f8f5]">UCI 3</SelectItem>
              <SelectItem value="4" className="text-[#f8f8f5]">UCI 4</SelectItem>
            </SelectContent>
          </Select>

          <Select
            value={genderValue}
            onValueChange={(v) => { if (v !== null) setParam("gender", v); }}
          >
            <SelectTrigger className="shrink-0 bg-[#2b2b1d] border-[#484831] text-[#f8f8f5] text-sm h-8 min-w-[90px]">
              <SelectValue placeholder="Genere" />
            </SelectTrigger>
            <SelectContent className="bg-[#202013] border-[#484831]">
              <SelectItem value="all" className="text-[#f8f8f5]">Tutti</SelectItem>
              <SelectItem value="ME" className="text-[#f8f8f5]">Elite Uomini</SelectItem>
              <SelectItem value="WE" className="text-[#f8f8f5]">Elite Donne</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}
    </div>
  );
}
