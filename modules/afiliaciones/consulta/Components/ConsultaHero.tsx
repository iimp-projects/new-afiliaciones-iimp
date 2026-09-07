import Link from "next/link";

export function ConsultaHero() {
  return (
    <section className="hidden md:flex md:w-[55%] h-full flex-col justify-center items-center relative overflow-hidden bg-primary">
      <div className="absolute inset-0 z-0 bg-primary opacity-95"></div>
      <div className="absolute inset-0 z-0 opacity-20 mix-blend-overlay bg-cover bg-center" style={{ backgroundImage: "url('/images/minero.jpg')" }}></div>
      
      <div className="relative z-10 w-full max-w-2xl px-10">
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-[4px] bg-white/10 border border-white/20 text-xs font-bold tracking-widest uppercase mb-4 text-white backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
          Portal Oficial IIMP
        </span>
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 leading-[1.1] tracking-tight text-white drop-shadow-md">
          Seguimiento de <br />
          <span className="text-white/80">tu Solicitud</span>
        </h1>
        <p className="text-base md:text-lg mb-8 text-white/80 font-medium max-w-lg leading-relaxed">
          Consulta en tiempo real el estado de tu expediente, verifica aprobaciones de área y revisa si tienes observaciones pendientes.
        </p>
        
        <div className="flex items-center gap-6 text-sm font-semibold text-white/90 mb-8">
          <div className="flex -space-x-3">
            <div className="w-10 h-10 rounded-full border-2 border-primary bg-primary-container text-on-primary-container flex items-center justify-center text-xs font-bold">I</div>
            <div className="w-10 h-10 rounded-full border-2 border-primary bg-surface-variant text-on-surface-variant flex items-center justify-center text-xs font-bold">I</div>
            <div className="w-10 h-10 rounded-full border-2 border-primary bg-white text-primary flex items-center justify-center text-xs font-bold">M</div>
            <div className="w-10 h-10 rounded-full border-2 border-primary bg-secondary text-on-secondary flex items-center justify-center text-xs font-bold">P</div>
          </div>
          <p>Trámite 100% digital <br />y transparente</p>
        </div>

        <div className="mt-8">
          <a href="mailto:liset.otoya@iimp.org.pe" className="text-sm font-semibold text-white hover:underline flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
            </svg>
             ¿Necesitas ayuda? Escríbenos aquí
          </a>
        </div>
      </div>
    </section>
  );
}