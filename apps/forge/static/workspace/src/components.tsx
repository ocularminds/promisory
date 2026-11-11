import { useEffect, useRef, type FormEvent, type ReactNode } from "react";
import {
  phaseLabels,
  type DeliveryHealth,
  type LifecycleGate,
} from "@promisory/contracts";

export function personLabel(
  person: { accountId: string; displayName: string },
  principal: string,
) {
  return `${person.displayName}${person.accountId === principal ? " (you)" : ""}`;
}

const statusLabels: Record<string, string> = {
  ON_TRACK: "On track",
  WATCH: "Watch",
  AT_RISK: "At risk",
  BREACHED: "Deadline missed",
  UNKNOWN: "Context incomplete",
  VERIFIED: "Outcome verified",
  PENDING: "Not yet verified",
  REGRESSED: "Regression review",
  HELD: "Held",
  BLOCKED: "Blocked",
  RECONCILING: "Result unresolved",
  SUCCEEDED: "Change verified",
  EXECUTING: "Checking authority",
  FAILED: "Failed",
  READY_FOR_REVIEW: "Ready for review",
  AWAITING_REVIEW: "Awaiting review",
  REVIEW_RECORDED: "Review recorded",
  EXPIRED: "Expired",
  ACCEPTED: "Gate accepted",
  SUPERSEDED: "Source changed",
  NOT_READY: "Not ready",
  NOT_APPLICABLE: "Not applicable",
  CURRENT: "Current",
  STALE: "Source changed",
  COMPLETE: "Current coverage",
  INCOMPLETE: "Context incomplete",
  UNAVAILABLE: "Unavailable",
  UNVERIFIED: "Not verified",
  AVAILABLE: "Available",
  ASSESSMENT_ONLY: "Assessment only",
};
export function Badge({ state }: { state: string }) {
  const tone = [
    "ON_TRACK",
    "VERIFIED",
    "SUCCEEDED",
    "AVAILABLE",
    "ACCEPTED",
  ].includes(state)
    ? "success"
    : [
          "BREACHED",
          "AT_RISK",
          "FAILED",
          "BLOCKED",
          "REGRESSED",
          "NOT_READY",
        ].includes(state)
      ? "danger"
      : [
            "WATCH",
            "HELD",
            "READY_FOR_REVIEW",
            "AWAITING_REVIEW",
            "EXPIRED",
            "STALE",
            "SUPERSEDED",
            "ASSESSMENT_ONLY",
          ].includes(state)
        ? "warning"
        : "unknown";
  const icon =
    tone === "success"
      ? "✓"
      : tone === "danger"
        ? "!"
        : tone === "warning"
          ? "◷"
          : "○";
  return (
    <span className={`badge ${tone}`}>
      <span aria-hidden="true">{icon}</span>
      <span>
        {statusLabels[state] ?? state.replaceAll("_", " ").toLowerCase()}
      </span>
    </span>
  );
}
export function GateHistory({
  versions,
  person,
}: {
  versions: LifecycleGate[];
  person: (accountId: string) => string;
}) {
  return (
    <details>
      <summary>Gate versions & reviews · {versions.length} versions</summary>
      <p className="muted">
        These records preserve the reviewed versions. Current applicability is
        shown above; a historical acceptance does not apply to changed evidence.
      </p>
      {[...versions]
        .sort((a, b) => b.version - a.version)
        .map((gate) => (
          <section key={`${gate.id}:${gate.version}`}>
            <h4>Gate version {gate.version}</h4>
            {gate.reviews.length ? (
              gate.reviews.map((review) => (
                <p key={review.id}>
                  {person(review.reviewerAccountId)} ·{" "}
                  {review.disposition.toLowerCase().replaceAll("_", " ")}
                  {" · "}
                  <time dateTime={review.at}>
                    {new Date(review.at).toLocaleString("en-GB")}
                  </time>
                  <br />
                  {review.note}
                </p>
              ))
            ) : (
              <p>No review recorded for this version.</p>
            )}
            <details>
              <summary>Exact source versions and review references</summary>
              <pre>
                {JSON.stringify(
                  {
                    basis: gate.basis,
                    reviews: gate.reviews.map(({ id, basisHash }) => ({
                      id,
                      basisHash,
                    })),
                  },
                  null,
                  2,
                )}
              </pre>
            </details>
          </section>
        ))}
    </details>
  );
}
export function FormField({
  label,
  name,
  children,
  hint,
}: {
  label: string;
  name: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <div className="field">
      <label htmlFor={name}>{label}</label>
      {children}
      {hint && <small id={`${name}-hint`}>{hint}</small>}
    </div>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const focused = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => {
      ref.current?.close();
      focused?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="dialog-title"
      onKeyDown={(event) => {
        if (event.key !== "Tab") return;
        const controls = [
          ...event.currentTarget.querySelectorAll<HTMLElement>(
            'button:not([disabled]),input:not([disabled]):not([type="hidden"]),select:not([disabled]),textarea:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])',
          ),
        ].filter((element) => element.getClientRects().length > 0);
        const first = controls[0],
          last = controls.at(-1);
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
      }}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="modal-heading">
        <h2 id="dialog-title">{title}</h2>
        <button
          className="icon-button"
          aria-label="Close dialog"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      {children}
    </dialog>
  );
}
export function ErrorSummary({ message }: { message: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    ref.current?.focus();
  }, [message]);
  return (
    <div ref={ref} className="error-summary" tabIndex={-1} role="alert">
      <strong>Check this before continuing</strong>
      <p>{message}</p>
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-symbol" aria-hidden="true">
        ◎
      </span>
      <h3>{title}</h3>
      {children && <p>{children}</p>}
    </div>
  );
}
export function DateDisplay({
  instant,
  zone,
}: {
  instant: string;
  zone: string;
}) {
  return (
    <time dateTime={instant} title={`${instant} · ${zone}`}>
      {new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: zone,
      }).format(new Date(instant))}
      <small>{zone}</small>
    </time>
  );
}
export function formValues(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return new FormData(event.currentTarget);
}
export const textValue = (data: FormData, key: string) =>
  String(data.get(key) ?? "").trim();
