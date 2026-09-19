import { useNavigate } from "react-router-dom";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Crown, Lock, Check } from "lucide-react";

export function Paywall({ testid, title, features, preview }) {
  const navigate = useNavigate();
  return (
    <div data-testid={testid} className="relative">
      {preview && (
        <div className="pointer-events-none select-none blur-[6px] opacity-50">{preview}</div>
      )}
      <div className={`${preview ? "absolute inset-0" : ""} flex items-center justify-center p-6`}>
        <Card className="max-w-md w-full p-8 text-center border-amber-200 bg-white shadow-xl">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-amber-500/30">
            <Lock className="w-7 h-7 text-white" />
          </div>
          <h3 className="font-display font-bold text-xl text-slate-900">{title}</h3>
          <p className="text-slate-500 text-sm mt-2 mb-5">Fitur ini eksklusif untuk pengguna <b className="text-amber-700">Premium</b>. Upgrade untuk membukanya.</p>
          <ul className="space-y-2.5 text-left mb-6 max-w-xs mx-auto">
            {features.map((f) => (
              <li key={f} className="flex items-start gap-2.5 text-sm text-slate-700"><Check className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />{f}</li>
            ))}
          </ul>
          <Button data-testid={`${testid}-upgrade`} onClick={() => navigate("/pricing")} className="w-full bg-amber-600 hover:bg-amber-700 text-white gap-2">
            <Crown className="w-4 h-4" /> Upgrade ke Premium
          </Button>
        </Card>
      </div>
    </div>
  );
}
