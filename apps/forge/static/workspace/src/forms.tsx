import { useState, type FormEvent } from "react";
import { z } from "zod";
import { Temporal } from "@js-temporal/polyfill";
import {
  deadlineFromLocal,
  agreementSchema,
  phaseLabels,
  phases,
  type CommitmentDraft,
  type CommitmentRecord,
  type CommandName,
} from "@promisory/contracts";
import { activeVersion, type Stored, type Workspace } from "@promisory/domain";
import {
  Modal,
  FormField,
  ErrorSummary,
  formValues,
  textValue,
  personLabel,
} from "./components";

export function CommitmentForm({
  workspace,
  record,
  onSave,
  onClose,
}: {
  workspace: Workspace;
  record?: Stored<CommitmentRecord>;
  onSave: (draft: CommitmentDraft) => Promise<void>;
  onClose: () => void;
}) {
  const existing = record
    ? (record.value.draft ?? activeVersion(record.value))
    : undefined;
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const [predicate, setPredicate] = useState(
    existing?.acceptance?.[0]?.predicate ?? "DESIGNATED_HUMAN_ACCEPTANCE",
  );
  const localDeadline = existing?.agreedDueAt
    ? Temporal.Instant.from(existing.agreedDueAt).toZonedDateTimeISO(
        existing.timeZone ?? "UTC",
      )
    : undefined;
  async function submit(event: FormEvent<HTMLFormElement>) {
    const data = formValues(event);
    setError("");
    setBusy(true);
    try {
      const title = textValue(data, "title"),
        owner = textValue(data, "owner");
      const required: Record<string, string> = {
        title: "Commitment title",
        outcome: "Outcome",
        beneficiary: "Beneficiary",
        date: "Deadline date",
        cutoff: "Local cutoff time",
        zone: "Time zone",
        acceptance: "Acceptance condition",
      };
      const missing = Object.entries(required)
        .filter(([key]) => !textValue(data, key))
        .map(([, label]) => label);
      if (missing.length)
        throw new Error(`Complete these fields: ${missing.join(", ")}.`);
      const due = deadlineFromLocal(
        textValue(data, "date"),
        textValue(data, "cutoff"),
        textValue(data, "zone"),
      );
      const human = [
        "DESIGNATED_HUMAN_ACCEPTANCE",
        "EXPLICIT_EVIDENCE",
      ].includes(predicate);
      const condition = {
        id: existing?.acceptance?.[0]?.id ?? "accepted-outcome",
        version: (existing?.acceptance?.[0]?.version ?? 0) + 1,
        description: textValue(data, "acceptance"),
        predicate,
        required: true,
        sourceIds:
          predicate === "QUALIFYING_RELEASE"
            ? [textValue(data, "acceptanceRelease")]
            : human
              ? []
              : data.getAll("acceptanceWork").map(String),
        ...(human
          ? {
              designatedVerifierAccountId: textValue(data, "verifier") || owner,
            }
          : {}),
        ...(predicate === "EXACT_SOURCE_STATE"
          ? {
              expectedState: {
                field: textValue(data, "expectedField"),
                value: textValue(data, "expectedValue"),
              },
            }
          : {}),
      };
      if (textValue(data, "valueAmount") && !textValue(data, "valueBasis"))
        throw new Error(
          "Value basis: choose what the stated value represents.",
        );
      const draft = agreementSchema.parse({
        title,
        outcome: textValue(data, "outcome"),
        beneficiary: {
          kind: textValue(data, "beneficiaryKind"),
          reference: textValue(data, "beneficiary"),
        },
        accountableOwnerAccountId: owner,
        agreedDueAt: due,
        timeZone: textValue(data, "zone"),
        projectIds: [workspace.project!.id],
        acceptance: [condition, ...(existing?.acceptance?.slice(1) ?? [])],
        supportingWorkIds: data.getAll("work").map(String),
        planningNodeIds: data.getAll("planning").map(String),
        requirementIds: data.getAll("requirement").map(String),
        requiredGateIds: data.getAll("gate").map(String),
        phase: textValue(data, "phase"),
        ...(textValue(data, "valueAmount")
          ? {
              valueAtStake: {
                amount: Number(textValue(data, "valueAmount")),
                currency: textValue(data, "valueCurrency").toUpperCase(),
                basis: textValue(data, "valueBasis"),
              },
            }
          : {}),
        ...(textValue(data, "slipBudget")
          ? { slipBudgetDays: Number(textValue(data, "slipBudget")) }
          : {}),
      });
      await onSave(draft);
      onClose();
    } catch (error) {
      setError(
        error instanceof z.ZodError
          ? error.issues
              .map((i) => `${i.path.join(".") || "Deadline"}: ${i.message}`)
              .join("\n")
          : error instanceof RangeError
            ? "Choose a valid, unambiguous local date, cutoff time, and IANA time zone. Daylight-saving gaps and overlaps need another explicit time."
            : error instanceof Error
              ? error.message
              : "Check the required fields.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal
      title={record ? "Propose an agreement revision" : "Create a commitment"}
      onClose={onClose}
    >
      <p className="muted">
        Describe a verifiable outcome. The nominated owner must accept the exact
        agreement before it becomes active.
      </p>
      <form noValidate onSubmit={submit}>
        {error && <ErrorSummary message={error} />}
        <p className="required-legend">
          <span aria-hidden="true">*</span> Required
        </p>
        <h3 className="form-section">Outcome</h3>
        <FormField name="title" label="Commitment title" required>
          <input
            id="title"
            name="title"
            maxLength={240}
            defaultValue={existing?.title}
            required
            autoFocus
          />
        </FormField>
        <FormField
          name="outcome"
          label="What must be true?"
          hint="Describe the outcome someone can verify."
          required
        >
          <textarea
            id="outcome"
            name="outcome"
            maxLength={4000}
            defaultValue={existing?.outcome}
            required
          />
        </FormField>
        <h3 className="form-section">Owner, beneficiary and deadline</h3>
        <div className="form-grid">
          <FormField name="owner" label="Accountable owner" required>
            <select
              id="owner"
              name="owner"
              defaultValue={
                existing?.accountableOwnerAccountId ?? workspace.principal
              }
            >
              {workspace.people.map((p) => (
                <option key={p.accountId} value={p.accountId}>
                  {personLabel(p, workspace.principal)}
                </option>
              ))}
            </select>
          </FormField>
          <FormField name="phase" label="Lifecycle phase">
            <select
              id="phase"
              name="phase"
              defaultValue={existing?.phase ?? "DELIVERY"}
            >
              {phases.map((phase) => (
                <option key={phase} value={phase}>
                  {phaseLabels[phase]}
                </option>
              ))}
            </select>
          </FormField>
        </div>
        <div className="form-grid">
          <FormField name="beneficiaryKind" label="Beneficiary type">
            <select
              id="beneficiaryKind"
              name="beneficiaryKind"
              defaultValue={existing?.beneficiary?.kind ?? "INTERNAL_TEAM"}
            >
              <option value="INTERNAL_TEAM">Internal team</option>
              <option value="CUSTOMER">Customer</option>
            </select>
          </FormField>
          <FormField name="beneficiary" label="Beneficiary" required>
            <input
              id="beneficiary"
              name="beneficiary"
              defaultValue={existing?.beneficiary?.reference}
              maxLength={240}
              required
            />
          </FormField>
        </div>
        <div className="form-grid three">
          <FormField name="date" label="Deadline date" required>
            <input
              type="date"
              id="date"
              name="date"
              defaultValue={localDeadline?.toPlainDate().toString()}
              required
            />
          </FormField>
          <FormField name="cutoff" label="Local cutoff time" required>
            <input
              type="time"
              id="cutoff"
              name="cutoff"
              defaultValue={localDeadline?.toPlainTime().toString().slice(0, 5)}
              required
            />
          </FormField>
          <FormField name="zone" label="Time zone" required>
            <input
              id="zone"
              name="zone"
              defaultValue={existing?.timeZone ?? "Europe/Stockholm"}
              list="timezones"
              required
            />
            <datalist id="timezones">
              <option value="Europe/Stockholm" />
              <option value="Europe/London" />
              <option value="America/New_York" />
              <option value="UTC" />
            </datalist>
          </FormField>
        </div>
        <h3 className="form-section">How delivery is proven</h3>
        <FormField
          required
          name="acceptance"
          label="Acceptance condition"
          hint="Name the exact qualifying evidence. Closing an unrelated issue does not fulfill a promise."
        >
          <textarea
            id="acceptance"
            name="acceptance"
            defaultValue={existing?.acceptance?.[0]?.description}
            maxLength={4000}
            required
          />
        </FormField>
        <FormField name="predicate" label="How is this condition verified?">
          <select
            id="predicate"
            name="predicate"
            value={predicate}
            onChange={(e) => setPredicate(e.target.value as typeof predicate)}
          >
            <option value="DESIGNATED_HUMAN_ACCEPTANCE">
              Designated person accepts
            </option>
            <option value="EXPLICIT_EVIDENCE">
              Designated person verifies evidence
            </option>
            <option value="QUALIFYING_RELEASE">
              Exact Jira version is released
            </option>
            <option value="EXACT_SOURCE_STATE">
              Exact Jira work state matches
            </option>
          </select>
        </FormField>
        {["DESIGNATED_HUMAN_ACCEPTANCE", "EXPLICIT_EVIDENCE"].includes(
          predicate,
        ) && (
          <FormField name="verifier" label="Designated verifier">
            <select
              id="verifier"
              name="verifier"
              defaultValue={
                existing?.acceptance?.[0]?.designatedVerifierAccountId ?? ""
              }
            >
              <option value="">Use the selected accountable owner</option>
              {workspace.people.map((p) => (
                <option value={p.accountId} key={p.accountId}>
                  {personLabel(p, workspace.principal)}
                </option>
              ))}
            </select>
          </FormField>
        )}
        {predicate === "QUALIFYING_RELEASE" && (
          <FormField
            name="acceptanceRelease"
            label="Exact Jira release version ID"
          >
            <input
              id="acceptanceRelease"
              name="acceptanceRelease"
              inputMode="numeric"
              defaultValue={existing?.acceptance?.[0]?.sourceIds[0]}
              required
            />
          </FormField>
        )}
        {predicate === "EXACT_SOURCE_STATE" && (
          <fieldset>
            <legend>Exact acceptance source</legend>
            {workspace.work.work.map((w) => (
              <label className="check-line" key={w.id}>
                <input
                  type="checkbox"
                  name="acceptanceWork"
                  value={w.id}
                  defaultChecked={existing?.acceptance?.[0]?.sourceIds.includes(
                    w.id,
                  )}
                />
                {w.displayKey} · {w.title}
              </label>
            ))}
            <div className="form-grid">
              <FormField name="expectedField" label="Agreed source field">
                <select
                  id="expectedField"
                  name="expectedField"
                  defaultValue={
                    existing?.acceptance?.[0]?.expectedState?.field ??
                    "statusId"
                  }
                >
                  <option value="statusId">Status ID</option>
                  <option value="targetDate">Target calendar date</option>
                </select>
              </FormField>
              <FormField name="expectedValue" label="Exact expected value">
                <input
                  id="expectedValue"
                  name="expectedValue"
                  defaultValue={existing?.acceptance?.[0]?.expectedState?.value}
                  required
                />
              </FormField>
            </div>
          </fieldset>
        )}
        {(existing?.acceptance?.length ?? 0) > 1 && (
          <p className="callout">
            The other {existing!.acceptance!.length - 1} agreed conditions are
            preserved in this revision.
          </p>
        )}
        <h3 className="form-section">Business context (optional)</h3>
        <div className="form-grid three">
          <FormField
            name="valueAmount"
            label="Value at stake (optional)"
            hint="Only a value someone has actually stated. Leave empty if unknown."
          >
            <input
              id="valueAmount"
              name="valueAmount"
              type="number"
              min="0"
              step="any"
              inputMode="decimal"
              defaultValue={existing?.valueAtStake?.amount}
            />
          </FormField>
          <FormField name="valueCurrency" label="Currency">
            <select
              id="valueCurrency"
              name="valueCurrency"
              defaultValue={existing?.valueAtStake?.currency ?? "EUR"}
            >
              {currencies.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </FormField>
          <FormField name="valueBasis" label="Value basis">
            <select
              id="valueBasis"
              name="valueBasis"
              defaultValue={existing?.valueAtStake?.basis ?? ""}
            >
              <option value="">Choose what the value represents</option>
              <option value="ARR">Annual recurring revenue</option>
              <option value="CONTRACT_PENALTY">Contract penalty</option>
              <option value="LAUNCH_REVENUE">Launch revenue</option>
              <option value="INTERNAL_COST">Internal cost</option>
              <option value="OTHER">Other stated value</option>
            </select>
          </FormField>
        </div>
        <FormField
          name="slipBudget"
          label="Slip budget in days (optional)"
          hint="Supporting Jira dates may move later by up to this many days, without passing the promise date, before a change needs escalation."
        >
          <input
            id="slipBudget"
            name="slipBudget"
            type="number"
            min="0"
            max="30"
            step="1"
            defaultValue={existing?.slipBudgetDays}
          />
        </FormField>
        <h3 className="form-section">Links</h3>
        <fieldset>
          <legend>Supporting work</legend>
          <div className="choice-list">
            {workspace.work.work.map((w) => (
              <label key={w.id}>
                <input
                  type="checkbox"
                  name="work"
                  value={w.id}
                  defaultChecked={existing?.supportingWorkIds?.includes(w.id)}
                />
                <span>
                  <b>{w.displayKey}</b> {w.title}
                  <small>
                    {w.nativeTypeName} · {w.statusName}
                  </small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {!!workspace.projectState?.value.planning.length && (
          <fieldset>
            <legend>Planning context</legend>
            {workspace.projectState.value.planning.map((p) => (
              <label className="check-line" key={p.id}>
                <input
                  type="checkbox"
                  name="planning"
                  value={p.id}
                  defaultChecked={existing?.planningNodeIds?.includes(p.id)}
                />
                {p.title}
              </label>
            ))}
          </fieldset>
        )}
        {!!workspace.projectState?.value.requirements.length && (
          <fieldset>
            <legend>Requirements</legend>
            {workspace.projectState.value.requirements.map((r) => (
              <label className="check-line" key={r.id}>
                <input
                  type="checkbox"
                  name="requirement"
                  value={r.id}
                  defaultChecked={existing?.requirementIds?.includes(r.id)}
                />
                {r.id} · {r.description}
              </label>
            ))}
          </fieldset>
        )}
        {!!workspace.projectState?.value.gates.length && (
          <fieldset>
            <legend>Readiness gates</legend>
            {workspace.projectState.value.gates.map((g) => (
              <label className="check-line" key={g.id}>
                <input
                  type="checkbox"
                  name="gate"
                  value={g.id}
                  defaultChecked={existing?.requiredGateIds?.includes(g.id)}
                />
                {g.title}
              </label>
            ))}
          </fieldset>
        )}
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving draft…" : "Save draft for owner acceptance"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function CommandForm({
  title,
  children,
  onSubmit,
  onClose,
  button = "Save",
}: {
  title: string;
  children: React.ReactNode;
  onSubmit: (data: FormData) => Promise<void>;
  onClose: () => void;
  button?: string;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  return (
    <Modal title={title} onClose={onClose}>
      <form
        onSubmit={async (event) => {
          const data = formValues(event);
          setBusy(true);
          setError("");
          try {
            await onSubmit(data);
            onClose();
          } catch (error) {
            setError(
              error instanceof Error
                ? error.message
                : "The action could not be completed.",
            );
          } finally {
            setBusy(false);
          }
        }}
      >
        {error && <ErrorSummary message={error} />}
        <div className="form-body">{children}</div>
        <div className="form-actions">
          <button type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" disabled={busy}>
            {busy ? "Saving…" : button}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const currencies = [
  "EUR",
  "USD",
  "GBP",
  "SEK",
  "NOK",
  "DKK",
  "CHF",
  "CAD",
  "AUD",
  "JPY",
  "INR",
];
