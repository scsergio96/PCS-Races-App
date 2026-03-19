import { Suspense } from "react";
import { RaceCard } from "@/components/races/race-card";
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
  const level = typeof levelParam === "string" ? levelParam : undefined;
  const genderParam = searchParams.gender;
  const gender = typeof genderParam === "string" ? genderParam : undefined;

  const query = new URLSearchParams({
    year_from: year,
    year_to: year,
    max_pages_per_year: "3",
  });
  if (level && level !== "all") query.set("race_level", level);
  if (gender && gender !== "all") query.set("gender", gender);

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
  // Next.js 16: searchParams is a Promise — must await
  const params = await searchParams;
  const races = await fetchRaces(params);

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold text-zinc-50">Calendario Gare</h1>
      </div>

      <div className="mb-4">
        <Suspense fallback={<Skeleton className="h-8 w-full" />}>
          <RaceFilters />
        </Suspense>
      </div>

      {races.length === 0 ? (
        <div className="text-center py-16 text-zinc-500">
          <p>Nessuna gara trovata.</p>
          <p className="text-xs mt-1">
            Prova a cambiare i filtri o controlla che il backend sia avviato.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {races.map((race) => (
            <RaceCard key={race.url} race={race} />
          ))}
        </div>
      )}
    </div>
  );
}
