import type { FieldErrors, UseFormRegister } from "react-hook-form";
import type { IntentType } from "@/domain/intent/types";
import type { IntentFormValues } from "./intent-editor";

export function IntentFields({ type, register, errors }: {
  type: IntentType;
  register: UseFormRegister<IntentFormValues>;
  errors: FieldErrors<IntentFormValues>;
}) {
  if (type === "PRICE_LEVEL") {
    return (
      <>
        <div className="field">
          <label htmlFor="targetPrice">Target price (₹)</label>
          <input id="targetPrice" inputMode="decimal" placeholder="1550" {...register("targetPrice", { required: "Enter a target price.", min: { value: 0.01, message: "Enter a positive price." } })} />
          {errors.targetPrice ? <span className="field-error">{errors.targetPrice.message}</span> : null}
        </div>
        <fieldset className="field">
          <legend className="field-label">Mode</legend>
          <div className="radio-grid">
            {(["NEAR", "ABOVE", "BELOW"] as const).map((mode) => (
              <label className="radio-card" key={mode}><input type="radio" value={mode} {...register("mode")} />{mode[0] + mode.slice(1).toLowerCase()}</label>
            ))}
          </div>
        </fieldset>
      </>
    );
  }

  if (type === "EARNINGS") {
    return (
      <>
        <div className="field">
          <label htmlFor="earningsFocus">Focus</label>
          <select id="earningsFocus" {...register("earningsFocus")}>
            <option value="REVENUE">Revenue</option><option value="PROFIT">Profit</option><option value="MARGINS">Margins</option>
            <option value="ASSET_QUALITY">Asset quality</option><option value="ALL_KEY_CHANGES">All key changes</option>
          </select>
        </div>
        <div className="field"><label htmlFor="quarterLabel">Quarter (optional)</label><input id="quarterLabel" placeholder="Q2" {...register("quarterLabel")} /></div>
      </>
    );
  }

  if (type === "TECHNICAL") {
    return (
      <>
        <div className="field">
          <label htmlFor="technicalSetup">Setup</label>
          <select id="technicalSetup" {...register("technicalSetup")}>
            <option value="BREAKOUT">Breakout</option><option value="SUPPORT">Support</option>
            <option value="MOVING_AVERAGE">Moving average</option><option value="GENERAL">General</option>
          </select>
        </div>
        <div className="field"><label htmlFor="referenceLevel">Reference level (₹, optional)</label><input id="referenceLevel" inputMode="decimal" {...register("referenceLevel")} /></div>
      </>
    );
  }

  if (type === "DIVIDEND") {
    return (
      <div className="field">
        <label htmlFor="dividendFocus">Focus</label>
        <select id="dividendFocus" {...register("dividendFocus")}>
          <option value="ANNOUNCEMENT">Announcement</option><option value="EX_DATE">Ex-date</option>
          <option value="YIELD">Yield</option><option value="GENERAL">General</option>
        </select>
      </div>
    );
  }

  if (type === "DRIVER") {
    return (
      <>
        <div className="field"><label htmlFor="driverKey">Driver name</label><input id="driverKey" placeholder="Fuel cost" {...register("driverKey", { required: "Enter a driver name." })} /></div>
        <div className="field"><label htmlFor="description">Description</label><textarea id="description" {...register("description", { required: "Describe what you want to track." })} /></div>
      </>
    );
  }

  if (type === "COMPANY_EVENT") {
    return (
      <>
        <div className="field"><label htmlFor="eventKind">Event type</label><input id="eventKind" placeholder="Management update" {...register("eventKind", { required: "Enter an event type." })} /></div>
        <div className="field"><label htmlFor="note">Note (optional)</label><textarea id="note" {...register("note")} /></div>
      </>
    );
  }

  return <div className="field"><label htmlFor="note">Short note (optional)</label><textarea id="note" placeholder="What do you want to remember?" {...register("note")} /></div>;
}
