import Link from "next/link";
import { StarRating } from "@/components/diary/star-rating";
import type { DiaryEntry } from "@/types/api";

interface DiaryCardProps {
  entry: DiaryEntry;
}

function formatEntryDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("it-IT", { day: "numeric", month: "short", year: "numeric" }).toUpperCase();
}

export function DiaryCard({ entry }: DiaryCardProps) {
  const bodyText = entry.body.replace(/<[^>]+>/g, "");

  return (
    <Link href={`/diary/${entry.id}`}>
      <div
        className={`bg-[#202013] p-4 border-l-4 hover:bg-[#2b2b1d] transition-colors ${
          entry.isPublic ? "border-[#ffff00]" : "border-[#484831]"
        }`}
      >
        <div className="flex justify-between items-start mb-2">
          <span className={`tech-label text-[9px] ${entry.isPublic ? "text-blue-400" : "text-[#cac8aa]"}`}>
            {formatEntryDate(entry.createdAt)}
          </span>
          <span
            className={`tech-label text-[9px] px-2 py-0.5 ${
              entry.isPublic
                ? "bg-blue-500/10 text-blue-400"
                : "bg-[#2b2b1d] text-[#cac8aa]"
            }`}
          >
            {entry.isPublic ? "PUBLIC" : "PRIVATE"}
          </span>
        </div>

        <h3 className="kinetic-italic text-lg text-[#f8f8f5] mb-2 leading-tight">
          {entry.raceName}
        </h3>

        {entry.rating !== null && (
          <div className="mb-2">
            <StarRating value={entry.rating} readonly size="sm" />
          </div>
        )}

        {bodyText && (
          <p className="text-[#cac8aa] text-sm line-clamp-2 italic">
            &ldquo;{bodyText}&rdquo;
          </p>
        )}
      </div>
    </Link>
  );
}
