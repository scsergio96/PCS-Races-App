"use client";

import { useState } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface WatchlistToggleProps {
  raceUrl: string;
  raceName: string;
  raceDate: string | null;
  initialItemId: string | null;
}

export function WatchlistToggle({
  raceUrl,
  raceName,
  raceDate,
  initialItemId,
}: WatchlistToggleProps) {
  const [itemId, setItemId] = useState<string | null>(initialItemId);
  const [loading, setLoading] = useState(false);

  const inWatchlist = itemId !== null;

  async function getToken(): Promise<string | null> {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token ?? null;
  }

  async function toggle() {
    setLoading(true);
    // Optimistic update
    const previous = itemId;
    setItemId(inWatchlist ? null : "optimistic");

    try {
      const token = await getToken();
      if (!token) {
        toast.error("Devi essere loggato per usare la watchlist");
        setItemId(previous);
        return;
      }

      if (inWatchlist && itemId) {
        const res = await fetch(`${API_URL}/watchlist/${itemId}`, {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("Errore nella rimozione dalla watchlist");
        setItemId(null);
        toast.success("Rimosso dalla watchlist");
      } else {
        const res = await fetch(`${API_URL}/watchlist`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            race_url: raceUrl,
            race_name: raceName,
            race_date: raceDate,
          }),
        });
        if (!res.ok) throw new Error("Errore nell\u2019aggiunta alla watchlist");
        const item = await res.json();
        setItemId(item.id);
        toast.success("Aggiunto alla watchlist");
      }
    } catch {
      setItemId(previous);
      toast.error("Errore watchlist, riprova");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 py-8">
      <button
        type="button"
        onClick={toggle}
        disabled={loading}
        className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors disabled:opacity-50 ${
          inWatchlist
            ? "border-2 border-[#ffff00] text-[#ffff00] hover:bg-[#ffff00]/10"
            : "border border-[#484831] text-[#cac8aa] hover:border-[#ffff00]/50"
        }`}
      >
        {inWatchlist ? (
          <BookmarkCheck className="w-5 h-5" />
        ) : (
          <Bookmark className="w-5 h-5" />
        )}
        {inWatchlist ? "In watchlist" : "Aggiungi alla watchlist"}
      </button>
      <p className="text-[#cac8aa] text-sm text-center">
        {inWatchlist
          ? "Riceverai un promemoria quando la gara si avvicina."
          : "Segui questa gara per non perderla."}
      </p>
    </div>
  );
}
