import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
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
  const handle =
    session.user.email?.split("@")[0]?.replace(/\W/g, "_").toLowerCase() ?? "user";

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="glass-nav border-b-2 border-[#ffff00] px-4 py-4 sticky top-0 z-10">
        <h1 className="kinetic-italic text-xl text-[#f8f8f5]">Profilo</h1>
      </div>

      {/* Avatar + Name */}
      <div className="flex flex-col items-center py-8 gap-3">
        <div className="w-20 h-20 border-2 border-[#ffff00] bg-[#202013] flex items-center justify-center text-3xl font-black text-[#ffff00]">
          {profile?.displayName?.[0]?.toUpperCase() ?? "?"}
        </div>
        <div className="text-center">
          <p className="kinetic-italic text-2xl text-[#f8f8f5]">
            {profile?.displayName ?? "Rider"}
          </p>
          <p className="tech-label text-[#ffff00]">@{handle}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-0 border-y border-[#484831] mx-4 mb-6">
        <div className="p-4 text-center border-r border-[#ffff00]">
          <p className="text-3xl font-black font-mono text-[#f8f8f5]">
            {profile?.totalReviews ?? 0}
          </p>
          <p className="tech-label text-[#cac8aa] mt-0.5">REVIEWS</p>
        </div>
        <div className="p-4 text-center">
          <p className="text-3xl font-black font-mono text-[#f8f8f5]">
            {profile?.racesFollowed ?? 0}
          </p>
          <p className="tech-label text-[#cac8aa] mt-0.5">FOLLOWED</p>
        </div>
      </div>

      {/* Watchlist */}
      <div className="px-4 mb-6">
        <h2 className="kinetic-italic text-xl text-[#f8f8f5] mb-3">Watchlist</h2>
        {watchlist.length === 0 ? (
          <p className="tech-label text-[#484831]">Nessuna gara seguita.</p>
        ) : (
          <div className="space-y-2">
            {watchlist.map((item) => (
              <div
                key={item.id}
                className="bg-[#202013] border border-[#484831] flex items-center justify-between p-3"
              >
                {item.raceDate && (
                  <div className="bg-[#2b2b1d] border border-[#484831] p-2 text-center min-w-[44px] mr-3">
                    <p className="tech-label text-[#ffff00] text-[10px] leading-tight">
                      {new Date(item.raceDate).toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
                    </p>
                    <p className="font-black text-[#f8f8f5] text-lg leading-none">
                      {new Date(item.raceDate).getDate()}
                    </p>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="kinetic-italic text-sm text-[#f8f8f5] leading-tight truncate">
                    {item.raceName}
                  </p>
                </div>
                <span className="text-[#ffff00] text-lg ml-2">★</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Calendar feeds */}
      <div className="px-4 mb-8">
        <h2 className="kinetic-italic text-xl text-[#f8f8f5] mb-3">Calendar Feeds</h2>
        {calendarFeeds.length === 0 ? (
          <p className="tech-label text-[#484831]">Nessun feed configurato.</p>
        ) : (
          <div className="space-y-2">
            {calendarFeeds.map((feed) => {
              const icsUrl = `${apiBase}/calendar/feed/${feed.subscriptionToken}.ics`;
              return (
                <div
                  key={feed.id}
                  className="bg-[#202013] border border-[#484831] p-3"
                >
                  <p className="tech-label text-[#f8f8f5] mb-2">{feed.label}</p>
                  <div className="flex items-center gap-2">
                    <p className="text-xs text-[#484831] truncate flex-1 font-mono">
                      {icsUrl}
                    </p>
                    <CopyButton text={icsUrl} />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Sign out */}
      <div className="px-4">
        <form action="/api/auth/signout" method="POST">
          <button
            type="submit"
            className="w-full border-2 border-[#ef4444] text-[#ef4444] py-4 kinetic-italic text-lg hover:bg-[#ef4444] hover:text-black transition-colors flex items-center justify-center gap-2"
          >
            → ESCI DALL&apos;ACCOUNT
          </button>
        </form>
      </div>
    </div>
  );
}
