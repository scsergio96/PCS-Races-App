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
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">
      <h1 className="text-xl font-bold text-zinc-50 mb-6">
        Modifica recensione
      </h1>
      <ReviewEditor
        raceUrl={entry.raceUrl}
        raceName={entry.raceName}
        existing={entry}
      />
    </div>
  );
}
