import { useEffect, useState } from "react";
import { Wifi, WifiOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function OnlineIndicator() {
  const [online, setOnline] = useState<boolean>(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [showOffline, setShowOffline] = useState(false);

  useEffect(() => {
    const onUp = () => { setOnline(true); setShowOffline(false); };
    const onDown = () => { setOnline(false); setShowOffline(true); };
    window.addEventListener("online", onUp);
    window.addEventListener("offline", onDown);
    return () => {
      window.removeEventListener("online", onUp);
      window.removeEventListener("offline", onDown);
    };
  }, []);

  // Quando volta online, mostra "online" por 2s e some
  const [pulse, setPulse] = useState(false);
  useEffect(() => {
    if (online && pulse) {
      const t = setTimeout(() => setPulse(false), 1800);
      return () => clearTimeout(t);
    }
  }, [online, pulse]);

  if (online && !showOffline) {
    return (
      <div
        className="pointer-events-none fixed bottom-2 left-2 z-40 hidden items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] text-emerald-500 sm:flex"
        title="Online"
      >
        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
        Online
      </div>
    );
  }
  return (
    <div
      className={cn(
        "fixed bottom-2 left-2 z-40 flex items-center gap-1.5 rounded-full px-3 py-1 text-xs",
        online ? "bg-emerald-500/15 text-emerald-500" : "bg-destructive/15 text-destructive",
      )}
    >
      {online ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
      {online ? "De volta online" : "Sem conexão"}
    </div>
  );
}
