export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#09090b] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-zinc-50">
            Cycle<span className="text-[#E91E8C]">Tracker</span>
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Il tuo diario ciclistico personale
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
