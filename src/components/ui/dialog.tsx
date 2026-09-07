"use client";

import { X } from "lucide-react";
import { useEffect, useRef, type ReactNode } from "react";

export function Dialog({ open, title, description, onClose, children }: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog ref={ref} className="dialog" onClose={onClose} onCancel={onClose} aria-labelledby="dialog-title">
      <div className="dialog-header">
        <div>
          <h2 id="dialog-title">{title}</h2>
          {description ? <p>{description}</p> : null}
        </div>
        <button className="icon-button" type="button" onClick={onClose} aria-label="Close dialog"><X size={20} /></button>
      </div>
      <div className="dialog-body">{children}</div>
    </dialog>
  );
}
