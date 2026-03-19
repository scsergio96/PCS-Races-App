import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CopyButton } from "./copy-button";
import type { UserProfile, WatchlistItem, CalendarFilter } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function fetchProfile(jwt: string): Promise<UserProfile | null> {
  const res = await fetch(`${API_URL}/me`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

async function fetchWatchlist(jwt: string): Promise<WatchlistItem[]> {
  const res = await fetch(`${API_URL}/watchlist`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

async function fetchCalendarFeeds(jwt: string): Promise<CalendarFilter[]> {
  const res = await fetch(`${API_URL}/calendar/filters`, {
    headers: { Authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });
  if (!res.ok) return [];
  return res.json();
}

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) redirect("/login");

  const jwt = session.access_token;
  const [profile, watchlist, calendarFeeds] = await Promise.all([
    fetchProfile(jwt),
    fetchWatchlist(jwt),
    fetchCalendarFeeds(jwt),
  ]);

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8 space-y-6">
      {/* User header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-full bg-[#E91E8C]/20 flex items-center justify-center text-2xl">
          {profile?.displayName?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div>
          <h1 className="text-lg font-bold text-zinc-50">
            {profile?.displayName ?? "Utente"}
          </h1>
          <p className="text-zinc-500 text-sm">{session.user.email}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Recensioni", value: profile?.totalReviews ?? 0 },
          { label: "Pubbliche", value: profile?.publicReviews ?? 0 },
          { label: "Seguite", value: profile?.racesFollowed ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="bg-zinc-900 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold font-mono text-zinc-50">{value}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Watchlist */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
          Gare seguite ({watchlist.length})
        </h2>
        {watchlist.length === 0 ? (
          <p className="text-zinc-600 text-sm">Nessuna gara seguita.</p>
        ) : (
          <div className="space-y-2">
            {watchlist.map((item) => (
              <div
                key={item.id}
                className="bg-zinc-900 rounded-xl p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium text-zinc-50">
                    {item.raceName}
                  </p>
                  <p className="text-xs text-zinc-500">{item.raceDate}</p>
                </div>
                <Badge
                  variant="outline"
                  className="border-zinc-700 text-zinc-400 text-[10px]"
                >
                  In agenda
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calendar feeds */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider">
          Feed calendario (.ics)
        </h2>
        {calendarFeeds.length === 0 ? (
          <p className="text-zinc-600 text-sm">Nessun feed configurato.</p>
        ) : (
          <div className="space-y-2">
            {calendarFeeds.map((feed) => {
              const icsUrl = `${apiBase}/calendar/feed/${feed.subscriptionToken}.ics`;
              return (
                <div
                  key={feed.id}
                  className="bg-zinc-900 rounded-xl p-3 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-50 truncate">
                      {feed.label}
                    </p>
                    <p className="text-xs text-zinc-600 truncate">{icsUrl}</p>
                  </div>
                  <CopyButton text={icsUrl} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sign out */}
      <div className="pt-4 border-t border-zinc-800">
        <form action="/api/auth/signout" method="POST">
          <Button
            type="submit"
            variant="outline"
            className="w-full border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-800"
          >
            Esci dall&apos;account
          </Button>
        </form>
      </div>
    </div>
  );
}
