import { useCallback, useEffect, useState } from "react";

/** The public URL of the app, without any query string or hash. */
export function publicAppUrl(): string {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}`;
}

/** The deep link a QR code encodes: the public app URL plus `?lot=<id>`. */
export function lotDeepLink(lotId: string): string {
  const base = publicAppUrl();
  return `${base}?lot=${encodeURIComponent(lotId)}`;
}

/**
 * Extract a lot id from a scanned QR payload.
 *
 * The payload may be a full deep link (`https://…/?lot=JOA-…`), a bare
 * `?lot=…` fragment, or just the lot id itself. Anything else is rejected so a
 * stray QR code cannot expand a nonsense block.
 */
export function parseLotIdFromScan(payload: string): string | null {
  const raw = payload.trim();
  if (!raw) return null;

  const fromQuery = (value: string): string | null => {
    const queryStart = value.indexOf("?");
    if (queryStart === -1) return null;
    const params = new URLSearchParams(value.slice(queryStart + 1));
    const lot = params.get("lot");
    return lot?.trim() ? lot.trim() : null;
  };

  const fromHash = (value: string): string | null => {
    const hashStart = value.indexOf("#");
    if (hashStart === -1) return null;
    const fragment = value.slice(hashStart + 1);
    const lotMatch = /(?:^|[?&])lot=([^&]+)/.exec(fragment);
    return lotMatch ? decodeURIComponent(lotMatch[1]).trim() : null;
  };

  if (raw.startsWith("http://") || raw.startsWith("https://")) {
    return fromQuery(raw) ?? fromHash(raw);
  }
  if (raw.startsWith("?") || raw.includes("?lot=")) {
    return fromQuery(raw);
  }
  if (raw.startsWith("#")) {
    return fromHash(raw);
  }

  // A bare lot id: the register's ids are short, uppercase and hyphenated.
  return /^[A-Za-z0-9][A-Za-z0-9._-]{2,63}$/.test(raw) ? raw : null;
}

/**
 * Keep the expanded block in step with the `?lot=` deep link.
 *
 * On first load the hook reads `?lot=` (or a `#lot=` fragment) and reports it
 * so the library can expand that block for a guest who never signed in. It
 * also listens for back/forward navigation so a shared link stays honest.
 */
export function useDeepLink(onLotRequested: (lotId: string) => void) {
  const [requestedLot, setRequestedLot] = useState<string | null>(null);

  const read = useCallback((): string | null => {
    if (typeof window === "undefined") return null;
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("lot");
    if (fromQuery?.trim()) return fromQuery.trim();

    const fragment = window.location.hash.replace(/^#/, "");
    const match = /(?:^|[?&])lot=([^&]+)/.exec(fragment);
    return match ? decodeURIComponent(match[1]).trim() : null;
  }, []);

  useEffect(() => {
    const initial = read();
    if (initial) {
      setRequestedLot(initial);
      onLotRequested(initial);
    }

    const handleNavigation = () => {
      const next = read();
      setRequestedLot(next);
      if (next) onLotRequested(next);
    };

    window.addEventListener("popstate", handleNavigation);
    window.addEventListener("hashchange", handleNavigation);
    return () => {
      window.removeEventListener("popstate", handleNavigation);
      window.removeEventListener("hashchange", handleNavigation);
    };
  }, [read, onLotRequested]);

  return { requestedLot };
}
