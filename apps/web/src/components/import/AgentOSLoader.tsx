"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/contexts/LanguageContext";

export function AgentOSLoader({ className }: { className?: string }) {
  const { t } = useT();
  const MESSAGES = t.agentosLoaderMessages;
  const [elapsed, setElapsed] = useState(0);
  const [msgIndex, setMsgIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const tick = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(tick);
  }, []);

  useEffect(() => {
    if (elapsed > 0 && elapsed % 6 === 0) {
      setVisible(false);
      const t = setTimeout(() => {
        setMsgIndex((i) => (i + 1) % MESSAGES.length);
        setVisible(true);
      }, 300);
      return () => clearTimeout(t);
    }
  }, [elapsed]);

  const secs = elapsed % 60;
  const mins = Math.floor(elapsed / 60);
  const timeLabel = mins > 0 ? `${mins}:${String(secs).padStart(2, "0")}` : `${secs}s`;

  return (
    <div className={cn("flex flex-col items-center gap-4 py-8", className)}>
      <div className="relative">
        <div className="absolute inset-0 rounded-full bg-primary/10 animate-ping" />
        <div className="relative rounded-full bg-primary/10 p-3">
          <Loader2 className="h-6 w-6 text-primary animate-spin" />
        </div>
      </div>

      <p
        className={cn(
          "text-sm text-center text-muted-foreground max-w-[220px] transition-opacity duration-300",
          visible ? "opacity-100" : "opacity-0",
        )}
      >
        {MESSAGES[msgIndex]}
      </p>

      <span className="text-xs text-muted-foreground/60 tabular-nums">{timeLabel}</span>
    </div>
  );
}
