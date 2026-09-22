import { RoleBadge } from "@/components/auth/RoleBadge";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActorRole } from "@/lib/backend";
import { shortenPrincipal } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Pencil } from "lucide-react";

interface ActorRoleTableProps {
  actors: ActorRole[];
  isLoading: boolean;
  /** The signed-in principal, so the admin can spot their own row. */
  selfPrincipal: string | null;
  onEdit: (actor: ActorRole) => void;
}

const SKELETON_IDS = Array.from(
  { length: 4 },
  (_, index) => `actor-skeleton-${index}`,
);

/**
 * Every actor the register knows, with the role each one holds. Dense ledger
 * table: monospace principals, right-aligned action column.
 */
export function ActorRoleTable({
  actors,
  isLoading,
  selfPrincipal,
  onEdit,
}: ActorRoleTableProps) {
  if (isLoading) {
    return (
      <div className="mt-3 space-y-2" data-ocid="admin.actors_loading_state">
        {SKELETON_IDS.map((id) => (
          <Skeleton key={id} className="h-12 w-full rounded-sm" />
        ))}
      </div>
    );
  }

  if (actors.length === 0) {
    return (
      <div
        className="mt-3 block-face px-4 py-6"
        data-ocid="admin.actors_empty_state"
      >
        <p className="text-base text-muted-foreground">
          No roles have been assigned yet. Claim the administrator role above,
          then assign roles to the actors who need to write.
        </p>
      </div>
    );
  }

  return (
    <div
      className="mt-3 overflow-x-auto rounded-sm border border-border"
      data-ocid="admin.actors_table"
    >
      <table className="w-full min-w-[34rem] border-collapse text-left">
        <thead className="sticky top-0 bg-secondary">
          <tr>
            <th scope="col" className="micro-label px-4 py-3">
              Principal
            </th>
            <th scope="col" className="micro-label px-4 py-3">
              Role
            </th>
            <th scope="col" className="micro-label px-4 py-3 text-right">
              Action
            </th>
          </tr>
        </thead>
        <tbody>
          {actors.map((actor, index) => {
            const principalText = actor.principal.toString();
            const isSelf = principalText === selfPrincipal;

            return (
              <tr
                key={principalText}
                className={cn(
                  "border-t border-border bg-card transition-quick hover:bg-muted/40",
                )}
                data-ocid={`admin.actor_row.${index + 1}`}
              >
                <td className="min-w-0 px-4 py-3">
                  <span
                    className="hash break-all"
                    title={principalText}
                    data-ocid={`admin.actor_principal.${index + 1}`}
                  >
                    {shortenPrincipal(principalText, 8, 8)}
                  </span>
                  {isSelf ? (
                    <span className="micro-label ml-2 text-accent">You</span>
                  ) : null}
                </td>
                <td className="px-4 py-3">
                  <RoleBadge userRole={actor.role} />
                </td>
                <td className="px-4 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onEdit(actor)}
                    data-ocid={`admin.change_role_button.${index + 1}`}
                    className="inline-flex h-10 items-center gap-1.5 whitespace-nowrap rounded-sm border border-border bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground transition-quick hover:border-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:h-9"
                  >
                    <Pencil className="size-3.5" aria-hidden="true" />
                    Change role
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
