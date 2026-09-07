"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { IntentType } from "@/domain/intent/types";
import { INTENT_TYPE_LABELS, INTENT_TYPES } from "@/lib/constants";
import type { WatchIntentDto } from "@/server/dto/types";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { IntentFields } from "./intent-fields";

export interface IntentFormValues {
  type: IntentType;
  originalText: string;
  targetPrice: number | string;
  mode: "NEAR" | "ABOVE" | "BELOW";
  earningsFocus: "REVENUE" | "PROFIT" | "MARGINS" | "ASSET_QUALITY" | "ALL_KEY_CHANGES";
  quarterLabel: string;
  technicalSetup: "BREAKOUT" | "SUPPORT" | "MOVING_AVERAGE" | "GENERAL";
  referenceLevel: number | string;
  dividendFocus: "ANNOUNCEMENT" | "EX_DATE" | "YIELD" | "GENERAL";
  driverKey: string;
  description: string;
  eventKind: string;
  note: string;
}

type IntentPayload = Record<string, unknown>;

function defaults(intent?: WatchIntentDto | null): IntentFormValues {
  const payload = (intent?.structuredPayload ?? {}) as IntentPayload;
  return {
    type: intent?.type ?? "GENERAL",
    originalText: intent?.originalText ?? "",
    targetPrice: payload.targetPricePaise ? Number(payload.targetPricePaise) / 100 : "",
    mode: (payload.mode as IntentFormValues["mode"]) ?? "NEAR",
    earningsFocus: (Array.isArray(payload.focus) ? payload.focus[0] : "ALL_KEY_CHANGES") as IntentFormValues["earningsFocus"],
    quarterLabel: String(payload.quarterLabel ?? ""),
    technicalSetup: (payload.setup as IntentFormValues["technicalSetup"]) ?? "BREAKOUT",
    referenceLevel: payload.referenceLevelPaise ? Number(payload.referenceLevelPaise) / 100 : "",
    dividendFocus: (payload.focus as IntentFormValues["dividendFocus"]) ?? "GENERAL",
    driverKey: String(payload.driverKey ?? ""),
    description: String(payload.description ?? ""),
    eventKind: String(payload.eventKind ?? ""),
    note: String(payload.note ?? ""),
  };
}

function createPayload(values: IntentFormValues): IntentPayload {
  switch (values.type) {
    case "PRICE_LEVEL": return { targetPricePaise: Math.round(Number(values.targetPrice) * 100), mode: values.mode, proximityBps: 100 };
    case "EARNINGS": return { focus: [values.earningsFocus], ...(values.quarterLabel.trim() ? { quarterLabel: values.quarterLabel.trim() } : {}) };
    case "TECHNICAL": return { setup: values.technicalSetup, ...(values.referenceLevel ? { referenceLevelPaise: Math.round(Number(values.referenceLevel) * 100) } : {}) };
    case "DIVIDEND": return { focus: values.dividendFocus };
    case "DRIVER": return { driverKey: values.driverKey.trim().toUpperCase().replaceAll(/\s+/g, "_"), description: values.description.trim() };
    case "COMPANY_EVENT": return { eventKind: values.eventKind.trim(), ...(values.note.trim() ? { note: values.note.trim() } : {}) };
    case "LONG_TERM":
    case "GENERAL": return values.note.trim() ? { note: values.note.trim() } : {};
  }
}

export function IntentEditor({ open, instrumentName, intent, onClose, onSave }: {
  open: boolean;
  instrumentName: string;
  intent?: WatchIntentDto | null;
  onClose: () => void;
  onSave: (input: { type: IntentType; originalText: string | null; structuredPayload: IntentPayload; provenanceSource: "STOCK_DETAIL" }) => Promise<void>;
}) {
  const [serverError, setServerError] = useState<string | null>(null);
  const { register, handleSubmit, control, setValue, reset, formState: { errors, isSubmitting } } = useForm<IntentFormValues>({ defaultValues: defaults(intent) });
  const selectedType = useWatch({ control, name: "type" });

  useEffect(() => reset(defaults(intent)), [intent, open, reset]);

  const submit = handleSubmit(async (values) => {
    setServerError(null);
    try {
      await onSave({
        type: values.type,
        originalText: values.originalText.trim() || null,
        structuredPayload: createPayload(values),
        provenanceSource: "STOCK_DETAIL",
      });
      onClose();
    } catch (error: unknown) {
      setServerError(error instanceof Error ? error.message : "Could not save the watch reason.");
    }
  });

  return (
    <Dialog open={open} onClose={onClose} title="What are you watching this for?" description={instrumentName}>
      <form className="form-stack" onSubmit={submit}>
        <fieldset className="field">
          <legend className="field-label">Reason type</legend>
          <div className="chip-grid">
            {INTENT_TYPES.map((type) => (
              <button key={type} type="button" className={`chip ${selectedType === type ? "selected" : ""}`} aria-pressed={selectedType === type} onClick={() => setValue("type", type)}>
                {INTENT_TYPE_LABELS[type]}
              </button>
            ))}
          </div>
        </fieldset>
        <IntentFields type={selectedType} register={register} errors={errors} />
        <div className="field">
          <label htmlFor="originalText">Watch reason summary</label>
          <input id="originalText" placeholder="e.g. Watching Q2 margins" {...register("originalText", { required: "Add a short watch reason." })} />
          <span className="field-help">This is the concise reason shown in your watchlist.</span>
          {errors.originalText ? <span className="field-error">{errors.originalText.message}</span> : null}
        </div>
        {serverError ? <p className="field-error" role="alert">{serverError}</p> : null}
        <div className="action-row">
          <Button type="submit" disabled={isSubmitting}>{isSubmitting ? "Saving…" : intent ? "Save new version" : "Save reason"}</Button>
          <Button type="button" variant="secondary" onClick={onClose}>{intent ? "Cancel" : "Skip for now"}</Button>
        </div>
      </form>
    </Dialog>
  );
}
