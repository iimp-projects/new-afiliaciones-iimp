"use client";

import { PortalAccessManager } from "@/modules/afiliaciones/expedientes/Components/Drawer/Tabs/PortalAccessManager";
import { AssociatePersonAccessManager } from "./AssociatePersonAccessManager";

export function AssociateAccessDialog({ personId, applicationId, open, onClose }: { personId: number; applicationId?: number; open: boolean; onClose: () => void }) {
  if (!open) return null;
  if (applicationId) return <PortalAccessManager applicationId={applicationId} open={open} onClose={onClose} allowPasswordReset personId={personId} />;
  return <AssociatePersonAccessManager personId={personId} open={open} onClose={onClose} />;
}
