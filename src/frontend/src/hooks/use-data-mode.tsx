import type { EventKind, LotView, RegisterSummary } from "@/lib/backend";
import {
  appendDemoEvent,
  buildDemoLot,
  generateDemoLots,
  summarizeDemoLots,
} from "@/lib/demo-data";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { ReactNode } from "react";

/**
 * Which register the library is showing.
 *
 * `live` is the canister's own append-only register. `demo` is a large random
 * dataset generated in the browser so a reader can see the register's shape
 * before any real lot is sealed. Demo data is never written to storage and
 * never reaches the canister.
 */
export type DataMode = "live" | "demo";

const STORAGE_KEY = "explor8-data-mode";

function readStoredMode(): DataMode {
  if (typeof window === "undefined") return "live";
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "demo"
      ? "demo"
      : "live";
  } catch {
    return "live";
  }
}

/** The draft a demo-mode registration is composed from. */
export interface DemoLotDraft {
  id: string;
  lotType: string;
  site: string;
  licence: string;
  project: string;
  gps: string;
  workingRef: string;
  grossG: string;
  sealNo: string;
}

interface DataModeContextValue {
  mode: DataMode;
  setMode: (mode: DataMode) => void;
  /** The current demo register, or `null` while in live mode. */
  demoLots: LotView[] | null;
  /** The demo register's summary, or `null` while in live mode. */
  demoSummary: RegisterSummary | null;
  /**
   * Register a lot in the browser-held demo register. Returns the new lot id,
   * or `null` when the app is not in demo mode. Nothing is persisted.
   */
  registerDemoLot: (draft: DemoLotDraft) => string | null;
  /**
   * Append a simulated event to a demo lot. Returns the updated lot, or `null`
   * when the app is not in demo mode or the lot is unknown.
   */
  appendDemoEventToLot: (
    lotId: string,
    input: { kind: EventKind; payload: string },
  ) => LotView | null;
}

const DataModeContext = createContext<DataModeContextValue | null>(null);

/**
 * Owns the live/demo switch for the whole app.
 *
 * The selected mode persists across a refresh. Switching into demo mode
 * generates a fresh random dataset every time, so the register never looks
 * like the same seeded sample twice.
 *
 * Demo registration and event appending are simulated entirely in memory: the
 * demo register is browser-only state, so a lot registered in demo mode never
 * reaches the canister and disappears when the reader returns to Real-time.
 */
export function DataModeProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<DataMode>(readStoredMode);
  const [demoLots, setDemoLots] = useState<LotView[] | null>(null);

  const setMode = useCallback((next: DataMode) => {
    setModeState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // A blocked storage write must not break the switch itself.
    }
  }, []);

  // Generate a fresh dataset on every entry into demo mode, and drop it when
  // the reader returns to the live register.
  useEffect(() => {
    if (mode !== "demo") {
      setDemoLots(null);
      return;
    }
    setDemoLots(generateDemoLots());
  }, [mode]);

  const registerDemoLot = useCallback(
    (draft: DemoLotDraft): string | null => {
      if (mode !== "demo") return null;
      const lot = buildDemoLot(draft);
      setDemoLots((current) => [lot, ...(current ?? [])]);
      return lot.id;
    },
    [mode],
  );

  const appendDemoEventToLot = useCallback(
    (
      lotId: string,
      input: { kind: EventKind; payload: string },
    ): LotView | null => {
      if (mode !== "demo") return null;
      let updated: LotView | null = null;
      setDemoLots((current) => {
        if (!current) return current;
        return current.map((lot) => {
          if (lot.id !== lotId) return lot;
          updated = appendDemoEvent(lot, input);
          return updated;
        });
      });
      return updated;
    },
    [mode],
  );

  const demoSummary = useMemo(
    () => (demoLots ? summarizeDemoLots(demoLots) : null),
    [demoLots],
  );

  const value = useMemo<DataModeContextValue>(
    () => ({
      mode,
      setMode,
      demoLots,
      demoSummary,
      registerDemoLot,
      appendDemoEventToLot,
    }),
    [
      mode,
      setMode,
      demoLots,
      demoSummary,
      registerDemoLot,
      appendDemoEventToLot,
    ],
  );

  return (
    <DataModeContext.Provider value={value}>
      {children}
    </DataModeContext.Provider>
  );
}

/** Read the active data mode. Throws outside the provider. */
export function useDataMode(): DataModeContextValue {
  const context = useContext(DataModeContext);
  if (!context) {
    throw new Error("useDataMode must be used inside a DataModeProvider");
  }
  return context;
}
