import {
  lotDeepLink,
  parseLotIdFromScan,
  publicAppUrl,
} from "@/hooks/use-deep-link";
import { describe, expect, it } from "vitest";

/**
 * The QR deep-link seam.
 *
 * `LotExpandedPanel.test.tsx` proves the QR code renders the lot's deep link.
 * This file proves the other half of the journey: a scanned payload is parsed
 * back into a lot id, and a stray QR code is rejected rather than expanding a
 * nonsense block. The acceptance criteria name the QR deep link as existing
 * behavior that must survive the presentation overhaul.
 *
 * These are pure-function tests: no camera, no network, no canister.
 */
describe("QR deep-link parsing", () => {
  it("builds a deep link from the public app URL and the lot id", () => {
    const link = lotDeepLink("JOA-MFB-20260918-0047");
    expect(link).toBe(`${publicAppUrl()}?lot=JOA-MFB-20260918-0047`);
  });

  it("reads the lot id back out of a full deep link", () => {
    expect(
      parseLotIdFromScan("https://explor8.example/?lot=JOA-MFB-20260918-0047"),
    ).toBe("JOA-MFB-20260918-0047");
  });

  it("reads the lot id from a bare query fragment", () => {
    expect(parseLotIdFromScan("?lot=JOA-LUS-20260912-0003")).toBe(
      "JOA-LUS-20260912-0003",
    );
  });

  it("reads the lot id from a hash fragment", () => {
    expect(parseLotIdFromScan("#lot=JOA-MFB-20260918-0048")).toBe(
      "JOA-MFB-20260918-0048",
    );
  });

  it("accepts a bare lot id", () => {
    expect(parseLotIdFromScan("JOA-MFB-20260918-0047")).toBe(
      "JOA-MFB-20260918-0047",
    );
  });

  it("rejects a payload that carries no lot id", () => {
    expect(parseLotIdFromScan("https://example.com/")).toBeNull();
    expect(parseLotIdFromScan("")).toBeNull();
    expect(parseLotIdFromScan("   ")).toBeNull();
  });

  it("rejects a payload whose lot id is not a plausible register id", () => {
    // A stray QR code must not expand a nonsense block.
    expect(parseLotIdFromScan("hello world")).toBeNull();
    expect(parseLotIdFromScan("?lot=")).toBeNull();
  });
});
