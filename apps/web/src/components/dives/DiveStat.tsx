import type { ArrowDownToLine } from "lucide-react";

export const DASH = "-";

export function Stat({ icon: Icon, label, value }: { icon: typeof ArrowDownToLine; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-sm font-medium ${value === DASH ? "text-muted-foreground/50" : ""}`}>{value}</p>
      </div>
    </div>
  );
}

export function StatGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h4 className="text-sm font-medium text-muted-foreground">{label}</h4>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-5">{children}</div>
    </div>
  );
}
