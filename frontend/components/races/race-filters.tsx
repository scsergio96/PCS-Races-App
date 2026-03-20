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
  const levelValue: string = searchParams.get("level") ?? "1";
  const categoryValue: string = searchParams.get("category") ?? "1";
  const raceClassValue: string = searchParams.get("race_class") ?? "all";
  const monthValue: string = searchParams.get("month") ?? "all";
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
        <div className="grid grid-cols-2 gap-3 mt-2 p-3 bg-[#2b2b1d] border border-[#484831]">
          {/* Anno */}
          <div className="flex flex-col gap-1">
            <span className="tech-label text-[#cac8aa] text-xs">ANNO</span>
            <Select
              value={yearValue}
              onValueChange={(v) => { if (v !== null) setParam("year", v); }}
            >
              <SelectTrigger className="bg-[#1a1a0a] border-[#484831] text-[#f8f8f5] text-sm h-8 w-full">
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
          </div>

          {/* Mese */}
          <div className="flex flex-col gap-1">
            <span className="tech-label text-[#cac8aa] text-xs">MESE</span>
            <Select
              value={monthValue}
              onValueChange={(v) => { if (v !== null) setParam("month", v); }}
            >
              <SelectTrigger className="bg-[#1a1a0a] border-[#484831] text-[#f8f8f5] text-sm h-8 w-full">
                <SelectValue placeholder="Tutti i mesi" />
              </SelectTrigger>
              <SelectContent className="bg-[#202013] border-[#484831]">
                <SelectItem value="all" className="text-[#f8f8f5]">Tutti i mesi</SelectItem>
                <SelectItem value="1" className="text-[#f8f8f5]">Gennaio</SelectItem>
                <SelectItem value="2" className="text-[#f8f8f5]">Febbraio</SelectItem>
                <SelectItem value="3" className="text-[#f8f8f5]">Marzo</SelectItem>
                <SelectItem value="4" className="text-[#f8f8f5]">Aprile</SelectItem>
                <SelectItem value="5" className="text-[#f8f8f5]">Maggio</SelectItem>
                <SelectItem value="6" className="text-[#f8f8f5]">Giugno</SelectItem>
                <SelectItem value="7" className="text-[#f8f8f5]">Luglio</SelectItem>
                <SelectItem value="8" className="text-[#f8f8f5]">Agosto</SelectItem>
                <SelectItem value="9" className="text-[#f8f8f5]">Settembre</SelectItem>
                <SelectItem value="10" className="text-[#f8f8f5]">Ottobre</SelectItem>
                <SelectItem value="11" className="text-[#f8f8f5]">Novembre</SelectItem>
                <SelectItem value="12" className="text-[#f8f8f5]">Dicembre</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Livello */}
          <div className="flex flex-col gap-1">
            <span className="tech-label text-[#cac8aa] text-xs">LIVELLO</span>
            <Select
              value={levelValue}
              onValueChange={(v) => { if (v !== null) setParam("level", v); }}
            >
              <SelectTrigger className="bg-[#1a1a0a] border-[#484831] text-[#f8f8f5] text-sm h-8 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#202013] border-[#484831]">
                <SelectItem value="all" className="text-[#f8f8f5]">Tutti i livelli</SelectItem>
                <SelectItem value="1" className="text-[#f8f8f5]">WorldTour</SelectItem>
                <SelectItem value="2" className="text-[#f8f8f5]">Pro and up</SelectItem>
                <SelectItem value="3" className="text-[#f8f8f5]">Level 1 and up</SelectItem>
                <SelectItem value="4" className="text-[#f8f8f5]">Level 2 and up</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Categoria */}
          <div className="flex flex-col gap-1">
            <span className="tech-label text-[#cac8aa] text-xs">CATEGORIA</span>
            <Select
              value={categoryValue}
              onValueChange={(v) => { if (v !== null) setParam("category", v); }}
            >
              <SelectTrigger className="bg-[#1a1a0a] border-[#484831] text-[#f8f8f5] text-sm h-8 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#202013] border-[#484831]">
                <SelectItem value="all" className="text-[#f8f8f5]">Tutte le categorie</SelectItem>
                <SelectItem value="1" className="text-[#f8f8f5]">ME - Men Elite</SelectItem>
                <SelectItem value="2" className="text-[#f8f8f5]">WE - Women Elite</SelectItem>
                <SelectItem value="3" className="text-[#f8f8f5]">MU - Men U23</SelectItem>
                <SelectItem value="4" className="text-[#f8f8f5]">MJ - Men Juniors</SelectItem>
                <SelectItem value="6" className="text-[#f8f8f5]">WJ - Women Juniors</SelectItem>
                <SelectItem value="7" className="text-[#f8f8f5]">WU - Women U23</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Classe */}
          <div className="flex flex-col gap-1 col-span-2">
            <span className="tech-label text-[#cac8aa] text-xs">CLASSE UCI</span>
            <Select
              value={raceClassValue}
              onValueChange={(v) => { if (v !== null) setParam("race_class", v); }}
            >
              <SelectTrigger className="bg-[#1a1a0a] border-[#484831] text-[#f8f8f5] text-sm h-8 w-full">
                <SelectValue placeholder="Tutte le classi" />
              </SelectTrigger>
              <SelectContent className="bg-[#202013] border-[#484831]">
                <SelectItem value="all" className="text-[#f8f8f5]">Tutte le classi</SelectItem>
                <SelectItem value="1.UWT" className="text-[#f8f8f5]">1.UWT</SelectItem>
                <SelectItem value="1.WWT" className="text-[#f8f8f5]">1.WWT</SelectItem>
                <SelectItem value="1.Pro" className="text-[#f8f8f5]">1.Pro</SelectItem>
                <SelectItem value="1.1" className="text-[#f8f8f5]">1.1</SelectItem>
                <SelectItem value="1.2" className="text-[#f8f8f5]">1.2</SelectItem>
                <SelectItem value="2.UWT" className="text-[#f8f8f5]">2.UWT</SelectItem>
                <SelectItem value="2.WWT" className="text-[#f8f8f5]">2.WWT</SelectItem>
                <SelectItem value="2.Pro" className="text-[#f8f8f5]">2.Pro</SelectItem>
                <SelectItem value="2.1" className="text-[#f8f8f5]">2.1</SelectItem>
                <SelectItem value="2.2" className="text-[#f8f8f5]">2.2</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
    </div>
  );
}
