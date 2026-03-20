import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { WatchlistToggle } from "@/components/races/watchlist-toggle";
import { StageRaceView } from "@/components/races/stage-race-view";
import Link from "next/link";
import type { Race, DiaryEntry, WatchlistItem } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchRaceDetail(raceUrl: string): Promise<Race | null> {
  try {
    const res = await fetch(`${API_URL}/race/${raceUrl}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

async function fetchMemories(
  raceBaseSlug: string,
  jwt: string
): Promise<DiaryEntry[]> {
  try {
    const res = await fetch(
      `${API_URL}/memories/${raceBaseSlug}?is_stage=false`,
      { headers: { Authorization: `Bearer ${jwt}` }, cache: "no-store" }
    );
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function fetchCommunityReviews(raceUrl: string): Promise<DiaryEntry[]> {
  try {
    const res = await fetch(`${API_URL}/race/${raceUrl}/community`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

async function fetchWatchlistItem(
  raceUrl: string,
  jwt: string
): Promise<WatchlistItem | null> {
  try {
    const res = await fetch(`${API_URL}/watchlist`, {
      headers: { Authorization: `Bearer ${jwt}` },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const items: WatchlistItem[] = await res.json();
    return items.find((i) => i.raceUrl === raceUrl) ?? null;
  } catch {
    return null;
  }
}

export default async function RaceDetailPage({
  params,
}: {
  params: Promise<{ slug: string[] }>;
}) {
  const { slug } = await params;
  const raceUrl = `race/${slug.join("/")}`;
  const raceBaseSlug = `race/${slug[0]}`;

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const jwt = session?.access_token ?? "";

  const [race, memories, communityReviews, watchlistItem] = await Promise.all([
    fetchRaceDetail(raceUrl),
    jwt ? fetchMemories(raceBaseSlug, jwt) : Promise.resolve([]),
    fetchCommunityReviews(raceUrl),
    jwt ? fetchWatchlistItem(raceUrl, jwt) : Promise.resolve(null),
  ]);

  if (!race) notFound();

  const writeUrl = `/diary/new?race_url=${encodeURIComponent(raceUrl)}&race_name=${encodeURIComponent(race.name)}`;

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Hero */}
      <div className="relative w-full h-48 bg-[#202013] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-[#1a1a0a] via-[#1a1a0a]/40 to-transparent z-10" />
        <div className="absolute bottom-4 left-4 right-4 z-20">
          <span className="inline-block bg-[#ffff00] text-black tech-label px-2 py-0.5 mb-2">
            {race.uciClass ?? "UCI"}
          </span>
          <div className="flex items-end justify-between gap-2">
            <h1 className="kinetic-italic text-3xl text-[#f8f8f5] leading-none">
              {race.name}
            </h1>
            {jwt ? (
              <WatchlistToggle
                raceUrl={raceUrl}
                raceName={race.name}
                raceDate={race.startDate}
                initialItemId={watchlistItem?.id ?? null}
                compact
              />
            ) : (
              <Link
                href="/login"
                className="flex items-center gap-1.5 px-3 py-1.5 tech-label border border-[#484831] text-[#cac8aa] hover:border-[#ffff00]/50 transition-colors"
              >
                WATCHLIST
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Meta grid */}
      <div className="grid grid-cols-2 gap-2 p-4">
        <div className="bg-[#202013] border border-[#484831] p-3">
          <span className="tech-label text-[#cac8aa] block mb-1">Date</span>
          <span className="text-sm font-bold">
            {race.startDate}{race.endDate && race.endDate !== race.startDate ? ` — ${race.endDate}` : ""}
          </span>
        </div>
        <div className="bg-[#202013] border border-[#484831] p-3">
          <span className="tech-label text-[#cac8aa] block mb-1">Category</span>
          <span className="text-sm font-bold">
            {race.gender === "ME" ? "Men Elite" : race.gender === "WE" ? "Women Elite" : race.gender}
          </span>
        </div>
        <div className="bg-[#ffff00]/10 border border-[#ffff00]/20 p-3 col-span-2">
          <span className="tech-label text-[#ffff00] block mb-1">Classification</span>
          <span className="text-sm font-bold text-[#ffff00]">{race.uciClass}</span>
        </div>
      </div>

      <StageRaceView
        race={race}
        raceUrl={raceUrl}
        raceBaseSlug={raceBaseSlug}
        jwt={jwt}
        memories={memories}
        communityReviews={communityReviews}
        writeUrl={writeUrl}
      />
    </div>
  );
}
