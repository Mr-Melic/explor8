import { useDataMode } from "@/hooks/use-data-mode";
import { type UploadedFile, useFileUpload } from "@/hooks/use-file-upload";
import { useReferenceData } from "@/hooks/use-reference-data";
import { useRegisterLot, useSuggestLotId } from "@/hooks/use-register";
import type { NewLotInput } from "@/lib/backend";
import { toIsoDate } from "@/lib/format";
import { useCallback, useEffect, useState } from "react";

/** Fallback licence reference, used until the reference catalogue resolves. */
export const DEFAULT_LICENCE = "44287-HQ-LEL";
/** Fallback project, used until the reference catalogue resolves. */
export const DEFAULT_PROJECT = "Mufumbwe / Kikonge";

/**
 * The three-photo pattern the register asks for on a new lot.
 *
 * The pattern is guidance, not a gate: only the first photo is required, and
 * only for the kinds the register treats as physical material.
 */
export const PHOTO_PATTERN = [
  "Working face",
  "Material",
  "Sealed bag with tag visible",
] as const;

export interface RegisterLotDraft {
  lotType: string;
  site: string;
  date: string;
  id: string;
  licence: string;
  project: string;
  gps: string;
  workingRef: string;
  grossG: string;
  sealNo: string;
}

export interface RegisterLotFieldErrors {
  id?: string;
  licence?: string;
  project?: string;
  grossG?: string;
  sealNo?: string;
  photos?: string;
}

function todayIso(): string {
  return toIsoDate(new Date());
}

function initialDraft(
  lotType: string,
  site: string,
  licence: string,
  project: string,
): RegisterLotDraft {
  return {
    lotType,
    site,
    date: todayIso(),
    id: "",
    licence,
    project,
    gps: "",
    workingRef: "",
    grossG: "",
    sealNo: "",
  };
}

/**
 * Owns the register-lot draft, the auto-suggested id, validation and submit.
 *
 * The draft is local UI state: it survives a failed submit so the operator
 * never retypes a field, and it is only cleared once the lot is sealed. The
 * item kinds, sites and defaults come from the admin-managed reference
 * catalogue, so the form follows the register's own configuration.
 */
export function useRegisterLotForm() {
  const { optionsFor, valueFor, isLoading } = useReferenceData();
  const { mode, registerDemoLot } = useDataMode();
  const isDemo = mode === "demo";

  const kindOptions = optionsFor("lot_kind");
  const siteOptions = optionsFor("site");
  const licenceDefault = valueFor("form_default", "licence") ?? DEFAULT_LICENCE;
  const projectDefault = valueFor("form_default", "project") ?? DEFAULT_PROJECT;

  const [draft, setDraft] = useState<RegisterLotDraft>(() =>
    initialDraft(
      kindOptions[0]?.value ?? "emerald",
      siteOptions[0]?.value ?? "MFB",
      licenceDefault,
      projectDefault,
    ),
  );
  const [idEdited, setIdEdited] = useState(false);
  const [errors, setErrors] = useState<RegisterLotFieldErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [createdId, setCreatedId] = useState<string | null>(null);

  const upload = useFileUpload();
  const registerLot = useRegisterLot();
  const suggestion = useSuggestLotId(draft.site, draft.date);

  // Seed the draft from the catalogue once it resolves, without ever
  // overwriting a value the operator has already typed. The dependency list
  // holds primitives, not the option arrays: `optionsFor` rebuilds its array
  // on every render, so depending on it would loop forever.
  const firstKind = kindOptions[0]?.value ?? "";
  const firstSite = siteOptions[0]?.value ?? "";
  const hasKind = kindOptions.some((option) => option.value === draft.lotType);
  const hasSite = siteOptions.some((option) => option.value === draft.site);

  useEffect(() => {
    if (isLoading) return;
    setDraft((current) => ({
      ...current,
      lotType: hasKind ? current.lotType : firstKind || current.lotType,
      site: hasSite ? current.site : firstSite || current.site,
      licence: current.licence || licenceDefault,
      project: current.project || projectDefault,
    }));
  }, [
    isLoading,
    hasKind,
    hasSite,
    firstKind,
    firstSite,
    licenceDefault,
    projectDefault,
  ]);

  // The suggested id fills the field until the operator edits it themselves.
  useEffect(() => {
    if (idEdited) return;
    if (suggestion.data) {
      setDraft((current) => ({ ...current, id: suggestion.data ?? "" }));
    }
  }, [suggestion.data, idEdited]);

  const setField = useCallback(
    <K extends keyof RegisterLotDraft>(key: K, value: RegisterLotDraft[K]) => {
      setDraft((current) => ({ ...current, [key]: value }));
      if (key === "id") setIdEdited(true);
      setErrors((current) => ({ ...current, [key]: undefined }));
    },
    [],
  );

  const setSite = useCallback((site: string) => {
    setIdEdited(false);
    setDraft((current) => ({ ...current, site }));
  }, []);

  const setDate = useCallback((date: string) => {
    setIdEdited(false);
    setDraft((current) => ({ ...current, date }));
  }, []);

  const setLotType = useCallback((lotType: string) => {
    setDraft((current) => ({ ...current, lotType }));
    setErrors((current) => ({ ...current, photos: undefined }));
  }, []);

  // Only the physical-material kinds require a photo; the catalogue decides
  // which kinds those are, so a new kind is never silently gated.
  const photoRequired = draft.lotType !== "emerald";
  const photoCount = upload.files.length;
  const photoWarning =
    photoRequired && photoCount > 0 && photoCount < PHOTO_PATTERN.length;

  const validate = useCallback((): RegisterLotFieldErrors => {
    const next: RegisterLotFieldErrors = {};
    if (!draft.id.trim()) next.id = "A lot id is required.";
    else if (!/^JOA-[A-Z0-9]{3}-\d{8}-\d{4}$/.test(draft.id.trim())) {
      next.id = "Use the format JOA-<SITE>-YYYYMMDD-<NNNN>.";
    }
    if (!draft.licence.trim())
      next.licence = "A licence reference is required.";
    if (!draft.project.trim()) next.project = "A project is required.";
    if (!draft.grossG.trim()) next.grossG = "Gross weight is required.";
    else if (!Number.isFinite(Number(draft.grossG)))
      next.grossG = "Gross weight must be a number of grams.";
    if (!draft.sealNo.trim()) next.sealNo = "A seal number is required.";
    if (photoRequired && photoCount === 0) {
      next.photos = "At least one photo is required for this item kind.";
    }
    return next;
  }, [draft, photoRequired, photoCount]);

  const submit = useCallback(async () => {
    setSubmitError(null);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return null;

    // Demo mode is simulated entirely in the browser: the lot is composed from
    // the draft and held in memory, never uploaded and never written to the
    // register. The same draft-reset contract applies as a real seal.
    if (isDemo) {
      const lotId = registerDemoLot({
        id: draft.id.trim(),
        lotType: draft.lotType,
        site: draft.site,
        licence: draft.licence.trim(),
        project: draft.project.trim(),
        gps: draft.gps.trim(),
        workingRef: draft.workingRef.trim(),
        grossG: draft.grossG.trim(),
        sealNo: draft.sealNo.trim(),
      });
      if (!lotId) {
        setSubmitError(
          "Demo registration is only available in Demo-data mode.",
        );
        return null;
      }
      setCreatedId(lotId);
      setDraft(
        initialDraft(
          firstKind || draft.lotType,
          firstSite || draft.site,
          licenceDefault,
          projectDefault,
        ),
      );
      setIdEdited(false);
      upload.clear();
      return lotId;
    }

    try {
      const uploaded: UploadedFile[] = await upload.uploadAll();
      const input: NewLotInput = {
        gps: draft.gps.trim(),
        grossG: draft.grossG.trim(),
        workingRef: draft.workingRef.trim(),
        site: draft.site as NewLotInput["site"],
        sealNo: draft.sealNo.trim(),
        fileHashes: uploaded.map((item) => ({
          fileId: item.fileId,
          contentHash: item.contentHash,
        })),
        photoFileIds: uploaded.map((item) => item.fileId),
        licence: draft.licence.trim(),
        lotType: draft.lotType as NewLotInput["lotType"],
        project: draft.project.trim(),
        fileIds: uploaded.map((item) => item.fileId),
      };

      const result = await registerLot.mutateAsync(input);
      if (result.__kind__ === "err") {
        setSubmitError(describeRegisterError(result.err));
        return null;
      }

      const lotId = result.ok.id;
      setCreatedId(lotId);
      setDraft(
        initialDraft(
          firstKind || draft.lotType,
          firstSite || draft.site,
          licenceDefault,
          projectDefault,
        ),
      );
      setIdEdited(false);
      upload.clear();
      return lotId;
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : "The lot could not be registered.",
      );
      return null;
    }
  }, [
    draft,
    registerLot,
    upload,
    validate,
    firstKind,
    firstSite,
    licenceDefault,
    projectDefault,
    isDemo,
    registerDemoLot,
  ]);

  const reset = useCallback(() => {
    setDraft(
      initialDraft(
        firstKind || "emerald",
        firstSite || "MFB",
        licenceDefault,
        projectDefault,
      ),
    );
    setIdEdited(false);
    setErrors({});
    setSubmitError(null);
    setCreatedId(null);
    upload.clear();
  }, [upload, firstKind, firstSite, licenceDefault, projectDefault]);

  return {
    draft,
    setField,
    setSite,
    setDate,
    setLotType,
    errors,
    submitError,
    createdId,
    photoRequired,
    photoCount,
    photoWarning,
    upload,
    submit,
    reset,
    isSubmitting: registerLot.isPending || upload.uploading,
    isSuggestingId: suggestion.isFetching,
  };
}

/** Turn a backend register error into operator-facing copy. */
export function describeRegisterError(error: {
  __kind__: string;
  [key: string]: unknown;
}): string {
  switch (error.__kind__) {
    case "duplicateLot":
      return `Lot ${String(error.duplicateLot)} already exists in the register.`;
    case "notAuthorized":
      return "Your role cannot register lots.";
    case "notAuthenticated":
      return "Sign in with Internet Identity to register a lot.";
    case "invalidInput":
      return String(error.invalidInput);
    case "unknownLot":
      return `Lot ${String(error.unknownLot)} is not in the register.`;
    case "lotFrozen":
      return `Lot ${String(error.lotFrozen)} is frozen and cannot change.`;
    default:
      return "The register rejected this request.";
  }
}
