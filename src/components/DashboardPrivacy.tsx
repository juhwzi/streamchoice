"use client";

import { createContext, useContext, useState } from "react";

const PrivacyContext = createContext({ hidden: false, toggle: () => {} });

export function DashboardPrivacyProvider({ children }: { children: React.ReactNode }) {
  const [hidden, setHidden] = useState(false);

  return (
    <PrivacyContext.Provider value={{ hidden, toggle: () => setHidden((value: boolean) => !value) }}>
      {children}
    </PrivacyContext.Provider>
  );
}

export function PrivacyToggle() {
  const { hidden, toggle } = useContext(PrivacyContext);

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={hidden}
      className="inline-flex items-center gap-2 rounded-lg border border-line bg-panel px-3 py-2 text-sm font-semibold text-mute transition hover:border-kick hover:text-white"
    >
      <span aria-hidden="true">{hidden ? "◉" : "◌"}</span>
      {hidden ? "Mostrar valores" : "Esconder valores"}
    </button>
  );
}

export function PrivateValue({ children, placeholder = "••••" }: { children: React.ReactNode; placeholder?: string }) {
  const { hidden } = useContext(PrivacyContext);
  return hidden ? <span className="tracking-[0.18em] text-mute">{placeholder}</span> : <>{children}</>;
}
