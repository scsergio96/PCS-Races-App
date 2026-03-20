import Link from "next/link";
import { CommunityCard } from "@/components/community/community-card";
import type { DiaryEntry } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

type SortOption = "recent" | "popular" | "hot";

async function fetchFeed(sort: SortOption): Promise<DiaryEntry[]> {
  try {
    const res = await fetch(`${API_URL}/community/feed?sort=${sort}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return [];
    return res.json();
  } catch {
    return [];
  }
}

const SORT_LABELS: Record<SortOption, string> = {
  recent: "RECENTI",
  popular: "POPOLARI",
  hot: "HOT",
};

export default async function CommunityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const sort = (params.sort as SortOption) ?? "recent";
  const reviews = await fetchFeed(sort);

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="glass-nav border-b-2 border-[#ffff00] px-4 py-4 sticky top-0 z-10">
        <h1 className="kinetic-italic text-xl text-[#f8f8f5]">Community Feed</h1>
      </div>

      {/* Sort chips */}
      <div className="flex gap-2 p-4 bg-[#1c1c0f] overflow-x-auto">
        {(["recent", "popular", "hot"] as const).map((s) => (
          <Link
            key={s}
            href={`/community?sort=${s}`}
            className={`flex h-8 shrink-0 items-center justify-center px-4 tech-label transition-colors ${
              sort === s
                ? "bg-[#ffff00] text-black"
                : "bg-[#2b2b1d] border border-[#484831] text-[#f8f8f5] hover:bg-[#363527]"
            }`}
          >
            {SORT_LABELS[s]}
          </Link>
        ))}
      </div>

      {/* Feed */}
      {reviews.length === 0 ? (
        <div className="text-center py-16 px-4">
          <p className="tech-label text-[#cac8aa]">Nessuna recensione pubblica ancora.</p>
          <p className="text-xs mt-1 text-[#484831]">Sii il primo a condividere la tua!</p>
        </div>
      ) : (
        <div className="space-y-4 p-4">
          {reviews.map((review) => (
            <CommunityCard key={review.id} review={review} />
          ))}
        </div>
      )}
    </div>
  );
}
