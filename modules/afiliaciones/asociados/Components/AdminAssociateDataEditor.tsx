"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";
import { AdminAssociateDataDialog } from "./AdminAssociateDataDialog";

export function AdminAssociateDataEditor({ user, isStudent }: { user: unknown; isStudent: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title="Editar datos" aria-label="Editar datos" className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 transition hover:border-[#b48a37] hover:text-[#9b7530]">
        <Pencil size={15} />
      </button>
      <AdminAssociateDataDialog user={user} isStudent={isStudent} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
