import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Download, Share, SquarePlus, Check, Menu } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { toast } from "sonner";

function Step({ n, children }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700 text-xs font-bold">
        {n}
      </span>
      <span className="text-sm text-slate-600 leading-relaxed">{children}</span>
    </li>
  );
}

export default function InstallAppButton({ className = "" }) {
  const { canPrompt, isIOS, installed, promptInstall } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);
  const [busy, setBusy] = useState(false);

  // Already installed -> no need to show the button at all
  if (installed) return null;

  const handleClick = async () => {
    if (canPrompt) {
      setBusy(true);
      const outcome = await promptInstall();
      setBusy(false);
      if (outcome === "accepted") {
        toast.success("Aplikasi berhasil dipasang di perangkat Anda");
      } else if (outcome === "unavailable") {
        setShowGuide(true);
      }
      // "dismissed" -> user closed the native prompt, do nothing
    } else {
      setShowGuide(true);
    }
  };

  return (
    <>
      <Button
        data-testid="hero-install-btn"
        onClick={handleClick}
        disabled={busy}
        variant="outline"
        className={className}
      >
        <Download className="w-5 h-5" /> {busy ? "Memasang..." : "Install Aplikasi"}
      </Button>

      <Dialog open={showGuide} onOpenChange={setShowGuide}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Pasang ProFinance Interior di HP Anda</DialogTitle>
            <DialogDescription>
              Akses lebih cepat langsung dari layar utama — tanpa buka browser.
            </DialogDescription>
          </DialogHeader>

          {isIOS ? (
            <ol className="space-y-3 pt-1">
              <Step n="1">
                Buka halaman ini di <strong>Safari</strong>, lalu tap ikon{" "}
                <Share className="inline w-4 h-4 -mt-0.5 text-blue-600" />{" "}
                <strong>Share</strong> di bilah bawah.
              </Step>
              <Step n="2">
                Gulir ke bawah, lalu pilih{" "}
                <SquarePlus className="inline w-4 h-4 -mt-0.5 text-slate-700" />{" "}
                <strong>"Add to Home Screen"</strong> (Tambah ke Layar Utama).
              </Step>
              <Step n="3">
                Tap <strong>"Add"</strong> — ikon ProFinance akan muncul di home screen.
              </Step>
            </ol>
          ) : (
            <ol className="space-y-3 pt-1">
              <Step n="1">
                Tap menu <Menu className="inline w-4 h-4 -mt-0.5 text-slate-700" />{" "}
                <strong>(⋮)</strong> di pojok kanan atas browser Anda.
              </Step>
              <Step n="2">
                Pilih <strong>"Install app"</strong> atau{" "}
                <strong>"Add to Home screen"</strong>.
              </Step>
              <Step n="3">
                Konfirmasi <strong>"Install"</strong> — aplikasi siap dipakai dari home screen.
              </Step>
            </ol>
          )}

          <div className="mt-4 flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2">
            <Check className="w-4 h-4 text-amber-600 shrink-0" />
            <p className="text-xs text-amber-800">
              Gratis, ringan, dan tetap tersinkron dengan akun Anda.
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
