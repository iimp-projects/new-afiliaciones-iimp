export function ConsultaHeader() {
  return (
    <div className="text-center mb-8 flex flex-col items-center">
      <div className="bg-surface p-4 rounded-2xl border border-outline-variant mb-4 shadow-sm">
        <img src="/images/logo-iimp.png" alt="Logo IIMP" className="h-12 w-auto object-contain" />
      </div>
      <h2 className="text-3xl font-extrabold mb-2 text-on-surface tracking-tight">
        Consulta de Solicitud
      </h2>
      <p className="text-sm font-medium text-secondary">
        Ingresa tus datos para verificar el estado de tu trámite
      </p>
    </div>
  );
}