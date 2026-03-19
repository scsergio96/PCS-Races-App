import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import type { Race } from "@/types/api";

const NATION_FLAGS: Record<string, string> = {
  IT: "🇮🇹", FR: "🇫🇷", ES: "🇪🇸", BE: "🇧🇪", NL: "🇳🇱",
  DE: "🇩🇪", CH: "🇨🇭", GB: "🇬🇧", US: "🇺🇸", AU: "🇦🇺",
  AT: "🇦🇹", PT: "🇵🇹", DK: "🇩🇰", NO: "🇳🇴", SE: "🇸🇪",
};

function formatDate(start: string, end: string | null): string {
  const s = new Date(start);
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (!end || start === end) return s.toLocaleDateString("it-IT", opts);
  const e = new Date(end);
  return `${s.toLocaleDateString("it-IT", opts)} \u2013 ${e.toLocaleDateString("it-IT", opts)}`;
}

interface RaceCardProps {
  race: Race;
  reviewed?: boolean;
}

export function RaceCard({ race, reviewed }: RaceCardProps) {
  const flag = NATION_FLAGS[race.nation ?? ""] ?? "🏁";
  // Strip "race/" prefix from the raceUrl to build the Next.js route
  const slug = race.raceUrl.replace(/^race\//, "");

  return (
    <Link href={`/races/${slug}`}>
      <div className="bg-[#18181b] border border-zinc-800 rounded-xl p-4 hover:border-zinc-600 transition-colors cursor-pointer">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm text-zinc-50 truncate">{race.name}</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              {flag} {formatDate(race.startDate ?? "", race.endDate)}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {race.uciClass && (
              <Badge
                variant="outline"
                className="text-[10px] border-zinc-700 text-zinc-400"
              >
                {race.uciClass}
              </Badge>
            )}
            {reviewed && (
              <Badge className="text-[10px] bg-emerald-500/20 text-emerald-400 border-0">
                Recensita
              </Badge>
            )}
            {race.isFuture && (
              <Badge className="text-[10px] bg-[#E91E8C]/20 text-[#E91E8C] border-0">
                In arrivo
              </Badge>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
