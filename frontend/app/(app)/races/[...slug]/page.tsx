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
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold text-zinc-50">{race.name}</h1>
        <p className="text-zinc-400 text-sm mt-1">
          {race.startDate ?? ""}
          {race.endDate && race.endDate !== race.startDate
            ? ` \u2013 ${race.endDate}`
            : ""}
          {race.nation ? ` \u00b7 ${race.nation}` : ""}
          {race.uciClass ? ` \u00b7 ${race.uciClass}` : ""}
        </p>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList
          variant="line"
          className="w-full justify-start border-b border-zinc-800 rounded-none h-auto pb-0 mb-4"
        >
          {(
            [
              { value: "info", label: "Info" },
              { value: "memories", label: "Memorie" },
              { value: "community", label: "Community" },
              { value: "watchlist", label: "Watchlist" },
            ] as const
          ).map(({ value, label }) => (
            <TabsTrigger
              key={value}
              value={value}
              className="rounded-none border-b-2 border-transparent data-active:border-[#E91E8C] data-active:text-zinc-50 text-zinc-500 px-4 pb-2 bg-transparent"
            >
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Info tab */}
        <TabsContent value="info" className="space-y-4">
          <div className="bg-zinc-900 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-zinc-400">Nazione</span>
              <span className="text-zinc-50">{race.nation ?? "—"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Categoria</span>
              <span className="text-zinc-50">
                {race.uciClass ?? "—"}
                {race.gender ? ` \u2014 ${race.gender === "ME" ? "Elite Uomini" : "Elite Donne"}` : ""}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-400">Data inizio</span>
              <span className="text-zinc-50">{race.startDate}</span>
            </div>
            {race.endDate && race.endDate !== race.startDate && (
              <div className="flex justify-between">
                <span className="text-zinc-400">Data fine</span>
                <span className="text-zinc-50">{race.endDate}</span>
              </div>
            )}
            {race.startlistUrl && (
              <div className="flex justify-between items-center pt-1 border-t border-zinc-800">
                <span className="text-zinc-400">Startlist</span>
                <a
                  href={race.startlistUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-zinc-300 hover:text-zinc-50 transition-colors text-xs"
                >
                  ProCyclingStats
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          <Link
            href={writeUrl}
            className="block w-full text-center bg-[#E91E8C] hover:bg-[#c4186f] text-white font-medium py-2 px-4 rounded-lg transition-colors"
          >
            Scrivi la tua recensione
          </Link>
        </TabsContent>

        {/* Memories tab */}
        <TabsContent value="memories">
          {memories.length === 0 ? (
            <div className="text-center py-12 text-zinc-500">
              <p>Nessun ricordo per questa gara.</p>
              <p className="text-xs mt-1">
                Torna dopo aver scritto la tua prima recensione!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {memories.map((m) => (
                <Link key={m.id} href={`/diary/${m.id}`}>
                  <div className="bg-zinc-900 rounded-xl p-4 hover:border-zinc-600 border border-zinc-800 transition-colors">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-semibold text-sm text-zinc-50">
                        {m.raceYear}
                      </span>
                      {m.rating !== null && (
                        <span className="text-yellow-400 text-sm">
                          {"&#9733;".repeat(m.rating)}
                        </span>
                      )}
                    </div>
                    <p className="text-zinc-400 text-sm line-clamp-2">
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
            <div className="text-center py-12 text-zinc-500">
              <p>Nessuna recensione pubblica per questa gara.</p>
              <p className="text-xs mt-1">Sii il primo!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {communityReviews.map((r) => (
                <div
                  key={r.id}
                  className="bg-zinc-900 rounded-xl p-4 border border-zinc-800"
                >
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-zinc-400">{r.raceYear}</span>
                    {r.rating !== null && (
                      <span className="text-yellow-400 text-sm">
                        {"★".repeat(r.rating)}
                      </span>
                    )}
                  </div>
                  <p className="text-zinc-300 text-sm line-clamp-3">
                    {r.body.replace(/<[^>]+>/g, "")}
                  </p>
                  <div className="flex gap-3 mt-2 text-xs text-zinc-500">
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
            <div className="text-center py-12 text-zinc-500">
              <p>Accedi per gestire la tua watchlist.</p>
              <Link
                href="/login"
                className="text-[#E91E8C] hover:underline text-sm mt-2 inline-block"
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
