import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Race } from "@/types/api";


function formatDate(start: string | null, end: string | null): string {
  if (!start) return "—";
  if (!end || start === end) return start;
  return `${start} → ${end}`;
}

interface RaceCardProps {
  race: Race;
  striped?: boolean;
}

export function RaceCard({ race, striped = false }: RaceCardProps) {
  const nationCode = race.nation?.toLowerCase() ?? "";
  const slug = race.raceUrl.replace(/^race\//, "");
  const isMen = race.gender === "ME";
  const isWomen = race.gender === "WE";

  return (
    <Link href={`/races/${slug}`}>
      <div
        className={cn(
          "p-4 hover:bg-[#ffff00]/10 transition-colors",
          striped ? "bg-[#ffff00]/5" : "bg-transparent"
        )}
      >
        {/* Date row */}
        <div className="flex justify-between items-start mb-2">
          <span className="flex items-center gap-1 text-[#ffff00] font-bold text-sm">
            {formatDate(race.startDate, race.endDate)}
          </span>
          <div className="flex gap-1">
            {race.isFuture && (
              <span className="bg-green-600 text-white tech-label px-2 py-0.5">
                Upcoming
              </span>
            )}
            {isMen && (
              <span className="bg-blue-600 text-white tech-label px-2 py-0.5">
                Men Elite
              </span>
            )}
            {isWomen && (
              <span className="bg-pink-600 text-white tech-label px-2 py-0.5">
                Women Elite
              </span>
            )}
          </div>
        </div>

        {/* Flag + Name */}
        <div className="flex items-center gap-3 mb-3">
          {nationCode ? (
            <span className={`fi fi-${nationCode} text-2xl`} />
          ) : (
            <span className="text-2xl">🏁</span>
          )}
          <h3 className="kinetic-italic text-xl leading-tight">{race.name}</h3>
        </div>

        {/* UCI class + CTA */}
        <div className="flex items-center justify-between">
          <div className="flex gap-2">
            {race.uciClass && (
              <span className="border border-[#484831] text-[#cac8aa] tech-label px-2 py-0.5">
                UCI Class: {race.uciClass}
              </span>
            )}
          </div>
          <span className="flex items-center gap-0.5 text-[#ffff00] tech-label hover:underline">
            VIEW DETAILS →
          </span>
        </div>
      </div>
    </Link>
  );
}
