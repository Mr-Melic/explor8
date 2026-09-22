import { RefKind } from "@/lib/backend";
import type { RefEntryView } from "@/lib/backend";
import {
  REF_KIND_LABEL,
  emptyReferenceIndex,
  indexReferenceEntries,
  labelFor,
} from "@/lib/reference";
import { describe, expect, it } from "vitest";

/**
 * The register's reference-data labels.
 *
 * The accepted requirement renames the site labels to 'Mining Site' /
 * 'Mining Sites'. This suite pins the two labels the reference catalogue
 * exposes and the lookup mechanism behind them: an administrator's stored
 * display name wins, and a key with no stored entry still reads as a
 * humanized token rather than a raw snake_case key.
 *
 * These are pure functions over local data, so this proves the frontend's
 * labelling contract, never the canister.
 */

function entry(
  kind: RefKind,
  key: string,
  displayName: string,
  sortOrder = 1n,
): RefEntryView {
  return {
    id: `ref-${kind}-${key}`,
    kind,
    key,
    displayName,
    value: key,
    sortOrder,
    active: true,
  };
}

describe("Reference labels", () => {
  it("labels the site reference kind 'Mining Sites'", () => {
    expect(REF_KIND_LABEL[RefKind.site]).toBe("Mining Sites");
  });

  it("keeps the other reference-kind headings unchanged", () => {
    // The rename touched only the site label; the rest must not drift.
    expect(REF_KIND_LABEL[RefKind.lot_kind]).toBe("Item kinds");
    expect(REF_KIND_LABEL[RefKind.status]).toBe("Statuses");
    expect(REF_KIND_LABEL[RefKind.event_kind]).toBe("Event kinds");
    expect(REF_KIND_LABEL[RefKind.caption]).toBe("Captions");
    expect(REF_KIND_LABEL[RefKind.form_default]).toBe("Form defaults");
  });

  it("prefers an administrator's stored display name for a site key", () => {
    const index = indexReferenceEntries([
      entry(RefKind.site, "KFB", "Kansanshi Field Base"),
    ]);

    expect(labelFor(index, RefKind.site, "KFB")).toBe("Kansanshi Field Base");
  });

  it("humanizes a site key the catalogue does not carry", () => {
    const index = emptyReferenceIndex();

    // No stored entry: the raw key is humanized, never shown as snake_case.
    expect(labelFor(index, RefKind.site, "field_base")).toBe("Field Base");
  });
});
