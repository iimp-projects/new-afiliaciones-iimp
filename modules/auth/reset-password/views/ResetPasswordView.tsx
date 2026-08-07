import { ResetPasswordForm } from "../components/ResetPasswordForm";

export function ResetPasswordView() {
    return (
        <main className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-surface font-sans antialiased">
            {/* Lado Izquierdo con la textura y el fondo oficial */}
            <section className="hidden md:flex md:w-[55%] h-full flex-col justify-center items-center relative overflow-hidden bg-primary">
                <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#4a2d00] via-primary to-primary-container opacity-95"></div>
                <div className="absolute inset-0 z-0 opacity-20 mix-blend-overlay bg-cover bg-center" style={{ backgroundImage: "url('/images/minero.jpg')" }}></div>
                
                <div className="relative z-10 w-full max-w-2xl px-10">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-[4px] bg-white/10 border border-white/20 text-xs font-bold tracking-widest uppercase mb-4 text-white backdrop-blur-sm">
                        <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
                        Portal Oficial IIMP
                    </span>
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 leading-[1.1] tracking-tight text-white drop-shadow-md">
                        Ya casi estás <br/><span className="text-white/80">de vuelta</span>
                    </h1>
                    <p className="text-base md:text-lg mb-8 text-white/80 font-medium max-w-lg leading-relaxed">
                        Introduce el código de seguridad que hemos enviado a tu correo para establecer tu nueva contraseña y retomar el acceso.
                    </p>
                </div>
            </section>

            {/* Lado Derecho */}
            <section className="w-full md:w-[45%] h-full flex flex-col justify-center items-center relative overflow-hidden bg-surface-container-lowest">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4"></div>
                <div className="w-full max-w-[420px] px-6 relative z-10">
                    
                    <div className="text-center mb-8 flex flex-col items-center">
                        <div className="bg-surface p-4 rounded-2xl border border-outline-variant mb-4 shadow-sm">
                            <img src="/images/logo-iimp.png" alt="Logo IIMP" className="h-12 w-auto object-contain" />
                        </div>
                        <h2 className="text-3xl font-extrabold mb-2 text-on-surface tracking-tight">
                            Nueva Contraseña
                        </h2>
                        <p className="text-sm font-medium text-secondary">
                            Ingresa el código de 6 dígitos y tu nueva clave
                        </p>
                    </div>

                    <ResetPasswordForm />
                </div>
            </section>
        </main>
    );
}