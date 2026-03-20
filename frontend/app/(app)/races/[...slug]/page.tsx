import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WatchlistToggle } from "@/components/races/watchlist-toggle";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import type { Race, DiaryEntry, WatchlistItem } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchRaceDetail(raceUrl: string): Promise<Race | null> {
  try {
    const res = await fetch(`${API_URL}/${raceUrl}`, {
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
    const res = await fetch(`${API_URL}/memories/${raceBaseSlug}`, {
      headers: { Authorization: `Bearer ${jwt}` },
      cache: "no-store",
    });
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
  // Next.js 16: params is a Promise — must await
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
          <h1 className="kinetic-italic text-3xl text-[#f8f8f5] leading-none">
            {race.name}
          </h1>
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

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList className="w-full bg-transparent border-b border-[#484831] rounded-none h-auto px-4">
          <TabsTrigger
            value="info"
            className="tech-label rounded-none border-b-2 border-transparent data-[state=active]:border-[#ffff00] data-[state=active]:text-[#ffff00] pb-2 pt-3"
          >
            INFO
          </TabsTrigger>
          <TabsTrigger
            value="memories"
            className="tech-label rounded-none border-b-2 border-transparent data-[state=active]:border-[#ffff00] data-[state=active]:text-[#ffff00] pb-2 pt-3"
          >
            MEMORIE
          </TabsTrigger>
          <TabsTrigger
            value="community"
            className="tech-label rounded-none border-b-2 border-transparent data-[state=active]:border-[#ffff00] data-[state=active]:text-[#ffff00] pb-2 pt-3"
          >
            COMMUNITY
          </TabsTrigger>
          <TabsTrigger
            value="watchlist"
            className="tech-label rounded-none border-b-2 border-transparent data-[state=active]:border-[#ffff00] data-[state=active]:text-[#ffff00] pb-2 pt-3"
          >
            WATCHLIST
          </TabsTrigger>
        </TabsList>

        {/* Info tab */}
        <TabsContent value="info" className="space-y-4">
          <div className="bg-[#202013] border border-[#484831] p-4 space-y-2 text-sm mx-4">
            <div className="flex justify-between">
              <span className="text-[#cac8aa]">Nazione</span>
              <span className="text-[#f8f8f5]">{race.nation ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#cac8aa]">Categoria</span>
              <span className="text-[#f8f8f5]">
                {race.uciClass ?? "—"}
                {race.gender ? ` \u2014 ${race.gender === "ME" ? "Elite Uomini" : "Elite Donne"}` : ""}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#cac8aa]">Data inizio</span>
              <span className="text-[#f8f8f5]">{race.startDate}</span>
            </div>
            {race.endDate && race.endDate !== race.startDate && (
              <div className="flex justify-between">
                <span className="text-[#cac8aa]">Data fine</span>
                <span className="text-[#f8f8f5]">{race.endDate}</span>
              </div>
            )}
            {race.startlistUrl && (
              <div className="flex justify-between items-center pt-1 border-t border-[#484831]">
                <span className="text-[#cac8aa]">Startlist</span>
                <a
                  href={race.startlistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[#cac8aa] hover:text-[#f8f8f5] transition-colors text-xs"
                >
                  ProCyclingStats
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          <Link
            href={writeUrl}
            className="flex items-center justify-center gap-2 bg-[#ffff00] text-black tech-label px-3 py-3 mx-4 hover:bg-[#cdcd00] transition-colors"
          >
            + SCRIVI RECENSIONE
          </Link>
        </TabsContent>

        {/* Memories tab */}
        <TabsContent value="memories">
          {memories.length === 0 ? (
            <div className="text-center py-12 text-[#cac8aa]">
              <p>Nessun ricordo per questa gara.</p>
              <p className="text-xs mt-1">
                Torna dopo aver scritto la tua prima recensione!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {memories.map((m) => (
                <Link key={m.id} href={`/diary/${m.id}`}>
                  <div className="bg-[#202013] border border-[#484831] p-4 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-sm text-[#f8f8f5]">
                        {m.raceYear}
                      </span>
                      {m.rating !== null && (
                        <span className="text-[#ffff00] text-sm">
                          {"★".repeat(m.rating)}
                        </span>
                      )}
                    </div>
                    <p className="text-[#cac8aa] text-sm line-clamp-2">
                      {m.body.replace(/<[^>]+>/g, "")}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Community tab */}
        <TabsContent value="community">
          {communityReviews.length === 0 ? (
            <div className="text-center py-12 text-[#cac8aa]">
              <p>Nessuna recensione pubblica per questa gara.</p>
              <p className="text-xs mt-1">Sii il primo!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {communityReviews.map((r) => (
                <div
                  key={r.id}
                  className="bg-[#202013] border border-[#484831] p-4"
                >
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-[#cac8aa]">{r.raceYear}</span>
                    {r.rating !== null && (
                      <span className="text-[#ffff00] text-sm">
                        {"★".repeat(r.rating)}
                      </span>
                    )}
                  </div>
                  <p className="text-[#f8f8f5] text-sm line-clamp-3">
                    {r.body.replace(/<[^>]+>/g, "")}
                  </p>
                  <div className="flex gap-3 mt-2 text-xs text-[#cac8aa]">
                    <span>&#10084; {r.likeCount}</span>
                    <span>&#128172; {r.commentCount}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Watchlist tab */}
        <TabsContent value="watchlist">
          {jwt ? (
            <WatchlistToggle
              raceUrl={raceUrl}
              raceName={race.name}
              raceDate={race.startDate}
              initialItemId={watchlistItem?.id ?? null}
            />
          ) : (
            <div className="text-center py-12 text-[#cac8aa]">
              <p>Accedi per gestire la tua watchlist.</p>
              <Link
                href="/login"
                className="text-[#ffff00] hover:underline text-sm mt-2 inline-block"
              >
                Vai al login
              </Link>
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
