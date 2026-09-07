import { AlertCircle, LoaderCircle } from "lucide-react";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return <div className="state-message" role="status"><LoaderCircle className="spin" size={20} />{label}</div>;
}

export function ErrorState({ message, retry }: { message: string; retry?: () => void }) {
  return (
    <div className="state-message error-message" role="alert">
      <AlertCircle size={20} />
      <span>{message}</span>
      {retry ? <button type="button" className="text-button" onClick={retry}>Try again</button> : null}
    </div>
  );
}

export function DemoBadge() {
  return <span className="demo-badge">SIMULATED · DEMO DATA</span>;
}
