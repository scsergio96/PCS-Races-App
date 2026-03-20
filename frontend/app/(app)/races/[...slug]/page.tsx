import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WatchlistToggle } from "@/components/races/watchlist-toggle";
import Link from "next/link";
import type { Race, DiaryEntry, WatchlistItem, RaceInfo } from "@/types/api";

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
  const hasStartlist = race.startlist && race.startlist.length > 0;
  const hasResults =
    !race.isFuture &&
    ((race.stagesWinners && race.stagesWinners.length > 0) ||
      (race.raceResults && race.raceResults.length > 0));

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

      {/* Tabs */}
      <Tabs defaultValue="info">
        <TabsList className="w-full bg-transparent border-b border-[#484831] rounded-none h-auto px-4">
          {(["info", "startlist", "memorie", "community"] as const).map((tab) => (
            <TabsTrigger
              key={tab}
              value={tab}
              className="tech-label rounded-none border-b-2 border-transparent data-[state=active]:border-[#ffff00] data-[state=active]:text-[#ffff00] pb-2 pt-3"
            >
              {tab.toUpperCase()}
            </TabsTrigger>
          ))}
          {hasResults && (
            <TabsTrigger
              value="risultati"
              className="tech-label rounded-none border-b-2 border-transparent data-[state=active]:border-[#ffff00] data-[state=active]:text-[#ffff00] pb-2 pt-3"
            >
              RISULTATI
            </TabsTrigger>
          )}
        </TabsList>

        {/* Info tab */}
        <TabsContent value="info" className="space-y-4">
          <div className="bg-[#202013] border border-[#484831] p-4 space-y-2 text-sm mx-4">
            <div className="flex justify-between">
              <span className="text-[#cac8aa]">Nazione</span>
              <span className="text-[#f8f8f5] flex items-center gap-1.5">
                {race.nation ? (
                  <>
                    <span className={`fi fi-${race.nation.toLowerCase()}`} />
                    {race.nation}
                  </>
                ) : "—"}
              </span>
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
            {race.raceInfo?.distance && (
              <div className="flex justify-between">
                <span className="text-[#cac8aa]">Distanza</span>
                <span className="text-[#f8f8f5]">{race.raceInfo.distance}</span>
              </div>
            )}
            {race.raceInfo?.departure && (
              <div className="flex justify-between">
                <span className="text-[#cac8aa]">Partenza</span>
                <span className="text-[#f8f8f5]">{race.raceInfo.departure}</span>
              </div>
            )}
            {race.raceInfo?.arrival && (
              <div className="flex justify-between">
                <span className="text-[#cac8aa]">Arrivo</span>
                <span className="text-[#f8f8f5]">{race.raceInfo.arrival}</span>
              </div>
            )}
            {race.raceInfo?.wonHow && (
              <div className="flex justify-between">
                <span className="text-[#cac8aa]">Vittoria</span>
                <span className="text-[#f8f8f5]">{race.raceInfo.wonHow}</span>
              </div>
            )}
            {race.raceInfo?.avgSpeed && (
              <div className="flex justify-between">
                <span className="text-[#cac8aa]">Velocità media</span>
                <span className="text-[#f8f8f5]">{race.raceInfo.avgSpeed}</span>
              </div>
            )}
            {race.raceInfo?.avgTemperature && (
              <div className="flex justify-between">
                <span className="text-[#cac8aa]">Temperatura</span>
                <span className="text-[#f8f8f5]">{race.raceInfo.avgTemperature}</span>
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

        {/* Startlist tab */}
        <TabsContent value="startlist">
          {hasStartlist ? (
            <div className="divide-y divide-[#484831]">
              {race.startlist!.map((entry, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                  {entry.riderNumber != null && (
                    <span className="text-[#cac8aa] tech-label w-6 text-right shrink-0">
                      {entry.riderNumber}
                    </span>
                  )}
                  {entry.nationality && (
                    <span className={`fi fi-${entry.nationality.toLowerCase()} shrink-0`} />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="text-[#f8f8f5] text-sm font-medium">
                      {entry.riderName}
                    </span>
                    {entry.teamName && (
                      <span className="block text-[#cac8aa] text-xs truncate">
                        {entry.teamName}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12 text-[#cac8aa]">
              <p>Startlist non ancora disponibile.</p>
            </div>
          )}
        </TabsContent>

        {/* Memorie tab */}
        <TabsContent value="memorie">
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

        {/* Risultati tab — stage races or one-day races */}
        {hasResults && (
          <TabsContent value="risultati">
            <div className="divide-y divide-[#484831]">
              {race.stagesWinners && race.stagesWinners.length > 0
                ? race.stagesWinners.map((w, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      {w.nationality && (
                        <span className={`fi fi-${w.nationality.toLowerCase()} shrink-0`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-[#f8f8f5] text-sm font-medium">
                          {w.riderName}
                        </span>
                        <span className="block text-[#cac8aa] text-xs">
                          {w.stageName}
                        </span>
                      </div>
                    </div>
                  ))
                : race.raceResults!.map((r, i) => (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5">
                      {r.rank != null && (
                        <span className="text-[#cac8aa] tech-label w-6 text-right shrink-0">
                          {r.rank}
                        </span>
                      )}
                      {r.nationality && (
                        <span className={`fi fi-${r.nationality.toLowerCase()} shrink-0`} />
                      )}
                      <div className="flex-1 min-w-0">
                        <span className="text-[#f8f8f5] text-sm font-medium">
                          {r.riderName}
                        </span>
                        {r.teamName && (
                          <span className="block text-[#cac8aa] text-xs truncate">
                            {r.teamName}
                          </span>
                        )}
                      </div>
                      {r.time && (
                        <span className="text-[#cac8aa] text-xs shrink-0 font-mono">
                          {r.time}
                        </span>
                      )}
                    </div>
                  ))}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
