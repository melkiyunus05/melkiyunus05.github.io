export default function PhoneFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen w-full bg-[#050505] md:flex md:items-center md:justify-center md:py-8">
      <div
        className="mx-auto flex min-h-screen w-full flex-col bg-bg text-zinc-100 md:min-h-[844px] md:w-[402px] md:overflow-hidden md:rounded-[2.75rem] md:border md:border-zinc-800 md:shadow-[0_0_0_10px_#111,0_20px_60px_rgba(0,0,0,0.6)]"
      >
        <div className="flex-1 overflow-y-auto no-scrollbar">{children}</div>
      </div>
    </div>
  );
}
