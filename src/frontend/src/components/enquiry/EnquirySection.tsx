import { SignInButton } from "@/components/auth/SignInButton";
import { useDataMode } from "@/hooks/use-data-mode";
import {
  useMyEnquiries,
  useSubmitEnquiry,
  useWithdrawEnquiry,
} from "@/hooks/use-enquiries";
import type { EnquiryView, NewEnquiryInput } from "@/lib/backend";
import { formatTimestamp } from "@/lib/format";
import { cn } from "@/lib/utils";
import { useInternetIdentity } from "@caffeineai/core-infrastructure";
import { ChevronDown, Mail, Send, Undo2 } from "lucide-react";
import { useState } from "react";

interface EnquiryDraft {
  name: string;
  email: string;
  phone: string;
  message: string;
  consent: boolean;
}

const EMPTY_DRAFT: EnquiryDraft = {
  name: "",
  email: "",
  phone: "",
  message: "",
  consent: false,
};

/**
 * The purchase enquiry form, folded under the intro text.
 *
 * The form is collapsed by default so the register stays the first thing a
 * reader sees. Submitting is a signed-in action: a signed-out reader sees the
 * sign-in requirement and the submit control stays disabled. Consent is
 * required — the backend rejects an enquiry without it, so the control is
 * blocked until the box is ticked.
 *
 * A signed-in submitter can read their own submissions and withdraw permission
 * per submission. A withdrawal removes the enquiry from the admin inbox while
 * the submitter keeps the record, marked withdrawn.
 *
 * In Demo-data mode the register is never written to, so the form is withheld
 * with a notice — matching how every other write affordance behaves in demo
 * mode.
 */
export function EnquirySection() {
  const { isAuthenticated } = useInternetIdentity();
  const { mode } = useDataMode();
  const isDemo = mode === "demo";

  const [open, setOpen] = useState(false);

  return (
    <section className="py-9 md:py-12" data-ocid="home.enquiry_section">
      <h2 className="font-display text-2xl tracking-tight text-foreground md:text-3xl">
        Contact us to make a purchase
      </h2>
      <p className="mt-2 max-w-2xl text-base text-muted-foreground">
        Send the register an enquiry about a lot you would like to buy. Sign in
        is required to submit, and you can withdraw your permission at any time.
      </p>

      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-controls="purchase-enquiry-form"
        data-ocid="home.enquiry_toggle"
        className="mt-4 inline-flex h-11 items-center gap-2 rounded-sm border border-border bg-background px-4 text-xs font-semibold uppercase tracking-[0.08em] text-foreground transition-quick hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
      >
        <Mail className="size-3.5" aria-hidden="true" />
        {open ? "Close the enquiry form" : "Open the enquiry form"}
        <ChevronDown
          className={cn(
            "size-4 transition-quick",
            open ? "rotate-180" : "rotate-0",
          )}
          aria-hidden="true"
        />
      </button>

      {open ? (
        <div id="purchase-enquiry-form" className="mt-4">
          {isDemo ? (
            <div
              className="block-face px-4 py-5"
              data-ocid="home.enquiry_demo_notice"
            >
              <p className="text-base leading-relaxed text-muted-foreground">
                Demo data — the register is simulated in this browser, so
                enquiries cannot be submitted here. Switch to Real-time mode to
                send a real enquiry.
              </p>
            </div>
          ) : (
            <EnquiryForm isAuthenticated={isAuthenticated} />
          )}
        </div>
      ) : null}
    </section>
  );
}

/**
 * The enquiry form and the submitter's own submissions.
 *
 * The draft lives in local state and is only cleared by a successful submit, so
 * a failed write never loses what the reader typed.
 */
function EnquiryForm({ isAuthenticated }: { isAuthenticated: boolean }) {
  const submitEnquiry = useSubmitEnquiry();
  const [draft, setDraft] = useState<EnquiryDraft>(EMPTY_DRAFT);
  const [submitted, setSubmitted] = useState(false);

  const canSubmit =
    isAuthenticated &&
    draft.consent &&
    draft.name.trim().length > 0 &&
    draft.email.trim().length > 0 &&
    draft.message.trim().length > 0;

  function handleSubmit() {
    if (!canSubmit) return;
    const input: NewEnquiryInput = {
      name: draft.name.trim(),
      email: draft.email.trim(),
      phone: draft.phone.trim(),
      message: draft.message.trim(),
      consent: draft.consent,
    };
    // Clear the draft synchronously, then restore it only if the write fails
    // and the reader has not already started typing something newer.
    setDraft(EMPTY_DRAFT);
    setSubmitted(false);
    submitEnquiry.mutate(input, {
      onSuccess: () => setSubmitted(true),
      onError: () =>
        setDraft((current) =>
          current.name === "" && current.message === "" ? input : current,
        ),
    });
  }

  return (
    <div className="space-y-5">
      <div className="block-face px-4 py-5" data-ocid="home.enquiry_form">
        {!isAuthenticated ? (
          <div
            className="mb-5 border border-accent/40 bg-accent/5 px-3 py-3"
            data-ocid="home.enquiry_sign_in_required"
          >
            <p className="text-base leading-relaxed text-muted-foreground">
              Sign in with Internet Identity to submit an enquiry. Your
              principal is recorded with the enquiry so you can withdraw it
              later.
            </p>
            <div className="mt-3">
              <SignInButton />
            </div>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Your name" htmlFor="enquiry-name">
            <input
              id="enquiry-name"
              type="text"
              value={draft.name}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  name: event.target.value,
                }))
              }
              autoComplete="name"
              data-ocid="home.enquiry_name_input"
              className="h-11 w-full rounded-sm border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
            />
          </Field>

          <Field label="Email address" htmlFor="enquiry-email">
            <input
              id="enquiry-email"
              type="email"
              value={draft.email}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  email: event.target.value,
                }))
              }
              autoComplete="email"
              data-ocid="home.enquiry_email_input"
              className="h-11 w-full rounded-sm border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
            />
          </Field>

          <Field label="Phone (optional)" htmlFor="enquiry-phone">
            <input
              id="enquiry-phone"
              type="tel"
              value={draft.phone}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  phone: event.target.value,
                }))
              }
              autoComplete="tel"
              data-ocid="home.enquiry_phone_input"
              className="h-11 w-full rounded-sm border border-input bg-background px-3 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:h-10"
            />
          </Field>
        </div>

        <div className="mt-4">
          <Field label="What would you like to buy?" htmlFor="enquiry-message">
            <textarea
              id="enquiry-message"
              value={draft.message}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  message: event.target.value,
                }))
              }
              rows={4}
              data-ocid="home.enquiry_message_input"
              className="w-full rounded-sm border border-input bg-background px-3 py-2.5 text-base text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </Field>
        </div>

        <label className="mt-4 flex items-start gap-3 text-base leading-relaxed text-muted-foreground">
          <input
            type="checkbox"
            checked={draft.consent}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                consent: event.target.checked,
              }))
            }
            data-ocid="home.enquiry_consent_checkbox"
            className="mt-0.5 size-5 shrink-0 rounded-sm border-input accent-[oklch(var(--lime))]"
          />
          <span>
            I consent to Jewel of Africa holding and sharing the information in
            this enquiry until I withdraw it. I can withdraw permission for any
            submission at any time.
          </span>
        </label>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitEnquiry.isPending}
            data-ocid="home.enquiry_submit_button"
            className="inline-flex h-11 items-center gap-1.5 rounded-sm bg-primary px-4 text-xs font-semibold uppercase tracking-[0.08em] text-primary-foreground transition-quick hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 md:h-10"
          >
            <Send className="size-3.5" aria-hidden="true" />
            {submitEnquiry.isPending ? "Sending…" : "Send enquiry"}
          </button>

          {!isAuthenticated ? (
            <span className="text-sm text-muted-foreground">
              Sign in to enable submission.
            </span>
          ) : !draft.consent ? (
            <span className="text-sm text-muted-foreground">
              Tick the consent box to enable submission.
            </span>
          ) : null}
        </div>

        {submitEnquiry.isError ? (
          <p
            className="mt-3 text-base text-destructive"
            data-ocid="home.enquiry_error_state"
          >
            {submitEnquiry.error instanceof Error
              ? submitEnquiry.error.message
              : "The enquiry could not be sent."}
          </p>
        ) : null}

        {submitted ? (
          <p
            className="mt-3 text-base text-accent"
            data-ocid="home.enquiry_success_state"
          >
            Thank you — your enquiry has been recorded. You can withdraw it
            below at any time.
          </p>
        ) : null}
      </div>

      {isAuthenticated ? <MyEnquiries /> : null}
    </div>
  );
}

/**
 * The signed-in submitter's own enquiries, newest first, each withdrawable.
 *
 * A withdrawn enquiry stays in this list so the submitter keeps the record, but
 * it is removed from the admin inbox.
 */
function MyEnquiries() {
  const { data: enquiries, isLoading, isError } = useMyEnquiries(true);
  const withdrawEnquiry = useWithdrawEnquiry();
  const [pendingId, setPendingId] = useState<string | null>(null);

  if (isLoading) {
    return (
      <p
        className="text-base text-muted-foreground"
        data-ocid="home.enquiry_mine_loading_state"
      >
        Reading your enquiries…
      </p>
    );
  }

  if (isError) {
    return (
      <p
        className="text-base text-destructive"
        data-ocid="home.enquiry_mine_error_state"
      >
        Your enquiries could not be read. Reload the page to try again.
      </p>
    );
  }

  if ((enquiries ?? []).length === 0) {
    return (
      <p
        className="text-base text-muted-foreground"
        data-ocid="home.enquiry_mine_empty_state"
      >
        You have not submitted an enquiry yet.
      </p>
    );
  }

  return (
    <div data-ocid="home.enquiry_mine_list">
      <h3 className="micro-label">Your enquiries</h3>
      <ul className="mt-3 space-y-2">
        {(enquiries ?? []).map((enquiry, index) => (
          <EnquiryRow
            key={enquiry.id}
            enquiry={enquiry}
            index={index}
            pending={withdrawEnquiry.isPending && pendingId === enquiry.id}
            onWithdraw={() => {
              setPendingId(enquiry.id);
              withdrawEnquiry.mutate(enquiry.id, {
                onSettled: () => setPendingId(null),
              });
            }}
          />
        ))}
      </ul>

      {withdrawEnquiry.isError ? (
        <p
          className="mt-3 text-base text-destructive"
          data-ocid="home.enquiry_withdraw_error_state"
        >
          {withdrawEnquiry.error instanceof Error
            ? withdrawEnquiry.error.message
            : "The enquiry could not be withdrawn."}
        </p>
      ) : null}
    </div>
  );
}

function EnquiryRow({
  enquiry,
  index,
  pending,
  onWithdraw,
}: {
  enquiry: EnquiryView;
  index: number;
  pending: boolean;
  onWithdraw: () => void;
}) {
  return (
    <li
      className="block-face px-4 py-4"
      data-ocid={`home.enquiry_mine_item.${index + 1}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="text-base text-foreground">{enquiry.message}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Submitted {formatTimestamp(enquiry.submittedAt)}
          </p>
        </div>
        {enquiry.withdrawn ? (
          <span className="pill pill-frozen">Withdrawn</span>
        ) : (
          <button
            type="button"
            onClick={onWithdraw}
            disabled={pending}
            data-ocid={`home.enquiry_withdraw_button.${index + 1}`}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-sm border border-destructive/40 bg-background px-3 text-xs font-semibold uppercase tracking-[0.08em] text-destructive transition-quick hover:border-destructive hover:bg-destructive/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60 sm:h-9"
          >
            <Undo2 className="size-3.5" aria-hidden="true" />
            {pending ? "Withdrawing…" : "Withdraw permission"}
          </button>
        )}
      </div>
    </li>
  );
}

function Field({
  label,
  htmlFor,
  children,
}: {
  label: string;
  htmlFor: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={htmlFor} className="micro-label">
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}
