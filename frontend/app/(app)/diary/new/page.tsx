import { ReviewEditor } from "@/components/diary/review-editor";

export default async function NewDiaryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const params = await searchParams;
  const raceUrl = params.race_url;
  const raceName = params.race_name;
  const isStage = params.is_stage === "true";
  const stageNumber = params.stage_number ? Number(params.stage_number) : null;

  return (
    <div className="max-w-2xl mx-auto pb-8">
      {/* Header */}
      <div className="glass-nav border-b-2 border-[#ffff00] px-4 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div>
          <p className="tech-label text-[#cac8aa] text-[9px]">REVIEW EDITOR</p>
          <h1 className="kinetic-italic text-xl text-[#f8f8f5] leading-tight">
            Scrivi
            <br />
            Recensione
          </h1>
        </div>
        {raceName && (
          <div className="bg-[#202013] border border-[#484831] px-3 py-2 text-right max-w-[120px]">
            <p className="tech-label text-[#cac8aa] text-[9px]">RACE</p>
            <p className="text-xs font-bold text-[#f8f8f5] leading-tight line-clamp-2">
              {raceName}
            </p>
          </div>
        )}
      </div>

      <div className="px-4 pt-6">
        <ReviewEditor raceUrl={raceUrl} raceName={raceName} isStage={isStage} stageNumber={stageNumber} />
      </div>
    </div>
  );
}
