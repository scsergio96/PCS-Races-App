"use client";

import { useState, useCallback } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  Race,
  StageInfo,
  StageFullDetail,
  DiaryEntry,
} from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

// ── Props ─────────────────────────────────────────────────────────────────────

interface StageRaceViewProps {
  race: Race;
  raceUrl: string;
  raceBaseSlug: string;
  jwt: string;
  memories: DiaryEntry[];
  communityReviews: DiaryEntry[];
  writeUrl: string;
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function Skeleton() {
  return (
    <div className="space-y-2 p-4">
      {[1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="h-8 bg-[#202013] animate-pulse border border-[#484831]"
        />
      ))}
    </div>
  );
}

function Row({
  label,
  value,
  flag,
}: {
  label: string;
  value: string;
  flag?: string;
}) {
  return (
    <div className="flex justify-between">
      <span className="text-[#cac8aa]">{label}</span>
      <span className="text-[#f8f8f5] flex items-center gap-1.5">
        {flag && <span className={`fi fi-${flag}`} />}
        {value}
      </span>
    </div>
  );
}

function EmptyState({ text, sub }: { text: string; sub?: string }) {
  return (
    <div className="text-center py-12 text-[#cac8aa]">
      <p>{text}</p>
      {sub && <p className="text-xs mt-1">{sub}</p>}
    </div>
  );
}

// ── Tab trigger className shared across both views ────────────────────────────
const triggerCn =
  "tech-label rounded-none border-b-2 border-transparent data-[state=active]:border-[#ffff00] data-[state=active]:text-[#ffff00] pb-2 pt-3";

// ── DiaryEntry card (reused in memorie + community lists) ─────────────────────

function MemoryCard({ entry, linkable }: { entry: DiaryEntry; linkable: boolean }) {
  const inner = (
    <div className="bg-[#202013] border border-[#484831] p-4 transition-colors">
      <div className="flex justify-between items-start mb-1">
        <span className="font-semibold text-sm text-[#f8f8f5]">
          {entry.raceYear}
        </span>
        {entry.rating !== null && (
          <span className="text-[#ffff00] text-sm">
            {"★".repeat(entry.rating)}
          </span>
        )}
      </div>
      <p className="text-[#cac8aa] text-sm line-clamp-2">
        {entry.body.replace(/<[^>]+>/g, "")}
      </p>
    </div>
  );

  if (linkable) {
    return <Link href={`/diary/${entry.id}`}>{inner}</Link>;
  }
  return inner;
}

function CommunityCard({ entry }: { entry: DiaryEntry }) {
  return (
    <div className="bg-[#202013] border border-[#484831] p-4">
      <div className="flex justify-between mb-1">
        <span className="text-xs text-[#cac8aa]">{entry.raceYear}</span>
        {entry.rating !== null && (
          <span className="text-[#ffff00] text-sm">
            {"★".repeat(entry.rating)}
          </span>
        )}
      </div>
      <p className="text-[#f8f8f5] text-sm line-clamp-3">
        {entry.body.replace(/<[^>]+>/g, "")}
      </p>
      <div className="flex gap-3 mt-2 text-xs text-[#cac8aa]">
        <span>&#10084; {entry.likeCount}</span>
        <span>&#128172; {entry.commentCount}</span>
      </div>
    </div>
  );
}

// ── Stage selector label builder ──────────────────────────────────────────────

function buildStageLabel(s: StageInfo): string {
  const parts: string[] = [`Tappa ${s.number}`];
  if (s.date) parts.push(s.date);
  if (s.departure && s.arrival) {
    parts.push(`${s.departure} \u2192 ${s.arrival}`);
  } else if (s.departure) {
    parts.push(s.departure);
  } else if (s.arrival) {
    parts.push(s.arrival);
  }
  return parts.join(" \u00b7 ");
}

// ── Main component ────────────────────────────────────────────────────────────

export function StageRaceView({
  race,
  raceUrl,
  raceBaseSlug,
  jwt,
  memories,
  communityReviews,
  writeUrl,
}: StageRaceViewProps) {
  const stages: StageInfo[] = race.stages ?? [];

  const [selectedStageUrl, setSelectedStageUrl] = useState<string | null>(null);
  const [stageData, setStageData] = useState<StageFullDetail | null>(null);
  const [stageLoading, setStageLoading] = useState(false);
  const [stageMemories, setStageMemories] = useState<DiaryEntry[]>([]);
  const [stageCommunity, setStageCommunity] = useState<DiaryEntry[]>([]);

  const selectStage = useCallback(
    async (stageUrl: string | null) => {
      setSelectedStageUrl(stageUrl);
      setStageData(null);
      setStageMemories([]);
      setStageCommunity([]);

      if (!stageUrl) return;

      setStageLoading(true);
      try {
        const [detailRes, communityRes] = await Promise.all([
          fetch(`${API_URL}/stage/${stageUrl}`),
          fetch(`${API_URL}/race/${stageUrl}/community`),
        ]);
        if (detailRes.ok) setStageData(await detailRes.json());
        if (communityRes.ok) setStageCommunity(await communityRes.json());

        if (jwt) {
          const stage = stages.find((s) => s.stageUrl === stageUrl);
          const stageNum = stage?.number;
          const memRes = await fetch(
            `${API_URL}/memories/${raceBaseSlug}?is_stage=true${
              stageNum != null ? `&stage_number=${stageNum}` : ""
            }`,
            { headers: { Authorization: `Bearer ${jwt}` } }
          );
          if (memRes.ok) setStageMemories(await memRes.json());
        }
      } finally {
        setStageLoading(false);
      }
    },
    [jwt, stages, raceBaseSlug]
  );

  // ── Stage selector ──────────────────────────────────────────────────────────

  const stageSelector =
    stages.length > 0 ? (
      <div className="px-4 pt-4">
        <select
          className="w-full bg-[#202013] border border-[#484831] text-[#f8f8f5] tech-label px-3 py-2 focus:outline-none focus:border-[#ffff00]/50"
          value={selectedStageUrl ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            selectStage(val === "" ? null : val);
          }}
        >
          <option value="">&#9662; Visione generale</option>
          {stages.map((s) => (
            <option key={s.stageUrl} value={s.stageUrl}>
              {buildStageLabel(s)}
            </option>
          ))}
        </select>
      </div>
    ) : null;

  // ── Stage view ──────────────────────────────────────────────────────────────

  if (selectedStageUrl !== null) {
    const currentStage = stages.find((s) => s.stageUrl === selectedStageUrl);
    const stageNum = currentStage?.number;
    const stageName = stageData?.stageName ?? currentStage?.name ?? "";
    const stageWriteUrl = `/diary/new?race_url=${encodeURIComponent(
      selectedStageUrl
    )}&race_name=${encodeURIComponent(stageName)}&is_stage=true${
      stageNum != null ? `&stage_number=${stageNum}` : ""
    }`;

    return (
      <>
        {stageSelector}

        <Tabs defaultValue="info" className="mt-4">
          <TabsList className="w-full bg-transparent border-b border-[#484831] rounded-none h-auto px-4">
            {(["info", "tappa", "gc", "memorie", "community"] as const).map(
              (tab) => (
                <TabsTrigger key={tab} value={tab} className={triggerCn}>
                  {tab.toUpperCase()}
                </TabsTrigger>
              )
            )}
          </TabsList>

          {/* INFO tab — stage details */}
          <TabsContent value="info" className="space-y-4">
            {stageLoading ? (
              <Skeleton />
            ) : (
              <div className="bg-[#202013] border border-[#484831] p-4 space-y-2 text-sm mx-4">
                {stageData?.date && (
                  <Row label="Data" value={stageData.date} />
                )}
                {stageData?.distance != null && (
                  <Row label="Distanza" value={`${stageData.distance} km`} />
                )}
                {stageData?.departure && (
                  <Row label="Partenza" value={stageData.departure} />
                )}
                {stageData?.arrival && (
                  <Row label="Arrivo" value={stageData.arrival} />
                )}
                {stageData?.stageType && (
                  <Row label="Tipo" value={stageData.stageType} />
                )}
                {stageData?.verticalMeters != null && (
                  <Row
                    label="Dislivello"
                    value={`${stageData.verticalMeters} m`}
                  />
                )}
                {stageData?.wonHow && (
                  <Row label="Vittoria" value={stageData.wonHow} />
                )}
                {!stageData && (
                  <p className="text-[#cac8aa] text-xs">
                    Dati tappa non disponibili.
                  </p>
                )}
              </div>
            )}

            <Link
              href={stageWriteUrl}
              className="flex items-center justify-center gap-2 bg-[#ffff00] text-black tech-label px-3 py-3 mx-4 hover:bg-[#cdcd00] transition-colors"
            >
              + SCRIVI RECENSIONE TAPPA
            </Link>
          </TabsContent>

          {/* TAPPA tab — stage results */}
          <TabsContent value="tappa">
            {stageLoading ? (
              <Skeleton />
            ) : stageData?.results && stageData.results.length > 0 ? (
              <div className="divide-y divide-[#484831]">
                {stageData.results.map((r) => (
                  <div key={r.riderUrl} className="flex items-center gap-3 px-4 py-2.5">
                    {r.rank != null && (
                      <span className="text-[#cac8aa] tech-label w-6 text-right shrink-0">
                        {r.rank}
                      </span>
                    )}
                    {r.nationality && (
                      <span
                        className={`fi fi-${r.nationality.toLowerCase()} shrink-0`}
                      />
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
            ) : (
              <EmptyState text="Nessun risultato disponibile per questa tappa." />
            )}
          </TabsContent>

          {/* GC tab — general classification */}
          <TabsContent value="gc">
            {stageLoading ? (
              <Skeleton />
            ) : stageData?.gc && stageData.gc.length > 0 ? (
              <div className="divide-y divide-[#484831]">
                {stageData.gc.map((entry) => (
                  <div key={entry.riderUrl} className="flex items-center gap-3 px-4 py-2.5">
                    {entry.rank != null && (
                      <span
                        className={`tech-label w-6 text-right shrink-0 ${
                          entry.rank === 1
                            ? "text-[#ffff00]"
                            : "text-[#cac8aa]"
                        }`}
                      >
                        {entry.rank}
                      </span>
                    )}
                    {entry.nationality && (
                      <span
                        className={`fi fi-${entry.nationality.toLowerCase()} shrink-0`}
                      />
                    )}
                    <div className="flex-1 min-w-0">
                      <span className="text-[#f8f8f5] text-sm font-medium">
                        {entry.riderName}
                      </span>
                    </div>
                    {entry.time && (
                      <span className="text-[#cac8aa] text-xs shrink-0 font-mono">
                        {entry.time}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <EmptyState text="Classifica generale non disponibile." />
            )}
          </TabsContent>

          {/* MEMORIE tab — stage memories */}
          <TabsContent value="memorie">
            {stageMemories.length === 0 ? (
              <div className="text-center py-12 text-[#cac8aa]">
                <p>Nessun ricordo per questa tappa.</p>
                <p className="text-xs mt-1">
                  <Link
                    href={stageWriteUrl}
                    className="underline hover:text-[#ffff00] transition-colors"
                  >
                    Scrivi la tua prima recensione!
                  </Link>
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {stageMemories.map((m) => (
                  <MemoryCard key={m.id} entry={m} linkable />
                ))}
              </div>
            )}
          </TabsContent>

          {/* COMMUNITY tab — stage community reviews */}
          <TabsContent value="community">
            {stageCommunity.length === 0 ? (
              <EmptyState
                text="Nessuna recensione pubblica per questa tappa."
                sub="Sii il primo!"
              />
            ) : (
              <div className="space-y-3">
                {stageCommunity.map((r) => (
                  <CommunityCard key={r.id} entry={r} />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </>
    );
  }

  // ── Overall / Generale view ─────────────────────────────────────────────────

  const hasStartlist = race.startlist && race.startlist.length > 0;
  const hasResults =
    (race.stagesWinners && race.stagesWinners.length > 0) ||
    (race.raceResults && race.raceResults.length > 0);

  return (
    <>
      {stageSelector}

      <Tabs defaultValue="info" className={stages.length > 0 ? "mt-4" : ""}>
        <TabsList className="w-full bg-transparent border-b border-[#484831] rounded-none h-auto px-4">
          {(["info", "startlist", "memorie", "community"] as const).map(
            (tab) => (
              <TabsTrigger key={tab} value={tab} className={triggerCn}>
                {tab.toUpperCase()}
              </TabsTrigger>
            )
          )}
          {hasResults && (
            <TabsTrigger value="risultati" className={triggerCn}>
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
                ) : (
                  "\u2014"
                )}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#cac8aa]">Categoria</span>
              <span className="text-[#f8f8f5]">
                {race.uciClass ?? "\u2014"}
                {race.gender
                  ? ` \u2014 ${
                      race.gender === "ME" ? "Elite Uomini" : "Elite Donne"
                    }`
                  : ""}
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
                <span className="text-[#f8f8f5]">
                  {race.raceInfo.departure}
                </span>
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
                <span className="text-[#cac8aa]">Velocit\u00e0 media</span>
                <span className="text-[#f8f8f5]">
                  {race.raceInfo.avgSpeed}
                </span>
              </div>
            )}
            {race.raceInfo?.avgTemperature && (
              <div className="flex justify-between">
                <span className="text-[#cac8aa]">Temperatura</span>
                <span className="text-[#f8f8f5]">
                  {race.raceInfo.avgTemperature}
                </span>
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
              {race.startlist!.map((entry) => (
                <div key={entry.riderUrl ?? entry.riderName} className="flex items-center gap-3 px-4 py-2.5">
                  {entry.riderNumber != null && (
                    <span className="text-[#cac8aa] tech-label w-6 text-right shrink-0">
                      {entry.riderNumber}
                    </span>
                  )}
                  {entry.nationality && (
                    <span
                      className={`fi fi-${entry.nationality.toLowerCase()} shrink-0`}
                    />
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
                <MemoryCard key={m.id} entry={m} linkable />
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
                <CommunityCard key={r.id} entry={r} />
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
                    <div
                      key={`${w.riderUrl}-${w.stageName ?? i}`}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      {w.nationality && (
                        <span
                          className={`fi fi-${w.nationality.toLowerCase()} shrink-0`}
                        />
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
                : (race.raceResults ?? []).map((r) => (
                    <div
                      key={r.riderUrl}
                      className="flex items-center gap-3 px-4 py-2.5"
                    >
                      {r.rank != null && (
                        <span className="text-[#cac8aa] tech-label w-6 text-right shrink-0">
                          {r.rank}
                        </span>
                      )}
                      {r.nationality && (
                        <span
                          className={`fi fi-${r.nationality.toLowerCase()} shrink-0`}
                        />
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
    </>
  );
}
