import { Capability, LotStatus, Role } from "@/lib/backend";

/** What the signed-in principal is allowed to see and do. */
export interface RoleCapabilities {
  /** The raw role, or `null` when the principal has no role yet. */
  role: Role | null;
  /** Signed in with a non-anonymous Internet Identity. */
  isAuthenticated: boolean;
  /** Signed in but the register has not assigned a role yet. */
  awaitingRole: boolean;
  /** May register lots, append events, split and merge. */
  canWrite: boolean;
  /** May freeze lots and assign roles. */
  canAdminister: boolean;
  /** May append assay and weighing events. */
  canAssay: boolean;
  /** May append retail and movement events. */
  canRetail: boolean;
  /** Human-readable role label for the header. */
  label: string;
}

/**
 * Local fallback labels for the register's roles.
 *
 * The backend's `roleDisplayName` is the authority — an administrator can
 * rename a role there — so these are only used before that query resolves or
 * when it is unavailable. `assayer` reads "Quality Tester" and `workshop`
 * reads "Custom Role".
 */
const ROLE_LABELS: Record<Role, string> = {
  [Role.admin]: "Register administrator",
  [Role.assayer]: "Quality Tester",
  [Role.field_officer]: "Field officer",
  [Role.workshop]: "Custom Role",
  [Role.guest]: "Guest reader",
};

const WRITING_ROLES: Role[] = [
  Role.admin,
  Role.field_officer,
  Role.assayer,
  Role.workshop,
];

/**
 * Map a signed-in role to the surfaces the UI may show.
 *
 * A signed-in principal with no role is a real state — the register shows
 * "waiting for admin to assign a role" rather than an error.
 */
export function resolveCapabilities(
  role: Role | null,
  isAuthenticated: boolean,
): RoleCapabilities {
  const awaitingRole = isAuthenticated && role === null;
  const effective = role ?? null;

  return {
    role: effective,
    isAuthenticated,
    awaitingRole,
    canWrite: effective !== null && WRITING_ROLES.includes(effective),
    canAdminister: effective === Role.admin,
    canAssay: effective === Role.admin || effective === Role.assayer,
    canRetail:
      effective === Role.admin ||
      effective === Role.workshop ||
      effective === Role.field_officer,
    label: effective ? ROLE_LABELS[effective] : "Not signed in",
  };
}

/** Every role the register recognises, in descending authority. */
export const ASSIGNABLE_ROLES: Role[] = [
  Role.admin,
  Role.field_officer,
  Role.assayer,
  Role.workshop,
  Role.guest,
];

/** Human-readable fallback label for a role value. */
export function roleLabel(role: Role): string {
  return ROLE_LABELS[role];
}

/**
 * Human-readable label for a capability.
 *
 * The permissions section renders one row per capability, so the label is the
 * single source of truth for how a capability reads in the admin panel.
 */
export const CAPABILITY_LABELS: Record<Capability, string> = {
  [Capability.create_lot]: "Register a lot",
  [Capability.append_event]: "Append a provenance event",
  [Capability.change_status]: "Change a lot's status",
  [Capability.split_lot]: "Split a lot",
  [Capability.merge_lot]: "Merge lots",
  [Capability.freeze_lot]: "Seal (freeze) a lot",
  [Capability.delete_lot]: "Delete a block",
  [Capability.manage_roles]: "Manage roles and access",
  [Capability.manage_reference_data]: "Manage reference data",
  [Capability.manage_analysis_documents]: "Manage analysis documents",
  [Capability.view_analytics]: "View register analytics",
  [Capability.purge_register]: "Purge all register data",
};

/** Every capability, in the order the permissions section lists them. */
export const ALL_CAPABILITIES: Capability[] = [
  Capability.create_lot,
  Capability.append_event,
  Capability.change_status,
  Capability.split_lot,
  Capability.merge_lot,
  Capability.freeze_lot,
  Capability.delete_lot,
  Capability.manage_roles,
  Capability.manage_reference_data,
  Capability.manage_analysis_documents,
  Capability.view_analytics,
  Capability.purge_register,
];

/** Human-readable label for a capability value. */
export function capabilityLabel(capability: Capability): string {
  return CAPABILITY_LABELS[capability] ?? capability;
}

/** Every status a lot can hold, in the order the register lists them. */
const ALL_STATUSES: LotStatus[] = [
  LotStatus.open,
  LotStatus.assayed,
  LotStatus.in_transit,
  LotStatus.closed,
  LotStatus.retailed,
  LotStatus.frozen,
];

/**
 * The status transitions a role may make.
 *
 * The register records every status change as a provenance event, and the
 * backend's `canTransition` (lib/register.mo) is the authority for which
 * transitions a role may perform. This map mirrors that rule exactly so the
 * status-history UI only offers transitions the caller can actually make:
 *
 * - `admin` may make any transition.
 * - `assayer` (Quality Tester) may move `open` or `in_transit` to `assayed`.
 * - `workshop` (Custom Role) may move `assayed` to `closed`, `retailed` or
 *   `frozen`.
 * - `field_officer` and `guest` may make no transition.
 */
const TRANSITIONS_BY_ROLE: Record<
  Role,
  Partial<Record<LotStatus, LotStatus[]>>
> = {
  [Role.admin]: {
    [LotStatus.open]: ALL_STATUSES.filter((to) => to !== LotStatus.open),
    [LotStatus.assayed]: ALL_STATUSES.filter((to) => to !== LotStatus.assayed),
    [LotStatus.in_transit]: ALL_STATUSES.filter(
      (to) => to !== LotStatus.in_transit,
    ),
    [LotStatus.closed]: ALL_STATUSES.filter((to) => to !== LotStatus.closed),
    [LotStatus.retailed]: ALL_STATUSES.filter(
      (to) => to !== LotStatus.retailed,
    ),
    [LotStatus.frozen]: ALL_STATUSES.filter((to) => to !== LotStatus.frozen),
  },
  [Role.assayer]: {
    [LotStatus.open]: [LotStatus.assayed],
    [LotStatus.in_transit]: [LotStatus.assayed],
  },
  [Role.field_officer]: {},
  [Role.workshop]: {
    [LotStatus.assayed]: [
      LotStatus.closed,
      LotStatus.retailed,
      LotStatus.frozen,
    ],
  },
  [Role.guest]: {},
};

/**
 * The statuses a role may move a lot to from its current status.
 *
 * Returns an empty array when the role may not change the status at all, so a
 * caller can render the control disabled rather than hiding it.
 */
export function allowedTransitions(
  role: Role | null,
  from: LotStatus,
): LotStatus[] {
  if (role === null) return [];
  return TRANSITIONS_BY_ROLE[role]?.[from] ?? [];
}

/** Whether a role may move a lot from one status to another. */
export function canTransition(
  role: Role | null,
  from: LotStatus,
  to: LotStatus,
): boolean {
  return allowedTransitions(role, from).includes(to);
}
