import { ForgotPasswordForm } from "../components/ForgotPasswordForm";

export function ForgotPasswordView() {
    return (
        <main className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-surface font-sans antialiased">
            {/* Lado Izquierdo */}
            <section className="hidden md:flex md:w-[55%] h-full flex-col justify-center items-center relative overflow-hidden bg-primary">
                <div className="absolute inset-0 z-0 bg-gradient-to-br from-[#4a2d00] via-primary to-primary-container opacity-95"></div>
                <div className="absolute inset-0 z-0 opacity-20 mix-blend-overlay bg-cover bg-center" style={{ backgroundImage: "url('/images/minero.jpg')" }}></div>
                <div className="relative z-10 w-full max-w-2xl px-10">
                    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs font-semibold tracking-widest uppercase mb-3 backdrop-blur-sm">
                        <span className="w-2 h-2 rounded-full bg-[#f3bd7a] animate-pulse"></span>
                        Portal Oficial IIMP
                    </span>
                    <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-3 leading-[1.1] tracking-tight text-white drop-shadow-md">
                        Protegemos tu <br/><span className="text-[#f3bd7a]">Seguridad Digital</span>
                    </h1>
                    <p className="text-base md:text-lg mb-5 text-white/80 font-medium max-w-lg leading-relaxed">
                        Si has perdido el acceso a tu cuenta, te ayudaremos a recuperarlo de forma rápida y segura.
                    </p>
                </div>
            </section>

            {/* Lado Derecho */}
            <section className="w-full md:w-[45%] h-full flex flex-col justify-center items-center relative overflow-hidden bg-surface-container-lowest">
                <div className="w-full max-w-[420px] px-6 relative z-10">
                    <div className="text-center mb-8 flex flex-col items-center">
                        <div className="bg-surface p-3 rounded-2xl shadow-sm border border-secondary/10 mb-4">
                            <img src="/images/logo-iimp.png" alt="Logo IIMP" className="h-10 w-auto object-contain" />
                        </div>
                        <h2 className="text-2xl font-bold mb-2 bg-clip-text text-transparent bg-gradient-to-r from-[#4a2d00] to-primary">
                            Recuperar Contraseña
                        </h2>
                        <p className="text-sm font-medium text-secondary/80">
                            Ingresa tu correo electrónico registrado.
                        </p>
                    </div>
                    
                    <ForgotPasswordForm />
                </div>
            </section>
        </main>
    );
}