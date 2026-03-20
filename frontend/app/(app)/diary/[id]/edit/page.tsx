import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ReviewEditor } from "@/components/diary/review-editor";
import type { DiaryEntry } from "@/types/api";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export default async function EditDiaryPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) notFound();

  const res = await fetch(`${API_URL}/diary/${id}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
    cache: "no-store",
  });

  if (!res.ok) notFound();
  const entry: DiaryEntry = await res.json();

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Sticky header */}
      <div className="glass-nav border-b-2 border-[#ffff00] px-4 py-4 sticky top-0 z-10 mb-6">
        <p className="tech-label text-[#cac8aa]">MODIFICA</p>
        <h1 className="kinetic-italic text-xl text-[#f8f8f5] leading-none">
          {entry.raceName}
        </h1>
      </div>
      <div className="px-4">
        <ReviewEditor
          raceUrl={entry.raceUrl}
          raceName={entry.raceName}
          existing={entry}
        />
      </div>
    </div>
  );
}
