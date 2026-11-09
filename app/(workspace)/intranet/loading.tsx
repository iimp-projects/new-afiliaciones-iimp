import { ProcessLoadingOverlay } from "@/modules/shared/Components/ProcessLoadingOverlay";

export default function IntranetLoading() {
  return (
    <ProcessLoadingOverlay
      open
      title="Cargando módulo..."
      description="Estamos preparando el contenido. Un momento, por favor."
    />
  );
}
