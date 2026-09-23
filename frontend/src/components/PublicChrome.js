import { useNavigate } from "react-router-dom";
import { Ruler, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";

export function PublicNav() {
  const navigate = useNavigate();
  const { user } = useAuth();
  return (
    <header className="sticky top-0 z-40 bg-white/85 backdrop-blur border-b border-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <button onClick={() => navigate("/")} className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center shadow-md shadow-amber-500/20">
            <Ruler className="w-5 h-5 text-white" />
          </div>
          <div className="text-left">
            <div className="font-display font-extrabold leading-none">ProFinance</div>
            <div className="text-[10px] tracking-[0.3em] text-amber-600 font-semibold">INTERIOR</div>
          </div>
        </button>
        <nav className="hidden md:flex items-center gap-7 text-sm text-slate-600">
          <button onClick={() => navigate("/")} className="hover:text-slate-900">Beranda</button>
          <button onClick={() => navigate("/blog")} className="hover:text-slate-900">Blog</button>
          <button onClick={() => navigate("/panduan")} className="hover:text-slate-900">Panduan</button>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <Button onClick={() => navigate("/dashboard")} className="bg-slate-900 hover:bg-slate-800 text-white gap-1.5 h-9">
              Dashboard <ArrowRight className="w-4 h-4" />
            </Button>
          ) : (
            <>
              <Button variant="ghost" onClick={() => navigate("/login")} className="hidden sm:inline-flex h-9 text-slate-700">Masuk</Button>
              <Button onClick={() => navigate("/login")} className="bg-amber-600 hover:bg-amber-700 text-white h-9">Daftar Gratis</Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function PublicFooter() {
  const navigate = useNavigate();
  return (
    <footer className="border-t border-slate-100 bg-slate-50 mt-16">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center">
            <Ruler className="w-4 h-4 text-white" />
          </div>
          <span>© {new Date().getFullYear()} ProFinance Interior</span>
        </div>
        <div className="flex items-center gap-5">
          <button onClick={() => navigate("/blog")} className="hover:text-slate-900">Blog</button>
          <button onClick={() => navigate("/panduan")} className="hover:text-slate-900">Panduan</button>
          <button onClick={() => navigate("/")} className="hover:text-slate-900">Beranda</button>
        </div>
      </div>
    </footer>
  );
}
