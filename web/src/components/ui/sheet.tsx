"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";

// A bottom sheet on phones, a centered dialog on wider screens. Native
// <dialog> supplies focus trapping, Escape and the backdrop; this only shapes
// it and reports close.
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
      className="m-0 w-full max-w-full bg-transparent p-0 backdrop:bg-ink/40 open:flex sm:m-auto sm:max-w-[28rem] [inset:auto_0_0_0] sm:[inset:0]"
    >
      <div className="w-full rounded-t-xl bg-sheet p-4 text-ink shadow-2xl sm:rounded-xl" style={{ paddingBottom: "calc(1rem + env(safe-area-inset-bottom))" }}>
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-[17px] font-semibold leading-tight">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="-mr-2 -mt-2 inline-flex min-h-[44px] min-w-[44px] items-center justify-center rounded-md text-graphite hover:bg-sheet-hover">
            <X className="size-5" />
          </button>
        </div>
        <div className="mt-3">{children}</div>
      </div>
    </dialog>
  );
}
