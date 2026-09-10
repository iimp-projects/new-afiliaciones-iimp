import React from "react";
import { BookOpen } from "lucide-react";

export function PublicFooter() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="w-full bg-[#C39254] text-white border-t border-white/20 font-sans">
      <div className="max-w-[1320px] mx-auto px-6 lg:px-12 py-12 lg:py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
          
          {/* Columna 1: Logo y Copyright */}
          <div className="flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <img
                src="/images/logo-iimp.png"
                alt="Instituto de Ingenieros de Minas del Perú"
                className="h-16 w-auto brightness-0 invert object-contain"
              />
              <p className="text-xs text-white/90 leading-relaxed max-w-xs">
                © Copyright {currentYear} - Instituto de Ingenieros de Minas del Perú, todos los derechos reservados.
              </p>
            </div>
          </div>

          {/* Columna 2: Dirección, Horario y Contacto */}
          <div className="space-y-6 text-xs text-white/95">
            <div>
              <h4 className="font-extrabold uppercase tracking-widest text-white mb-2 text-[11px]">
                DIRECCIÓN
              </h4>
              <p className="leading-relaxed text-white/90">
                Calle Los Canarios 155-157, Urb. San César II Etapa, La Molina, Lima 12, Perú
              </p>
            </div>

            <div>
              <h4 className="font-extrabold uppercase tracking-widest text-white mb-2 text-[11px]">
                HORARIO DE ATENCIÓN
              </h4>
              <p className="leading-relaxed text-white/90">
                Lunes a viernes de 09:00 a 18:00 hrs.
              </p>
            </div>

            <div>
              <a
                href="mailto:iimp@iimp.org.pe"
                className="text-white hover:underline transition-colors font-semibold"
              >
                iimp@iimp.org.pe
              </a>
            </div>
          </div>

          {/* Columna 3: Enlaces de Interés y Libro de Reclamaciones */}
          <div className="space-y-5">
            <div>
              <h4 className="font-extrabold uppercase tracking-widest text-white mb-3 text-[11px]">
                ENLACES DE INTERÉS
              </h4>
              <ul className="space-y-2 text-xs font-semibold tracking-wider uppercase text-white/90">
                <li>
                  <a
                    href="https://iimp.org.pe/terminos/terminos%20y%20condiciones"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white hover:underline transition-colors block"
                  >
                    TÉRMINOS Y CONDICIONES
                  </a>
                </li>
                <li>
                  <a
                    href="https://iimp.org.pe/terminos/politicas%20de%20privacidad"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white hover:underline transition-colors block"
                  >
                    POLÍTICAS DE PRIVACIDAD
                  </a>
                </li>
                <li>
                  <a
                    href="https://iimp.org.pe/terminos/politicas%20de%20cookies"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hover:text-white hover:underline transition-colors block"
                  >
                    POLÍTICAS DE COOKIES
                  </a>
                </li>
              </ul>
            </div>

            {/* Caja Libro de Reclamaciones */}
            <a
              href="https://iimp.org.pe/libro-reclamaciones"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 px-4 py-3.5 border border-white/50 rounded-xl hover:border-white hover:bg-white/10 transition-all group"
            >
              <BookOpen className="w-6 h-6 text-white shrink-0 group-hover:scale-105 transition-transform" />
              <span className="text-[11px] font-black tracking-wider text-white uppercase leading-tight">
                LIBRO DE<br />RECLAMACIONES
              </span>
            </a>
          </div>

          {/* Columna 4: Mantente Conectado (Redes Sociales) */}
          <div className="space-y-3">
            <h4 className="font-extrabold uppercase tracking-widest text-white mb-3 text-[11px]">
              MANTENTE CONECTADO
            </h4>
            <ul className="space-y-2 text-xs font-semibold tracking-wider uppercase text-white/90">
              <li>
                <a
                  href="https://www.instagram.com/iimp_oficial/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white hover:underline transition-colors block"
                >
                  INSTAGRAM
                </a>
              </li>
              <li>
                <a
                  href="https://www.facebook.com/IIMPOficial?_rdc=1&_rdr#"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white hover:underline transition-colors block"
                >
                  FACEBOOK
                </a>
              </li>
              <li>
                <a
                  href="https://www.linkedin.com/company/instituto-de-ingenieros-de-minas-del-per%C3%BA"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white hover:underline transition-colors block"
                >
                  LINKEDIN
                </a>
              </li>
              <li>
                <a
                  href="https://x.com/IIMPOficial"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white hover:underline transition-colors block"
                >
                  X
                </a>
              </li>
              <li>
                <a
                  href="https://www.youtube.com/user/IIMPOficial"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white hover:underline transition-colors block"
                >
                  YOUTUBE
                </a>
              </li>
            </ul>
          </div>

        </div>
      </div>
    </footer>
  );
}

export default PublicFooter;
