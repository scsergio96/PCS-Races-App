"use client";

import { useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const currentYear = new Date().getFullYear();
const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

export function RaceFilters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "all") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`/races?${params.toString()}`);
  }

  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      <Select
        defaultValue={searchParams.get("year") ?? String(currentYear)}
        onValueChange={(v) => setParam("year", String(v))}
      >
        <SelectTrigger className="shrink-0 bg-zinc-900 border-zinc-700 text-sm h-8 min-w-[90px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-zinc-900 border-zinc-700">
          {years.map((y) => (
            <SelectItem key={y} value={String(y)}>
              {y}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        defaultValue={searchParams.get("level") ?? "all"}
        onValueChange={(v) => setParam("level", String(v))}
      >
        <SelectTrigger className="shrink-0 bg-zinc-900 border-zinc-700 text-sm h-8 min-w-[100px]">
          <SelectValue placeholder="Livello" />
        </SelectTrigger>
        <SelectContent className="bg-zinc-900 border-zinc-700">
          <SelectItem value="all">Tutti i livelli</SelectItem>
          <SelectItem value="1">UCI 1</SelectItem>
          <SelectItem value="2">UCI 2</SelectItem>
          <SelectItem value="3">UCI 3</SelectItem>
          <SelectItem value="4">UCI 4</SelectItem>
        </SelectContent>
      </Select>

      <Select
        defaultValue={searchParams.get("gender") ?? "all"}
        onValueChange={(v) => setParam("gender", String(v))}
      >
        <SelectTrigger className="shrink-0 bg-zinc-900 border-zinc-700 text-sm h-8 min-w-[90px]">
          <SelectValue placeholder="Genere" />
        </SelectTrigger>
        <SelectContent className="bg-zinc-900 border-zinc-700">
          <SelectItem value="all">Tutti</SelectItem>
          <SelectItem value="ME">Elite Uomini</SelectItem>
          <SelectItem value="WE">Elite Donne</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
