import { AlertTriangle } from "lucide-react";

export default function CriticalBanner() {
  return (
    <div className="animate-slideUp mx-4 mt-4 overflow-hidden rounded-2xl border border-red-500/40 bg-gradient-to-br from-red-950/80 to-red-900/40">
      <div className="flex items-start gap-3 p-4">
        <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-status-critical/20">
          <AlertTriangle size={18} className="text-status-critical animate-pulseSoft" strokeWidth={2.5} />
        </div>
        <div className="flex-1">
          <div className="mb-1 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md bg-status-critical px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-white">
              OVERLOAD
            </span>
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-status-critical">
              SEGERA
            </span>
          </div>
          <p className="text-sm font-semibold text-red-50">PERINGATAN: Integritas Struktur Kritis</p>
          <p className="mt-1 text-xs leading-relaxed text-red-200/80">
            Beban struktur melebihi ambang aman. Hentikan operasi dan periksa tiang serta sambungan struktur
            segera. Mode Proteksi Badai aktif untuk membatasi kerusakan lebih lanjut.
          </p>
        </div>
      </div>
    </div>
  );
}
