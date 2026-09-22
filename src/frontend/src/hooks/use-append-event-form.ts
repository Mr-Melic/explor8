import { type UploadedFile, useFileUpload } from "@/hooks/use-file-upload";
import {
  useAppendEvent,
  useMergeLots,
  useSplitLot,
} from "@/hooks/use-register";
import {
  EventKind,
  type LotView,
  type MergeInput,
  type NewEventInput,
  type NewLotInput,
  type SplitInput,
} from "@/lib/backend";
import { useCallback, useMemo, useState } from "react";

/** The event kinds an officer can append, in register order. */
export const APPENDABLE_KINDS: EventKind[] = [
  EventKind.photo,
  EventKind.weighed,
  EventKind.sealed,
  EventKind.moved,
  EventKind.assay,
  EventKind.split,
  EventKind.merge,
  EventKind.cut,
  EventKind.retail,
  EventKind.correction,
  EventKind.note,
];

export interface AppendEventDraft {
  kind: EventKind;
  /** photo */
  caption: string;
  /** weighed / merge */
  grams: string;
  /** sealed */
  sealNo: string;
  /** moved */
  fromPlace: string;
  toPlace: string;
  /** assay */
  labName: string;
  method: string;
  auGrade: string;
  certificateNo: string;
  /** split */
  childIds: string;
  childWeights: string;
  /** merge */
  sourceIds: string;
  /** cut / retail */
  description: string;
  buyerRef: string;
  /** correction */
  correctionSeq: string;
  correctionField: string;
  correctionOld: string;
  correctionNew: string;
  correctionReason: string;
  /** note */
  note: string;
}

function initialDraft(): AppendEventDraft {
  return {
    kind: EventKind.photo,
    caption: "",
    grams: "",
    sealNo: "",
    fromPlace: "",
    toPlace: "",
    labName: "",
    method: "",
    auGrade: "",
    certificateNo: "",
    childIds: "",
    childWeights: "",
    sourceIds: "",
    description: "",
    buyerRef: "private buyer",
    correctionSeq: "",
    correctionField: "",
    correctionOld: "",
    correctionNew: "",
    correctionReason: "",
    note: "",
  };
}

/**
 * The status a lot moves to after a given event kind, if any.
 *
 * Mirrors the backend's `statusAfter`: only `moved`, `assay` and `retail`
 * change the status — `cut` and every other kind leave it unchanged.
 */
export function statusAfterKind(kind: EventKind): string | null {
  switch (kind) {
    case EventKind.moved:
      return "in_transit";
    case EventKind.assay:
      return "assayed";
    case EventKind.retail:
      return "retailed";
    default:
      return null;
  }
}

/**
 * Owns the append-event draft for one lot.
 *
 * Split and merge are structural: split also creates the child lot records,
 * merge appends on the destination and a note on each source. Sources are
 * never deleted — the register is append-only.
 */
export function useAppendEventForm(lot: LotView) {
  const [draft, setDraft] = useState<AppendEventDraft>(initialDraft);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const upload = useFileUpload();
  const appendEvent = useAppendEvent();
  const splitLot = useSplitLot();
  const mergeLots = useMergeLots();

  const setField = useCallback(
    <K extends keyof AppendEventDraft>(key: K, value: AppendEventDraft[K]) => {
      setDraft((current) => ({ ...current, [key]: value }));
      setError(null);
      setSuccess(null);
    },
    [],
  );

  const setKind = useCallback((kind: EventKind) => {
    setDraft((current) => ({
      ...initialDraft(),
      kind,
      buyerRef: current.buyerRef,
    }));
    setError(null);
    setSuccess(null);
  }, []);

  /** Prefill the correction fields from the event being corrected. */
  const prefillCorrection = useCallback(
    (seq: bigint, field: string, oldValue: string) => {
      setDraft((current) => ({
        ...current,
        kind: EventKind.correction,
        correctionSeq: seq.toString(),
        correctionField: field,
        correctionOld: oldValue,
      }));
      setError(null);
      setSuccess(null);
    },
    [],
  );

  const childIds = useMemo(
    () =>
      draft.childIds
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    [draft.childIds],
  );

  const childWeights = useMemo(
    () =>
      draft.childWeights
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    [draft.childWeights],
  );

  const sourceIds = useMemo(
    () =>
      draft.sourceIds
        .split(",")
        .map((value) => value.trim())
        .filter(Boolean),
    [draft.sourceIds],
  );

  const submit = useCallback(async () => {
    setError(null);
    setSuccess(null);

    try {
      if (draft.kind === EventKind.split) {
        return await submitSplit();
      }
      if (draft.kind === EventKind.merge) {
        return await submitMerge();
      }
      return await submitEvent();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The event could not be appended.",
      );
      return null;
    }

    async function submitEvent(): Promise<string | null> {
      const payload = buildPayload(draft);
      if (payload === null) {
        setError("Complete the fields for this event kind.");
        return null;
      }

      let uploaded: UploadedFile[] = [];
      if (draft.kind === EventKind.photo || draft.kind === EventKind.assay) {
        uploaded = await upload.uploadAll();
      }

      const input: NewEventInput = {
        kind: draft.kind,
        fileHashes: uploaded.map((item) => ({
          fileId: item.fileId,
          contentHash: item.contentHash,
        })),
        payload,
        fileIds: uploaded.map((item) => item.fileId),
      };

      const result = await appendEvent.mutateAsync({ lotId: lot.id, input });
      if (result.__kind__ === "err") {
        setError(describeAppendError(result.err));
        return null;
      }

      setDraft(initialDraft());
      upload.clear();
      setSuccess(`Event appended to ${lot.id}.`);
      return lot.id;
    }

    async function submitSplit(): Promise<string | null> {
      if (childIds.length === 0) {
        setError("Add at least one child lot id.");
        return null;
      }
      if (childWeights.length !== childIds.length) {
        setError("Give one weight for each child lot id.");
        return null;
      }

      const children: NewLotInput[] = childIds.map((childId, index) => ({
        gps: lot.gps,
        grossG: childWeights[index] ?? "",
        workingRef: lot.workingRef,
        site: siteFromId(childId) ?? siteFromId(lot.id) ?? lotSiteFallback(),
        sealNo: lot.sealNo,
        fileHashes: [],
        photoFileIds: [],
        licence: lot.licence,
        lotType: lot.lotType,
        project: lot.project,
        fileIds: [],
      }));

      const input: SplitInput = { children, parentId: lot.id };
      const result = await splitLot.mutateAsync(input);
      if (result.__kind__ === "err") {
        setError(describeAppendError(result.err));
        return null;
      }

      setDraft(initialDraft());
      setSuccess(`Split recorded — ${children.length} child lots created.`);
      return lot.id;
    }

    async function submitMerge(): Promise<string | null> {
      if (sourceIds.length === 0) {
        setError("Add at least one source lot id.");
        return null;
      }
      if (!draft.grams.trim()) {
        setError("Enter the combined weight.");
        return null;
      }

      const payload = `merged ${sourceIds.join(", ")} · combined ${draft.grams.trim()} g`;
      const input: MergeInput = {
        destinationId: lot.id,
        sourceId: sourceIds[0],
        payload,
      };

      const result = await mergeLots.mutateAsync(input);
      if (result.__kind__ === "err") {
        setError(describeAppendError(result.err));
        return null;
      }

      setDraft(initialDraft());
      setSuccess(`Merge recorded into ${lot.id}.`);
      return lot.id;
    }
  }, [
    draft,
    lot,
    appendEvent,
    splitLot,
    mergeLots,
    upload,
    childIds,
    childWeights,
    sourceIds,
  ]);

  const reset = useCallback(() => {
    setDraft(initialDraft());
    setError(null);
    setSuccess(null);
    upload.clear();
  }, [upload]);

  return {
    draft,
    setField,
    setKind,
    prefillCorrection,
    childIds,
    childWeights,
    sourceIds,
    error,
    success,
    upload,
    submit,
    reset,
    isSubmitting:
      appendEvent.isPending || splitLot.isPending || mergeLots.isPending,
  };
}

/** Build the canonical payload string for a simple event kind. */
function buildPayload(draft: AppendEventDraft): string | null {
  switch (draft.kind) {
    case EventKind.photo:
      return draft.caption.trim() || "photo attached";
    case EventKind.weighed:
      return draft.grams.trim() ? `weighed ${draft.grams.trim()} g` : null;
    case EventKind.sealed:
      return draft.sealNo.trim() ? `sealed ${draft.sealNo.trim()}` : null;
    case EventKind.moved:
      return draft.fromPlace.trim() && draft.toPlace.trim()
        ? `moved ${draft.fromPlace.trim()} → ${draft.toPlace.trim()}`
        : null;
    case EventKind.assay:
      return draft.labName.trim() && draft.auGrade.trim()
        ? [
            `lab ${draft.labName.trim()}`,
            draft.method.trim() ? `method ${draft.method.trim()}` : null,
            `Au ${draft.auGrade.trim()}`,
            draft.certificateNo.trim()
              ? `certificate ${draft.certificateNo.trim()}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")
        : null;
    case EventKind.cut:
    case EventKind.retail:
      return draft.description.trim()
        ? `${draft.description.trim()} · buyer ${draft.buyerRef.trim() || "private buyer"}`
        : null;
    case EventKind.correction:
      return draft.correctionSeq.trim() &&
        draft.correctionField.trim() &&
        draft.correctionNew.trim() &&
        draft.correctionReason.trim()
        ? `corrects #${draft.correctionSeq.trim()} · ${draft.correctionField.trim()}: “${draft.correctionOld.trim()}” → “${draft.correctionNew.trim()}” · reason ${draft.correctionReason.trim()}`
        : null;
    case EventKind.note:
      return draft.note.trim() || null;
    default:
      return null;
  }
}

/** Recover the site code from a lot id, e.g. `JOA-MFB-…` → `MFB`. */
function siteFromId(id: string): NewLotInput["site"] | null {
  const match = /^JOA-(MFB|LUS|KFB)-/.exec(id.trim());
  if (!match) return null;
  return match[1] as NewLotInput["site"];
}

function lotSiteFallback(): NewLotInput["site"] {
  return "MFB" as NewLotInput["site"];
}

/** Turn a backend register error into operator-facing copy. */
export function describeAppendError(error: {
  __kind__: string;
  [key: string]: unknown;
}): string {
  switch (error.__kind__) {
    case "duplicateLot":
      return `Lot ${String(error.duplicateLot)} already exists in the register.`;
    case "notAuthorized":
      return "Your role cannot append this event.";
    case "notAuthenticated":
      return "Sign in with Internet Identity to append an event.";
    case "invalidInput":
      return String(error.invalidInput);
    case "unknownLot":
      return `Lot ${String(error.unknownLot)} is not in the register.`;
    case "lotFrozen":
      return `Lot ${String(error.lotFrozen)} is frozen and cannot change.`;
    default:
      return "The register rejected this event.";
  }
}
