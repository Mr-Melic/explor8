import { Skeleton } from "@/components/ui/skeleton";
import { useAllReferenceEntries } from "@/hooks/use-admin-data";
import { useDataMode } from "@/hooks/use-data-mode";
import { useAdminEnquiries } from "@/hooks/use-enquiries";
import { useMyRole } from "@/hooks/use-role";
import { RefKind } from "@/lib/backend";
import type { EnquiryView } from "@/lib/backend";
import { formatTimestamp, shortenPrincipal } from "@/lib/format";
import { Mail, MailX } from "lucide-react";

const SKELETON_IDS = Array.from(
  { length: 3 },
  (_, index) => `enquiry-skeleton-${index}`,
);

/**
 * The admin enquiry inbox.
 *
 * Every non-withdrawn purchase enquiry, newest first. A submitter's withdrawal
 * removes their enquiry from this list — the backend's `listEnquiries` returns
 * only open enquiries, so a withdrawn one never appears here.
 *
 * The optional destination email is reference data of kind
 * `enquiry_destination`, edited from the admin panel's Reference data section.
 * This panel reads the same source, so an address added, edited or removed
 * there is reflected here immediately. When no address is set, no enquiry email
 * is sent and this section says so in plain language.
 *
 * The inbox is gated on the caller's effective capabilities, matching how the
 * panel's other admin-gated controls are gated. The backend re-checks the
 * administrator role and rejects a non-admin caller.
 */
export function AdminEnquirySection() {
  const { capabilities } = useMyRole();
  const { mode } = useDataMode();
  const isDemo = mode === "demo";
  const enabled = capabilities.canAdminister;

  // The register is never read in demo mode: the inbox follows the active data
  // mode the same way the analytics panel does.
  const {
    data: enquiries,
    isLoading,
    isError,
  } = useAdminEnquiries(enabled && !isDemo);
  const { data: referenceEntries } = useAllReferenceEntries(enabled);

  const destination = (referenceEntries ?? []).find(
    (entry) => entry.kind === RefKind.enquiry_destination && entry.active,
  );
  const destinationEmail = destination?.value.trim() ?? "";

  if (!enabled) {
    return (
      <section className="py-8" data-ocid="admin.enquiries_section">
        <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
          Purchase enquiries
        </h2>
        <p className="mt-2 max-w-2xl text-base text-muted-foreground">
          Enquiries submitted from the register, newest first.
        </p>
        <div
          className="mt-3 block-face px-4 py-6"
          data-ocid="admin.enquiries_locked_state"
        >
          <p className="text-base text-muted-foreground">
            Only an administrator can read the purchase enquiry inbox.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="py-8" data-ocid="admin.enquiries_section">
      <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
        Purchase enquiries
      </h2>
      <p className="mt-2 max-w-2xl text-base text-muted-foreground">
        Enquiries submitted from the register, newest first. A submitter who
        withdraws permission is removed from this inbox.
      </p>

      <div className="mt-3 space-y-5" data-ocid="admin.enquiries_panel">
        <DestinationNotice email={destinationEmail} />

        {isDemo ? (
          <div
            className="block-face px-4 py-6"
            data-ocid="admin.enquiries_demo_notice"
          >
            <p className="text-base text-muted-foreground">
              Demo data — the register is simulated in this browser, so the
              enquiry inbox is not read here. Switch to Real-time mode to see
              live enquiries.
            </p>
          </div>
        ) : isLoading ? (
          <div className="space-y-2" data-ocid="admin.enquiries_loading_state">
            {SKELETON_IDS.map((id) => (
              <Skeleton key={id} className="h-24 w-full rounded-sm" />
            ))}
          </div>
        ) : isError ? (
          <div
            className="block-face px-4 py-6"
            data-ocid="admin.enquiries_error_state"
          >
            <p className="text-base text-destructive">
              The enquiry inbox could not be read. Reload the page to try again.
            </p>
          </div>
        ) : (enquiries ?? []).length === 0 ? (
          <div
            className="block-face px-4 py-6"
            data-ocid="admin.enquiries_empty_state"
          >
            <p className="text-base text-muted-foreground">
              No open enquiries. A purchase enquiry submitted from the register
              appears here until its submitter withdraws permission.
            </p>
          </div>
        ) : (
          <ul className="space-y-2" data-ocid="admin.enquiries_list">
            {(enquiries ?? []).map((enquiry, index) => (
              <EnquiryRow key={enquiry.id} enquiry={enquiry} index={index} />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

/**
 * The destination-email status, in plain language.
 *
 * The address itself is edited in the Reference data section; this panel only
 * reports whether one is set and what happens when it is not.
 */
function DestinationNotice({ email }: { email: string }) {
  if (email.length === 0) {
    return (
      <div
        className="block-face px-4 py-5"
        data-ocid="admin.enquiries_destination_unset"
      >
        <div className="flex items-start gap-3">
          <MailX
            className="mt-0.5 size-4 shrink-0 text-muted-foreground"
            aria-hidden="true"
          />
          <div className="min-w-0">
            <p className="text-base font-medium text-foreground">
              No destination email is set
            </p>
            <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">
              No enquiry email is sent while no address is set. Add one under
              Reference data → Enquiry destination to record where enquiries
              should go.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="block-face block-face-open px-4 py-5"
      data-ocid="admin.enquiries_destination_set"
    >
      <div className="flex items-start gap-3">
        <Mail
          className="mt-0.5 size-4 shrink-0 text-accent"
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="text-base font-medium text-foreground">
            Enquiries are directed to {email}
          </p>
          <p className="mt-1.5 text-base leading-relaxed text-muted-foreground">
            This address is stored as reference data. Edit or remove it under
            Reference data → Enquiry destination.
          </p>
        </div>
      </div>
    </div>
  );
}

function EnquiryRow({
  enquiry,
  index,
}: {
  enquiry: EnquiryView;
  index: number;
}) {
  return (
    <li
      className="block-face px-4 py-4"
      data-ocid={`admin.enquiries_item.${index + 1}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-base font-medium text-foreground">
            {enquiry.name}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {enquiry.email}
            {enquiry.phone ? ` · ${enquiry.phone}` : ""}
          </p>
        </div>
        <p className="shrink-0 text-sm text-muted-foreground">
          {formatTimestamp(enquiry.submittedAt)}
        </p>
      </div>

      <p className="mt-3 text-base leading-relaxed text-foreground">
        {enquiry.message}
      </p>

      <p className="hash mt-3 break-all">
        Submitted by {shortenPrincipal(enquiry.submittedBy.toString())}
      </p>
    </li>
  );
}
