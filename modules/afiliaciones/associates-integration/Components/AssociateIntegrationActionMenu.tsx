import { Code2, Eye, RefreshCw } from "lucide-react";
import { DataActionMenu, type DataAction } from "@/modules/shared/Components/DataManagement";
import type { AssociateIntegrationRow } from "./associateIntegration.types";
type Props = { row: AssociateIntegrationRow; onDetail: () => void; onPayload: () => void; onRetry: () => void };
export function AssociateIntegrationActionMenu({ row, onDetail, onPayload, onRetry }: Props) { const actions: DataAction<AssociateIntegrationRow>[] = [{ key: "detail", label: "Ver detalle", icon: Eye, onClick: onDetail }, { key: "payload", label: "Ver Payload SIE", icon: Code2, onClick: onPayload }, { key: "retry", label: "Reintentar envío", icon: RefreshCw, visible: (item) => item.status === "RETRYABLE", destructive: true, onClick: onRetry }]; return <DataActionMenu row={row} actions={actions} />; }
