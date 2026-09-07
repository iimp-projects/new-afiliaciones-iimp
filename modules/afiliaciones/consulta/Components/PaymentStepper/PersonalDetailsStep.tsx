"use client";
import { useEffect, useState } from "react";
import { UserCircle } from "lucide-react";
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
      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm relative z-20 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-[#f4f5f7] text-center">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">Buscar y validar documento</h3>
        </div>
        <div className="p-6 md:p-8 flex justify-center">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-6 w-full max-w-2xl">
            <DisabledInput label="Tipo de documento" value={tipoDoc} required />
            <DisabledInput label="Número de documento" value={numDoc} required />
          </div>
        </div>
      </section>

      <section className="bg-white rounded-3xl border border-slate-200 shadow-sm relative z-20 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-[#f4f5f7] text-center">
          <h3 className="text-sm font-bold text-slate-800 tracking-tight">Detalles personales</h3>
        </div>
        
        <div className="p-6 md:p-8">
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