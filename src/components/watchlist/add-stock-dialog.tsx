"use client";

import { Plus } from "lucide-react";
import type { InstrumentDto } from "@/server/dto/types";
import { Dialog } from "@/components/ui/dialog";

export function AddStockDialog({ open, instruments, onClose, onAdd, busyId }: {
  open: boolean;
  instruments: InstrumentDto[];
  onClose: () => void;
  onAdd: (instrument: InstrumentDto) => void;
  busyId: string | null;
}) {
  return (
    <Dialog open={open} onClose={onClose} title="Add stock" description="Choose from the deterministic demo universe.">
      {instruments.length ? (
        <div className="instrument-options">
          {instruments.map((instrument) => (
            <button key={instrument.id} type="button" className="instrument-option" onClick={() => onAdd(instrument)} disabled={busyId !== null}>
              <div><strong>{instrument.symbol}</strong><span>{instrument.name}</span></div>
              <span>{busyId === instrument.id ? "Adding…" : <Plus size={18} aria-label="Add" />}</span>
            </button>
          ))}
        </div>
      ) : <div className="empty-reason"><p>All demo stocks are already added</p><span>Remove a stock first to try the add flow.</span></div>}
    </Dialog>
  );
}
