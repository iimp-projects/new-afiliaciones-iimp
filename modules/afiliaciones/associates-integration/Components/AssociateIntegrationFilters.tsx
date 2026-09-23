import { DataFilterBar, type DataFilterDefinition } from "@/modules/shared/Components/DataManagement";
import { affiliateLabels, AssociateIntegrationFiltersValue, statusLabels, triggerLabels } from "./associateIntegration.types";
type Props = { values: AssociateIntegrationFiltersValue; loading: boolean; onChange: (values: AssociateIntegrationFiltersValue) => void; onApply: () => void; onClear: () => void };
const primaryFilters: DataFilterDefinition[] = [
  { key: "search", type: "search", placeholder: "Expediente, asociado, documento, tracking o código SIE", label: "Buscar" },
  { key: "status", type: "select", placeholder: "Todos los estados", label: "Estado", options: Object.entries(statusLabels).map(([value, label]) => ({ value, label })) },
  { key: "trigger", type: "select", placeholder: "Todos los orígenes", label: "Origen", options: Object.entries(triggerLabels).map(([value, label]) => ({ value, label })) },
  { key: "affiliateType", type: "select", placeholder: "Todos los tipos", label: "Tipo de asociado", options: Object.entries(affiliateLabels).map(([value, label]) => ({ value, label })) },
];
const advancedFilters: DataFilterDefinition[] = [
  { key: "dateFrom", type: "date", label: "Desde" }, { key: "dateTo", type: "date", label: "Hasta" },
];
export function AssociateIntegrationFilters(props: Props) { return <DataFilterBar primaryFilters={primaryFilters} advancedFilters={advancedFilters} {...props} />; }
