import React, { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

interface ToastItem {
  id: number;
  text: string;
  tone?: "tech" | "danger" | "nature";
}

interface ToastApi {
  push: (text: string, tone?: ToastItem["tone"]) => void;
}

const ToastCtx = createContext<ToastApi>({ push: () => undefined });

let nextId = 1;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const push = useCallback((text: string, tone?: ToastItem["tone"]) => {
    const id = nextId++;
    setItems((prev) => [...prev.slice(-4), { id, text, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 5200);
  }, []);

  const api = useMemo(() => ({ push }), [push]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      <div className="pb-toast-host">
        {items.map((t) => (
          <div key={t.id} className="pb-toast" style={t.tone === "danger" ? { borderColor: "rgba(244,63,94,.5)" } : t.tone === "nature" ? { borderColor: "rgba(52,211,153,.5)" } : undefined}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export function useToast(): ToastApi {
  return useContext(ToastCtx);
}
