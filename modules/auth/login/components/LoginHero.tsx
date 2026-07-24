export function LoginHero() {
  return (
    <section className="hidden md:flex md:w-[55%] h-full flex-col justify-center items-center relative overflow-hidden bg-primary">
      {/* Capa de fondo usando variable primaria */}
      <div className="absolute inset-0 z-0 bg-primary opacity-95"></div>
      {/* Textura sutil */}
      <div
        className="absolute inset-0 z-0 opacity-20 mix-blend-overlay bg-cover bg-center"
        style={{ backgroundImage: "url('/images/minero.jpg')" }}
      ></div>

      <div className="relative z-10 w-full max-w-2xl px-10">
        {/* Badge */}
        <span className="inline-flex items-center gap-2 px-3 py-1 rounded-[4px] bg-white/10 border border-white/20 text-xs font-bold tracking-widest uppercase mb-4 text-white backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-white animate-pulse"></span>
          Portal Oficial IIMP
        </span>

        <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-4 leading-[1.1] tracking-tight text-white drop-shadow-md">
          Impulsando la <br />
          <span className="text-white/80">Minería del Futuro</span>
        </h1>

        <p className="text-base md:text-lg mb-8 text-white/80 font-medium max-w-lg leading-relaxed">
          Accede a nuestra red global, eventos exclusivos y herramientas diseñadas para los líderes del sector.
        </p>

        {/* Avatares */}
        <div className="flex items-center gap-6 text-sm font-semibold text-white/90 mb-8">
          <div className="flex -space-x-3">
            <div className="w-10 h-10 rounded-full border-2 border-primary bg-primary-container text-on-primary-container flex items-center justify-center text-xs font-bold">
              I
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-primary bg-surface-variant text-on-surface-variant flex items-center justify-center text-xs font-bold">
              I
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-primary bg-white text-primary flex items-center justify-center text-xs font-bold">
              M
            </div>
            <div className="w-10 h-10 rounded-full border-2 border-primary bg-secondary text-on-secondary flex items-center justify-center text-xs font-bold">
              P
            </div>
          </div>
          <p>
            +10,000 profesionales <br />
            conectados
          </p>
        </div>

        {/* Botones */}
        <div className="flex gap-4 mb-8">
          <button className="flex items-center gap-2 bg-surface text-primary px-6 h-12 rounded-xl font-bold hover:bg-surface-container-highest transition-colors shadow-sm">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z"></path>
            </svg>
            Iniciar Afiliación
          </button>
          <button className="flex items-center gap-2 border-2 border-white/30 text-white px-6 h-12 rounded-xl font-bold hover:bg-white/10 transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"></path>
            </svg>
            Consultar Estado
          </button>
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