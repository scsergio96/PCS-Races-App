import { ReviewEditor } from "@/components/diary/review-editor";

export default async function NewDiaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const raceUrl = params.race_url;
  const raceName = params.race_name;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-6 pb-8">
      <h1 className="text-xl font-bold text-zinc-50 mb-6">Scrivi recensione</h1>
      <ReviewEditor raceUrl={raceUrl} raceName={raceName} />
    </div>
  );
}
