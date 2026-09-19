import { healthStatus } from "@/lib/format";
import { Activity } from "lucide-react";

export function HealthBadge({ marginPct, size = "md", showIcon = true }) {
  const s = healthStatus(marginPct);
  const pad = size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs";
  return (
    <span
      data-testid="project-margin-badge"
      className={`inline-flex items-center gap-1 rounded-full font-semibold ${pad}`}
      style={{ backgroundColor: s.bg, color: s.text }}
    >
      {showIcon && <Activity className="w-3 h-3" style={{ color: s.color }} />}
      {s.label} · {Number(marginPct).toFixed(1)}%
    </span>
  );
}
