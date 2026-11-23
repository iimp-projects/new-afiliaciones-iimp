"use client";
import { useEffect, useState } from "react";
import { Fingerprint, Info, UserCircle, X } from "lucide-react";
import { ApplicationStatusData } from "@/modules/afiliaciones/consulta/Models/ApplicationStatus";

interface Props {
  data: ApplicationStatusData;
}

const DisabledInput = ({ label, value, required = false }: { label: string; value: string, required?: boolean }) => (
  <div className="flex flex-col h-full">
    <label className="text-[10px] sm:text-[11px] font-black text-slate-500 uppercase tracking-widest mb-1.5 block truncate">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="w-full min-h-[44px] px-4 py-3 rounded-xl border border-slate-200 bg-slate-100/70 text-slate-700 font-semibold text-sm cursor-not-allowed flex items-center break-words">
      {value}
    </div>
  </div>
);

export default function PersonalDetailsStep({ data }: Props) {
  const draft = data.draftData || {};
  const personal = draft.personalInformation || {};
  const employment = draft.employmentInformation || {};

  const [showDataNotice, setShowDataNotice] = useState(true);
  const [geoNames, setGeoNames] = useState({
    country: personal.countryId ? "Cargando..." : "Elegir",
    department: personal.departmentId ? "Cargando..." : "Elegir",
    province: personal.provinceId ? "Cargando..." : "Elegir",
    district: personal.districtId ? "Cargando..." : "Elegir",
  });

  useEffect(() => {
    const fetchGeoNames = async () => {
      let countryName = "---";
      let deptName = "---";
      let provName = "---";
      let distName = "---";

      try {
        if (personal.countryId) {
          const resC = await fetch("/api/catalogs/countries");
          if (resC.ok) {
            const countries = await resC.json();
            const c = countries.find((x: any) => x.id === Number(personal.countryId));
            if (c) countryName = c.name;
          }
        }
        if (personal.departmentId && personal.countryId) {
          const resD = await fetch(`/api/catalogs/${personal.countryId}/departments`);
          if (resD.ok) {
            const depts = await resD.json();
            const d = depts.find((x: any) => x.id === Number(personal.departmentId));
            if (d) deptName = d.name;
          }
        }
        if (personal.provinceId && personal.departmentId) {
          const resP = await fetch(`/api/catalogs/${personal.departmentId}/provinces`);
          if (resP.ok) {
            const provs = await resP.json();
            const p = provs.find((x: any) => x.id === Number(personal.provinceId));
            if (p) provName = p.name;
          }
        }
        if (personal.districtId && personal.provinceId) {
          const resDist = await fetch(`/api/catalogs/${personal.provinceId}/districts`);
          if (resDist.ok) {
            const dists = await resDist.json();
            const d = dists.find((x: any) => x.id === Number(personal.districtId));
            if (d) distName = d.name;
          }
        }
      } catch (error) {
        console.error("Error al obtener nombres geográficos", error);
      }

      setGeoNames({
        country: personal.countryId ? countryName : "Elegir",
        department: personal.departmentId ? deptName : "Elegir",
        province: personal.provinceId ? provName : "Elegir",
        district: personal.districtId ? distName : "Elegir",
      });
    };

    fetchGeoNames();
  }, [personal.countryId, personal.departmentId, personal.provinceId, personal.districtId]);


  // CORRECCIÓN DE TYPESCRIPT AQUÍ: Eliminamos data.documentType y data.documentNumber
  const tipoDocMap: Record<string, string> = { DNI: "DNI", CE: "Carnet de Extranjería", PASSPORT: "Pasaporte" };
  const tipoDoc = tipoDocMap[personal.documentType] || personal.documentType || "---";
  const numDoc = personal.documentNumber || "---";

  const nombres = personal.names || "---";
  const apePaterno = personal.fatherLastName || "---";
  const apeMaterno = personal.motherLastName || "---";
  
  const correo = personal.primaryEmail || "---";
  const celular = personal.phone || "---";
  const direccion = personal.address || "---";

  const sexoMap: Record<string, string> = { MALE: "Masculino", FEMALE: "Femenino", OTHER: "Otro" };
  const sexo = sexoMap[personal.gender] || personal.gender || "Seleccionar";
  const fechaNac = personal.birthDate || "YYYY-MM-DD";

  const empresa = employment.companyName || "---";
  const cargo = employment.positionName || "---";

  return (
    <div className="space-y-6 animate-in slide-in-from-right-4 duration-500 mb-8">
      {showDataNotice && (
        <div role="status" className="relative rounded-2xl border border-sky-200 bg-sky-50 p-5 pr-12 text-sm text-slate-700 shadow-sm">
          <div className="flex items-start gap-3">
            <Info size={20} className="mt-0.5 shrink-0 text-sky-700" />
            <div className="space-y-2">
              <p className="font-semibold leading-relaxed">
                Estos son sus datos personales con los que postuló y fueron aprobados según su condición de postulante. Cualquier modificación o duda, escriba a{" "}
                <a href="mailto:asociados@iimp.org.pe" className="font-bold text-sky-700 underline underline-offset-2 hover:text-sky-900">asociados@iimp.org.pe</a> o{" "}
                <a href="mailto:liset.otoya@iimp.org.pe" className="font-bold text-sky-700 underline underline-offset-2 hover:text-sky-900">liset.otoya@iimp.org.pe</a>.
              </p>
              <p className="text-xs font-medium text-sky-700/80">Lunes a viernes de 09:00 a 18:00 hrs.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowDataNotice(false)}
            aria-label="Cerrar aviso"
            className="absolute right-3 top-3 rounded-full p-1.5 text-sky-700 transition-colors hover:bg-sky-100"
          >
            <X size={18} />
          </button>
        </div>
      )}
      <section className="bg-[#FCFAF6] rounded-3xl p-6 sm:p-8 shadow-sm border border-[#E8D09E]/50 relative z-30">
        <div className="flex items-start gap-5 border-b border-[#E8D09E]/30 pb-6 mb-8">
          <div className="w-14 h-14 shrink-0 rounded-full border-2 border-[#D6A84A] flex items-center justify-center bg-white shadow-sm">
            <Fingerprint size={28} className="text-[#C5A059]" />
          </div>
          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-[#F4E9D8] text-[#A67C00] text-[10px] font-bold uppercase tracking-widest mb-2">
              Documento validado
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-[#1E293B]">Verificación de Identidad</h2>
            <p className="text-sm text-gray-500 font-medium mt-1">Datos recuperados de tu postulación.</p>
          </div>
        </div>
        <div className="flex justify-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 w-full max-w-2xl">
            <DisabledInput label="Tipo de documento" value={tipoDoc} required />
            <DisabledInput label="Número de documento" value={numDoc} required />
          </div>
        </div>
      </section>

      <section className="bg-white rounded-3xl border border-gray-200 shadow-sm relative z-20 transition-all duration-300">
        <div className="px-8 py-5 border-b border-gray-100 flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-[#C5A059]/10 flex items-center justify-center">
            <UserCircle className="w-5 h-5 text-[#C5A059]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#2F3136] tracking-tight">Información Personal</h2>
            <p className="text-xs text-gray-500 font-medium">Revise los datos registrados en su postulación.</p>
          </div>
        </div>
        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5 sm:gap-6">
            <div className="md:col-span-5"><DisabledInput label="Nombres" value={nombres} required /></div>
            <div className="md:col-span-4"><DisabledInput label="Apellido paterno" value={apePaterno} required /></div>
            <div className="md:col-span-3"><DisabledInput label="Apellido materno" value={apeMaterno} required /></div>

            <div className="md:col-span-4"><DisabledInput label="Correo electrónico" value={correo} required /></div>
            <div className="md:col-span-3"><DisabledInput label="Celular" value={celular} required /></div>
            <div className="md:col-span-5"><DisabledInput label="Dirección" value={direccion} required /></div>

            <div className="md:col-span-3"><DisabledInput label="País" value={geoNames.country} required /></div>
            <div className="md:col-span-3"><DisabledInput label="Departamento" value={geoNames.department} /></div>
            <div className="md:col-span-3"><DisabledInput label="Provincia" value={geoNames.province} /></div>
            <div className="md:col-span-3"><DisabledInput label="Distrito" value={geoNames.district} /></div>

            <div className="md:col-span-2"><DisabledInput label="Sexo" value={sexo} required /></div>
            <div className="md:col-span-3"><DisabledInput label="Fecha de nacimiento" value={fechaNac} required /></div>
            <div className="md:col-span-4"><DisabledInput label="Empresa" value={empresa} required /></div>
            <div className="md:col-span-3"><DisabledInput label="Cargo" value={cargo} required /></div>
          </div>
        </div>
      </section>
    </div>
  );
}