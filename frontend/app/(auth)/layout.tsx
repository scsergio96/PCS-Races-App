export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#1a1a0a] px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-[#f8f8f5]">
            CYCLE<span className="kinetic-italic text-[#ffff00]">TRACKER</span>
          </h1>
          <p className="text-[#cac8aa] text-sm mt-1">
            Il tuo diario ciclistico personale
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
