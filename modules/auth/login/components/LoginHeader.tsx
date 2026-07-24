export function LoginHeader() {
  return (
    <div className="text-center mb-8 flex flex-col items-center">
      <div className="bg-surface p-4 rounded-2xl border border-outline-variant mb-4 shadow-sm">
        <img
          src="/images/logo-iimp.png"
          alt="Logo IIMP"
          className="h-12 w-auto object-contain"
        />
      </div>
      <h2 className="text-3xl font-extrabold mb-2 text-on-surface tracking-tight">
        Intranet de Asociados
      </h2>
      <p className="text-sm font-medium text-secondary">
        Ingresa tus credenciales para acceder a tu panel
      </p>
    </div>
  );
}