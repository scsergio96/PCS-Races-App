import { Suspense } from "react";
import { RaceListClient } from "@/components/races/race-list-client";
import { RaceFilters } from "@/components/races/race-filters";
import { Skeleton } from "@/components/ui/skeleton";
import type { Race } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchRaces(
  searchParams: Record<string, string | string[] | undefined>
): Promise<Race[]> {
  const yearParam = searchParams.year;
  const year =
    typeof yearParam === "string" ? yearParam : String(new Date().getFullYear());
  const levelParam = searchParams.level;
  const level = typeof levelParam === "string" ? levelParam : "1";
  const categoryParam = searchParams.category;
  const category = typeof categoryParam === "string" ? categoryParam : "1";
  const raceClassParam = searchParams.race_class;
  const raceClass = typeof raceClassParam === "string" ? raceClassParam : undefined;
  const monthParam = searchParams.month;
  const month = typeof monthParam === "string" ? monthParam : undefined;
  const futureParam = searchParams.future;
  const future = typeof futureParam === "string" ? futureParam : "true";

  const query = new URLSearchParams({
    year_from: year,
    year_to: year,
    max_pages_per_year: "3",
  });
  if (level && level !== "all") query.set("race_level", level);
  if (category && category !== "all") query.set("category", category);
  if (raceClass && raceClass !== "all") query.set("race_class", raceClass);
  if (month && month !== "all") query.set("month", month);
  if (future === "true") query.set("only_future", "true");
  if (future === "false") query.set("only_future", "false");

  try {
    const res = await fetch(`${API_URL}/races?${query}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    return res.json() as Promise<Race[]>;
  } catch {
    return [];
  }
}

export default async function RacesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = await searchParams;
  const year =
    typeof params.year === "string"
      ? params.year
      : String(new Date().getFullYear());
  const rawRaces = await fetchRaces(params);
  const seen = new Set<string>();
  const races = rawRaces.filter((r) => {
    if (seen.has(r.raceUrl)) return false;
    seen.add(r.raceUrl);
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="p-4 bg-[#202013]">
        <div className="flex items-end justify-between mb-4">
          <div>
            <p className="tech-label text-[#ffff00] mb-1">WORLD TOUR {year}</p>
            <h2 className="kinetic-italic text-3xl text-[#f8f8f5]">
              {races.length} Races Found
            </h2>
          </div>
        </div>
        <Suspense fallback={<Skeleton className="h-11 w-full bg-[#2b2b1d]" />}>
          <RaceFilters />
        </Suspense>
      </div>

      <RaceListClient races={races} />
    </div>
  );
}
