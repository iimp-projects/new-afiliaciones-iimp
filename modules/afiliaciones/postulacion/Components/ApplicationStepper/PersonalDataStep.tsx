"use client";

import { useEffect, useState, forwardRef, useImperativeHandle, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  Fingerprint,
  Search,
  Building2,
  UserCircle2,
  UploadCloud,
  ImageIcon,
  FileText,
  CheckCircle2,
  XCircle,
  ShieldAlert,
  Clock,
  Info,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Calendar
} from "lucide-react";
import type { PersonalInformation } from "../../Models/PersonalInformation";
import { PersonalInformationValidator } from "../../Validators/PersonalInformationValidator";
import { applicationApi } from "../../Services/ApplicationApi";
import type { ValidationFlowStatus } from "../../DTOs/validation-response.dto";

export interface StepRef {
  submit: () => Promise<void>;
}

interface PersonalDataStepProps {
  value?: PersonalInformation;
  saving?: boolean;
  onSave(data: PersonalInformation): Promise<void>;
  onNext(): void;
  onValidityChange?: (isValid: boolean) => void;
}

interface CatalogItem {
  id: number;
  name: string;
  isoCode?: string;
  ubigeoCode?: string;
}

const emptyPersonalInformation: PersonalInformation = {
  documentType: "",
  documentNumber: "",
  names: "",
  fatherLastName: "",
  motherLastName: "",
  birthDate: "",
  gender: "",
  phone: "",
  primaryEmail: "",
  secondaryEmail: "",
  countryId: 0,
  departmentId: undefined,
  provinceId: undefined,
  districtId: undefined,
  address: "",
  photo: null,
  identityDocument: null,
  identityVerified: false,
};

// ========================================================
// COMPONENTE AUXILIAR: SELECT MINIATURA (Para el Calendario)
// ========================================================
const MiniSelect = ({
  value,
  options,
  onChange,
}: {
  value: number;
  options: { value: number; label: string }[];
  onChange: (val: number) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [isOpen]);

  const selectedLabel = options.find((o) => o.value === value)?.label;

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        className="flex items-center gap-1.5 bg-gray-50 border border-gray-200 text-slate-700 text-sm font-bold rounded-lg px-3 py-1.5 hover:border-[#C5A059] transition-colors focus:outline-none"
      >
        <span>{selectedLabel}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 mt-1 min-w-[120px] bg-white border border-gray-100 rounded-xl shadow-xl z-[110] overflow-hidden animate-in fade-in zoom-in-95">
          <div className="max-h-48 overflow-y-auto p-1 scrollbar-thin scrollbar-thumb-gray-200">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  onChange(opt.value);
                  setIsOpen(false);
                }}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                  value === opt.value
                    ? "bg-[#C5A059]/10 text-[#C5A059] font-bold"
                    : "text-slate-700 hover:bg-gray-50 font-medium"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ========================================================
// COMPONENTE: DATEPICKER PREMIUM (+18 AÑOS)
// ========================================================
const PremiumDatePicker = ({
  value,
  onChange,
  onBlur,
  disabled,
  hasError,
}: {
  value: string;
  onChange: (val: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  hasError?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fecha máxima: exactamente 18 años atrás desde hoy[cite: 8]
  const today = new Date();
  const maxDate = new Date(today.getFullYear() - 18, today.getMonth(), today.getDate());
  maxDate.setHours(0, 0, 0, 0);
  const maxDateString = maxDate.toISOString().split("T")[0];

  const initialValue = value ? value.split("-") : [maxDate.getFullYear().toString(), (maxDate.getMonth() + 1).toString(), maxDate.getDate().toString()];
  const [viewDate, setViewDate] = useState(new Date(Number(initialValue[0]), Number(initialValue[1]) - 1, 1));

  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        if (onBlur) onBlur();
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [onBlur]);

  const handleDateSelect = (day: number) => {
    const newDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
    if (newDate > maxDate) return; 

    const yyyy = newDate.getFullYear();
    const mm = String(newDate.getMonth() + 1).padStart(2, "0");
    const dd = String(day).padStart(2, "0");
    onChange(`${yyyy}-${mm}-${dd}`);
    setIsOpen(false);
  };

  const nextMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  const prevMonth = () => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));

  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
  const firstDayIndex = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1).getDay();

  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const minYear = today.getFullYear() - 100;
  const maxYear = maxDate.getFullYear();
  const years = Array.from({ length: maxYear - minYear + 1 }, (_, i) => maxYear - i);

  const displayValue = value ? `${value.split("-")[2]}/${value.split("-")[1]}/${value.split("-")[0]}` : "DD/MM/YYYY";

  const baseClass = disabled
    ? "bg-gray-50 border-gray-200 text-slate-400 cursor-not-allowed"
    : hasError
    ? "border-red-500 bg-red-50/30 text-red-900"
    : "border-gray-300 bg-white text-slate-700 hover:border-[#C5A059]";

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        className={`w-full h-11 px-3 rounded-xl border flex items-center justify-between transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]/20 font-medium text-sm ${baseClass} ${
          !disabled ? "cursor-pointer" : ""
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={!value ? "text-gray-400 font-normal tracking-wide" : "tracking-wide"}>{displayValue}</span>
        <Calendar size={18} className={disabled ? "text-gray-400" : "text-[#C5A059]"} />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-[100] w-[320px] mt-2 bg-white border border-gray-200 rounded-2xl shadow-[0_15px_50px_-15px_rgba(0,0,0,0.2)] p-4 animate-in fade-in slide-in-from-top-2">
          {/* Cabecera: Mes y Año con Custom Selects */}
          <div className="flex items-center justify-between mb-4">
            <button type="button" onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-slate-600 transition-colors">
              <ChevronLeft size={18} />
            </button>
            <div className="flex gap-2">
              <MiniSelect
                value={viewDate.getMonth()}
                options={months.map((m, i) => ({ value: i, label: m }))}
                onChange={(val) => setViewDate(new Date(viewDate.getFullYear(), val, 1))}
              />
              <MiniSelect
                value={viewDate.getFullYear()}
                options={years.map(y => ({ value: y, label: y.toString() }))}
                onChange={(val) => setViewDate(new Date(val, viewDate.getMonth(), 1))}
              />
            </div>
            <button type="button" onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 text-slate-600 transition-colors">
              <ChevronRight size={18} />
            </button>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center mb-2">
            {["Do", "Lu", "Ma", "Mi", "Ju", "Vi", "Sa"].map(d => (
              <span key={d} className="text-[10px] font-bold text-gray-400 uppercase">{d}</span>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: firstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} className="w-8 h-8"></div>
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => {
              const day = i + 1;
              const dateOfCell = new Date(viewDate.getFullYear(), viewDate.getMonth(), day);
              const isOver18 = dateOfCell <= maxDate; 
              const isSelected = value === `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

              return (
                <button
                  key={day}
                  type="button"
                  disabled={!isOver18}
                  onClick={() => handleDateSelect(day)}
                  className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm transition-all ${
                    !isOver18
                      ? "text-gray-300 cursor-not-allowed bg-transparent hover:bg-transparent"
                      : isSelected
                      ? "bg-[#C5A059] text-white font-bold shadow-md shadow-[#C5A059]/40"
                      : "text-slate-700 font-medium hover:bg-[#C5A059]/10 hover:text-[#C5A059]"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

// ========================================================
// COMPONENTE: SELECT SIMPLE (Sin búsqueda, solo lista)
// ========================================================
const SimpleSelect = ({
  options,
  value,
  onChange,
  onBlur,
  disabled,
  placeholder,
  hasError,
  heightClass = "h-11",
  isGrouped = false,
}: {
  options: { id: string; name: string }[];
  value: string | undefined;
  onChange: (val: string) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder: string;
  hasError?: boolean;
  heightClass?: string;
  isGrouped?: boolean;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (onBlur) onBlur();
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [onBlur]);

  const selectedOption = options.find((o) => o.id === value);

  const baseClass = disabled
    ? "bg-gray-50 border-gray-200 text-slate-400 cursor-not-allowed"
    : hasError
    ? "border-red-500 bg-red-50/30 text-red-900"
    : "border-gray-300 bg-white text-slate-700 hover:border-[#C5A059]";

  const roundedClass = isGrouped ? "rounded-l-xl border-r-0" : "rounded-xl";

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        className={`w-full ${heightClass} px-3 ${roundedClass} border flex items-center justify-between transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]/20 font-medium text-sm ${baseClass} ${
          !disabled ? "cursor-pointer" : ""
        }`}
        onClick={() => {
          if (!disabled) setIsOpen(!isOpen);
        }}
      >
        <span className={`truncate ${!selectedOption ? "text-gray-400 font-normal" : ""}`}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${isOpen ? "rotate-180 text-[#C5A059]" : "text-gray-400"}`}
        />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-[100] w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="overflow-y-auto max-h-56 p-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            {options.map((option) => (
              <div
                key={option.id}
                className={`px-3 py-2.5 text-sm rounded-lg cursor-pointer transition-colors flex items-center justify-between ${
                  value === option.id
                    ? "bg-[#C5A059]/10 text-[#C5A059] font-bold"
                    : "hover:bg-gray-50 text-slate-700 font-medium"
                }`}
                onClick={() => {
                  onChange(option.id);
                  setIsOpen(false);
                }}
              >
                <span className="truncate pr-2">{option.name}</span>
                {value === option.id && <CheckCircle2 size={14} className="shrink-0" />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ========================================================
// COMPONENTE: SELECT CON BÚSQUEDA INTEGRADA
// ========================================================
const SearchableSelect = ({
  options,
  value,
  onChange,
  onBlur,
  disabled,
  placeholder,
  hasError,
  emptyMessage = "No se encontraron resultados",
}: {
  options: CatalogItem[];
  value: number | string | undefined;
  onChange: (val: any) => void;
  onBlur?: () => void;
  disabled?: boolean;
  placeholder: string;
  hasError?: boolean;
  emptyMessage?: string;
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        if (onBlur) onBlur();
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [onBlur]);

  const selectedOption = options.find((o) => o.id === value);
  const filteredOptions = options.filter((o) =>
    o.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const baseClass = disabled
    ? "bg-gray-50 border-gray-200 text-slate-400 cursor-not-allowed"
    : hasError
    ? "border-red-500 bg-red-50/30 text-red-900"
    : "border-gray-300 bg-white text-slate-700 hover:border-[#C5A059]";

  return (
    <div className="relative w-full" ref={containerRef}>
      <div
        className={`w-full h-11 px-3 rounded-xl border flex items-center justify-between transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[#C5A059]/20 font-medium text-sm ${baseClass} ${
          !disabled ? "cursor-pointer" : ""
        }`}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            setSearchTerm("");
          }
        }}
      >
        <span className={`truncate ${!selectedOption ? "text-gray-400 font-normal" : ""}`}>
          {selectedOption ? selectedOption.name : placeholder}
        </span>
        <ChevronDown
          size={16}
          className={`transition-transform duration-200 ${isOpen ? "rotate-180 text-[#C5A059]" : "text-gray-400"}`}
        />
      </div>

      {isOpen && !disabled && (
        <div className="absolute z-[100] w-full mt-2 bg-white border border-gray-200 rounded-xl shadow-[0_10px_40px_-15px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden animate-in fade-in slide-in-from-top-2">
          <div className="p-2 border-b border-gray-100 bg-gray-50/50">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                className="w-full bg-white border border-gray-200 rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:border-[#C5A059] focus:ring-1 focus:ring-[#C5A059]/30 transition-all placeholder:text-gray-400"
                placeholder="Buscar por nombre..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                autoFocus
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-56 p-1 scrollbar-thin scrollbar-thumb-gray-200 scrollbar-track-transparent">
            {filteredOptions.length > 0 ? (
              filteredOptions.map((option) => (
                <div
                  key={option.id}
                  className={`px-3 py-2.5 text-sm rounded-lg cursor-pointer transition-colors flex items-center justify-between ${
                    value === option.id
                      ? "bg-[#C5A059]/10 text-[#C5A059] font-bold"
                      : "hover:bg-gray-50 text-slate-700 font-medium"
                  }`}
                  onClick={() => {
                    onChange(option.id);
                    setIsOpen(false);
                  }}
                >
                  <span className="truncate pr-2">{option.name}</span>
                  {value === option.id && <CheckCircle2 size={14} className="shrink-0" />}
                </div>
              ))
            ) : (
              <div className="px-3 py-4 text-sm text-gray-400 text-center flex flex-col items-center gap-2">
                <Search size={20} className="opacity-20" />
                {emptyMessage}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const PersonalDataStep = forwardRef<StepRef, PersonalDataStepProps>(
  ({ value, saving = false, onSave, onNext, onValidityChange }, ref) => {
    
    const router = useRouter();
    const [form, setForm] = useState<PersonalInformation>(
      value ?? emptyPersonalInformation,
    );

    const [isReniecFetched, setIsReniecFetched] = useState(false);

    const [touched, setTouched] = useState<Record<string, boolean>>({});
    const [errors, setErrors] = useState<Record<string, string>>({});
    const [globalError, setGlobalError] = useState<string | null>(null);
    const [searchFeedback, setSearchFeedback] = useState<{ type: 'success' | 'warning', message: string } | null>(null);

    const [isSearching, setIsSearching] = useState(false);
    const [isFormEnabled, setIsFormEnabled] = useState(false);
    const [flowStatus, setFlowStatus] = useState<ValidationFlowStatus | null>(null);
    const [recoveryData, setRecoveryData] = useState<{ trackingCode: string; email: string } | null>(null);
    const [isUploadingFiles, setIsUploadingFiles] = useState(false);
    
    const [securePhotoUrl, setSecurePhotoUrl] = useState<string | null>(null);
    const [secureDniUrl, setSecureDniUrl] = useState<string | null>(null);

    const [showDraftModal, setShowDraftModal] = useState(false);
    const [showOtpModal, setShowOtpModal] = useState(false);
    const [showAssociateModal, setShowAssociateModal] = useState(false);
    const [otpCode, setOtpCode] = useState("");
    const [otpError, setOtpError] = useState("");
    const [isOtpProcessing, setIsOtpProcessing] = useState(false);

    const [countries, setCountries] = useState<CatalogItem[]>([]);
    const [departments, setDepartments] = useState<CatalogItem[]>([]);
    const [provinces, setProvinces] = useState<CatalogItem[]>([]);
    const [districts, setDistricts] = useState<CatalogItem[]>([]);

    useEffect(() => {
      if (value && value.documentNumber) {
        setForm(value);
        setIsFormEnabled(true);
      }
    }, [value]);

    useEffect(() => {
      const validator = new PersonalInformationValidator();
      const result = validator.validate(form);
      onValidityChange?.(isFormEnabled && result.valid);
    }, [form, isFormEnabled, onValidityChange]);

    useEffect(() => {
      const fetchSecureUrls = async () => {
        if (form.photo && !(form.photo instanceof File) && (form.photo as any).url) {
          try {
            const url = await applicationApi.getSecureFileUrl((form.photo as any).url);
            setSecurePhotoUrl(url);
          } catch (e) { console.error("Error al cargar foto de S3"); }
        }

        if (form.identityDocument && !(form.identityDocument instanceof File) && (form.identityDocument as any).url) {
          try {
            const url = await applicationApi.getSecureFileUrl((form.identityDocument as any).url);
            setSecureDniUrl(url);
          } catch (e) { console.error("Error al cargar documento de S3"); }
        }
      };

      fetchSecureUrls();
    }, [form.photo, form.identityDocument]);

    // Fetchers en cascada
    useEffect(() => {
      fetch("/api/catalogs/countries")
        .then(async (res) => {
          if (!res.ok) throw new Error(`Error API Países: ${res.status}`);
          return res.json();
        })
        .then((data) => setCountries(data))
        .catch((err) => console.error("Error cargando países:", err));
    }, []);

    useEffect(() => {
      if (form.countryId && form.countryId !== 0) {
        fetch(`/api/catalogs/${form.countryId}/departments`)
          .then(async (res) => {
            if (!res.ok) throw new Error(`Error API Departamentos: ${res.status}`);
            return res.json();
          })
          .then((data) => setDepartments(data))
          .catch((err) => console.error("Error cargando departamentos:", err));
      } else {
        setDepartments([]);
      }
    }, [form.countryId]);

    useEffect(() => {
      if (form.departmentId) {
        fetch(`/api/catalogs/${form.departmentId}/provinces`)
          .then(async (res) => {
            if (!res.ok) throw new Error(`Error API Provincias: ${res.status}`);
            return res.json();
          })
          .then((data) => setProvinces(data))
          .catch((err) => console.error("Error cargando provincias:", err));
      } else {
        setProvinces([]);
      }
    }, [form.departmentId]);

    useEffect(() => {
      if (form.provinceId) {
        fetch(`/api/catalogs/${form.provinceId}/districts`)
          .then(async (res) => {
            if (!res.ok) throw new Error(`Error API Distritos: ${res.status}`);
            return res.json();
          })
          .then((data) => setDistricts(data))
          .catch((err) => console.error("Error cargando distritos:", err));
      } else {
        setDistricts([]);
      }
    }, [form.provinceId]);

    const handleSearchDocument = async () => {
      setTouched((prev) => ({ ...prev, documentType: true, documentNumber: true }));
      
      const validator = new PersonalInformationValidator();
      const currentResult = validator.validate(form);
      const docTypeError = currentResult.errors.find(e => e.field === "documentType");
      const docNumError = currentResult.errors.find(e => e.field === "documentNumber");

      if (docTypeError || docNumError) {
        setGlobalError("Revise los errores en el tipo o número de documento antes de buscar.");
        return;
      }

      setIsSearching(true);
      setGlobalError(null);
      setSearchFeedback(null);
      setIsFormEnabled(false);

      try {
        const response = await applicationApi.validateDocument(form.documentType, form.documentNumber);
        setFlowStatus(response.status);

        switch (response.status) {
          case "NEW":
            setIsFormEnabled(true);
            if (response.person?.firstName) {
              setIsReniecFetched(true);
              setSearchFeedback({ type: 'success', message: 'Datos identificados exitosamente.' });
              setForm(prev => ({
                ...prev,
                names: response.person!.firstName,
                fatherLastName: response.person!.paternalLastName,
                motherLastName: response.person!.maternalLastName || "",
              }));
            } else {
              setIsReniecFetched(false);
              setSearchFeedback({ type: 'warning', message: 'Documento no encontrado. Por favor, ingrese sus datos manualmente.' });
            }
            break;
          case "REJECTED":
            setIsFormEnabled(true);
            // Si la respuesta incluye nombres cargados previamente de RENIEC, se bloquea; de lo contrario no
            if (response.person?.firstName) {
              setIsReniecFetched(true);
            } else {
              setIsReniecFetched(false);
            }
            setSearchFeedback({ type: 'warning', message: 'Existe una solicitud anterior no procedente. Puede iniciar una nueva postulación.' });
            setForm(prev => ({
              ...prev,
              names: response.person?.firstName || "",
              fatherLastName: response.person?.paternalLastName || "",
              motherLastName: response.person?.maternalLastName || "",
            }));
            break;
          case "DRAFT":
            setIsReniecFetched(false);
            if (response.trackingCode && response.email) {
              setRecoveryData({ trackingCode: response.trackingCode, email: response.email });
              setShowDraftModal(true);
            }
            break;
          case "ASSOCIATE":
          case "APPROVED":
            setIsReniecFetched(false);
            setShowAssociateModal(true);
            break;
        }
      } catch (err: any) {
        setIsReniecFetched(false);
        setGlobalError("Ocurrió un error al consultar el documento en el servidor.");
      } finally {
        setIsSearching(false);
      }
    };

    const handleSendOtp = async () => {
      if (!recoveryData) return;
      setIsOtpProcessing(true);
      try {
        await applicationApi.sendRecoveryOtp(recoveryData.trackingCode);
        setShowDraftModal(false);
        setShowOtpModal(true);
      } catch (err: any) {
        setOtpError("Error al enviar el código. Intente nuevamente.");
      } finally {
        setIsOtpProcessing(false);
      }
    };

    const handleVerifyOtp = async () => {
      if (!recoveryData || otpCode.length < 6) return;
      setIsOtpProcessing(true);
      setOtpError("");
      try {
        await applicationApi.verifyRecoveryOtp(recoveryData.trackingCode, otpCode);
        window.location.href = `?trackingCode=${recoveryData.trackingCode}`;
      } catch (err: any) {
        setOtpError(err.message || "Código incorrecto.");
      } finally {
        setIsOtpProcessing(false);
      }
    };

    function updateField<K extends keyof PersonalInformation>(
      field: K,
      rawValue: PersonalInformation[K],
    ) {
      let sanitizedValue = rawValue;
      let instantWarning = "";

      if (typeof rawValue === "string") {
        if (["names", "fatherLastName", "motherLastName"].includes(field)) {
          sanitizedValue = rawValue.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ\s]/g, "").slice(0, 100) as any;
        } else if (field === "phone") {
          sanitizedValue = rawValue.replace(/\D/g, "").slice(0, 9) as any;
        } else if (field === "documentNumber") {
          if (form.documentType === "DNI") {
            sanitizedValue = rawValue.replace(/\D/g, "").slice(0, 8) as any;
          } else {
            sanitizedValue = rawValue.replace(/[^A-Za-z0-9]/gi, "").slice(0, 12) as any;
          }
        } else if (field === "address") {
          sanitizedValue = rawValue.replace(/[^A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s,.\-°]/g, "").slice(0, 250) as any;
        }
      }

      const newForm = { ...form, [field]: sanitizedValue };

      // Reseteos en cascada al cambiar ubicación
      if (field === "documentType") {
        newForm.documentNumber = "";
        // Si selecciona Carné de Extranjería o Pasaporte, se activa la edición manual
        if (sanitizedValue === "CE" || sanitizedValue === "PASSPORT") {
          setIsFormEnabled(true);
          setIsReniecFetched(false);
        } else if (sanitizedValue === "DNI") {
          // Si selecciona DNI, se bloquea el formulario a la espera de la búsqueda RENIEC
          setIsFormEnabled(false);
          setIsReniecFetched(false);
        }
      } else if (field === "countryId") {
        newForm.departmentId = undefined;
        newForm.provinceId = undefined;
        newForm.districtId = undefined;
      } else if (field === "departmentId") {
        newForm.provinceId = undefined;
        newForm.districtId = undefined;
      } else if (field === "provinceId") {
        newForm.districtId = undefined;
      }

      setTouched((prev) => ({ ...prev, [field]: true }));
      setGlobalError(null);
      setSearchFeedback(null);
      setForm(newForm);

      const validator = new PersonalInformationValidator();
      const result = validator.validate(newForm);
      const fieldError = result.errors.find((err) => err.field === field);

      setErrors((prev) => ({
        ...prev,
        [field]: instantWarning || (fieldError ? fieldError.message : ""),
      }));
    }

    function handleBlur(field: keyof PersonalInformation) {
      setTouched((prev) => ({ ...prev, [field]: true }));
    }

    // ========================================================
    // LOGICA DE SUBIDA A S3 Y GUARDADO 
    // ========================================================
    useImperativeHandle(ref, () => ({
      submit: async () => {
        setGlobalError(null);
        if (!isFormEnabled) return;

        const allTouched: Record<string, boolean> = {};
        Object.keys(emptyPersonalInformation).forEach(
          (key) => (allTouched[key] = true),
        );
        setTouched(allTouched);

        const validator = new PersonalInformationValidator();
        const result = validator.validate(form);

        if (!result.valid) {
          const newErrors: Record<string, string> = {};
          result.errors.forEach((err) => {
            newErrors[err.field] = err.message;
          });
          setErrors(newErrors);
          return;
        }

        try {
          setIsUploadingFiles(true);
          
          let photoPayload: any = form.photo;
          let identityDocPayload: any = form.identityDocument;

          if (typeof window !== "undefined" && form.photo instanceof window.File) {
            photoPayload = await applicationApi.uploadFile(form.photo as File, "afiliaciones/fotos");
          }

          if (typeof window !== "undefined" && form.identityDocument instanceof window.File) {
            identityDocPayload = await applicationApi.uploadFile(form.identityDocument as File, "afiliaciones/documentos");
          }

          const formWithS3Urls: any = {
            ...form,
            photo: photoPayload,
            identityDocument: identityDocPayload
          };

          await onSave(formWithS3Urls);
          onNext();

        } catch (error: any) {
          setGlobalError(error.message || "Ocurrió un error al subir los archivos a S3 o guardar los datos.");
        } finally {
          setIsUploadingFiles(false);
        }
      },
    }));

    // ========================================================
    // CLASES VISUALES DINÁMICAS
    // ========================================================
    const getSearchInputClass = (field: keyof PersonalInformation, isGrouped: boolean = false) => {
      const hasError = touched[field] && errors[field];
      const baseRounded = isGrouped ? "rounded-l-xl border-r-0" : "rounded-xl";
      return `w-full h-12 px-3 text-sm focus:outline-none focus:ring-2 relative focus:z-10 font-medium transition-colors ${baseRounded} ${
        hasError
          ? "border border-red-500 focus:ring-red-200 bg-red-50/30 text-red-900 placeholder:text-red-400"
          : "border border-gray-300 focus:border-[#C5A059] focus:ring-[#C5A059]/20 bg-white text-slate-700"
      }`;
    };

    const getInputClass = (field: keyof PersonalInformation, isDisabledField: boolean = false) => {
      //Estado Bloqueado (ya sea por Formulario deshabilitado o por RENIEC)
      if (!isFormEnabled || isDisabledField) {
        return "w-full h-11 px-3 rounded-xl border border-gray-200 bg-gray-100 text-slate-500 font-medium cursor-not-allowed focus:outline-none transition-colors select-none";
      }
      const hasError = touched[field] && errors[field];
      return `w-full h-11 px-3 rounded-xl border focus:outline-none focus:ring-2 font-medium text-sm transition-colors ${
        hasError
          ? "border-red-500 focus:ring-red-200 bg-red-50/30 text-red-900"
          : "border-gray-300 focus:border-[#C5A059] focus:ring-[#C5A059]/20 bg-white text-slate-700"
      }`;
    };

    const getErrorText = (field: keyof PersonalInformation) => {
      if (!isFormEnabled && field !== "documentType" && field !== "documentNumber") return null;
      return touched[field] && errors[field] ? (
        <span className="text-red-500 text-xs mt-1.5 font-bold block animate-in fade-in slide-in-from-top-1">
          {errors[field]}
        </span>
      ) : null;
    };

    const getDropzoneClass = (field: string) => {
      if (!isFormEnabled) {
        return "relative overflow-hidden h-[260px] w-full border-2 border-dashed border-gray-200 rounded-2xl p-6 flex flex-col items-center justify-center text-center cursor-not-allowed bg-[#f8f9fa] transition-colors";
      }
      const hasError = touched[field] && errors[field];
      return `group cursor-pointer relative overflow-hidden h-[260px] w-full border-2 border-dashed rounded-2xl p-6 transition-all duration-300 flex flex-col items-center justify-center text-center ${
        hasError ? "border-red-400 bg-red-50/30" : "border-gray-300 hover:border-[#C5A059] hover:bg-gray-50 bg-white"
      }`;
    };

    // Construcción de Previsualizaciones (Local vs S3)
    let fotoPreviewFinal: string | null = null;
    if (typeof window !== "undefined" && form.photo instanceof window.File) {
      fotoPreviewFinal = URL.createObjectURL(form.photo as File);
    } else if (securePhotoUrl) {
      fotoPreviewFinal = securePhotoUrl;
    }

    let dniPreviewFinal: { name: string; url: string; type: string } | null = null;
    if (typeof window !== "undefined" && form.identityDocument instanceof window.File) {
      dniPreviewFinal = {
        name: (form.identityDocument as File).name,
        url: URL.createObjectURL(form.identityDocument as File),
        type: (form.identityDocument as File).type,
      };
    } else if (secureDniUrl && form.identityDocument) {
      dniPreviewFinal = {
        name: (form.identityDocument as any).name || "Documento Guardado",
        url: secureDniUrl,
        type: (form.identityDocument as any).type || "application/pdf",
      };
    }

    // LOGICA DE DESHABILITACIÓN EN CASCADA
    const isDeptDisabled = !isFormEnabled || !form.countryId || departments.length === 0;
    const isProvDisabled = isDeptDisabled || !form.departmentId || provinces.length === 0;
    const isDistDisabled = isProvDisabled || !form.provinceId || districts.length === 0;

    return (
      <div className="space-y-8">

        {isUploadingFiles && (
          <div className="fixed inset-0 z-[200] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 flex flex-col items-center shadow-2xl animate-in zoom-in-95">
              <svg className="animate-spin h-12 w-12 text-[#C5A059] mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <h3 className="text-lg font-bold text-[#2F3136]">Subiendo documentos...</h3>
              <p className="text-sm text-gray-500 mt-2">Asegurando sus archivos en la nube de AWS.</p>
            </div>
          </div>
        )}
        
        {/* MODALES REACTIVOS */}
        {showDraftModal && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
              <div className="w-16 h-16 bg-[#C5A059]/10 rounded-full flex items-center justify-center mb-6 mx-auto">
                <Clock className="w-8 h-8 text-[#C5A059]" />
              </div>
              <h3 className="text-xl font-bold text-center text-[#2F3136] mb-3">Encontramos una postulación en proceso</h3>
              <p className="text-sm text-gray-500 text-center mb-6 leading-relaxed">
                Hemos encontrado una solicitud en estado de borrador asociada al documento ingresado. Enviaremos un código de seguridad a <strong>{recoveryData?.email}</strong> para que puedas continuar donde te quedaste.
              </p>
              <div className="flex flex-col gap-3">
                <button onClick={handleSendOtp} disabled={isOtpProcessing} className="w-full h-12 bg-[#2F3136] text-white rounded-xl font-bold text-sm hover:bg-black transition-colors flex items-center justify-center">
                  {isOtpProcessing ? "Enviando..." : "Enviar código de verificación"}
                </button>
                <button onClick={() => setShowDraftModal(false)} className="w-full h-12 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {showOtpModal && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
              <div className="w-16 h-16 bg-[#2F3136]/5 rounded-full flex items-center justify-center mb-6 mx-auto">
                <ShieldAlert className="w-8 h-8 text-[#2F3136]" />
              </div>
              <h3 className="text-xl font-bold text-center text-[#2F3136] mb-2">Verificación de Seguridad</h3>
              <p className="text-sm text-gray-500 text-center mb-6">Ingresa el código de 6 dígitos enviado a tu correo.</p>
              
              {otpError && <p className="text-xs text-red-500 text-center mb-4 font-bold">{otpError}</p>}
              
              <input 
                type="text" 
                maxLength={6} 
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                className="w-full h-14 bg-gray-50 border border-gray-200 rounded-xl text-center text-2xl tracking-[0.5em] font-bold text-[#C5A059] focus:outline-none focus:border-[#C5A059] focus:ring-2 focus:ring-[#C5A059]/20 mb-6"
                placeholder="------"
              />

              <div className="flex flex-col gap-3">
                <button onClick={handleVerifyOtp} disabled={isOtpProcessing || otpCode.length < 6} className="w-full h-12 bg-[#C5A059] text-white rounded-xl font-bold text-sm hover:bg-[#b58f48] disabled:opacity-50 transition-colors">
                  {isOtpProcessing ? "Verificando..." : "Validar Código"}
                </button>
                <button onClick={() => setShowOtpModal(false)} className="w-full h-12 bg-white text-gray-500 font-bold text-sm hover:underline transition-colors">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {showAssociateModal && (
          <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl animate-in zoom-in-95">
              <div className="w-16 h-16 bg-emerald-50 rounded-full flex items-center justify-center mb-6 mx-auto">
                <UserCircle2 className="w-8 h-8 text-emerald-600" />
              </div>
              <h3 className="text-xl font-bold text-center text-[#2F3136] mb-3">Ya eres parte del IIMP</h3>
              <p className="text-sm text-gray-500 text-center mb-8 leading-relaxed">
                El documento ingresado pertenece a un Asociado Activo o tiene una postulación aprobada. No es necesario registrar una nueva solicitud.
              </p>
              <div className="flex flex-col gap-3">
                <button onClick={() => router.push("/login")} className="w-full h-12 bg-[#2F3136] text-white rounded-xl font-bold text-sm hover:bg-black transition-colors">
                  Ir al Portal del Asociado
                </button>
                <button onClick={() => setShowAssociateModal(false)} className="w-full h-12 bg-white border border-gray-200 text-gray-600 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors">
                  Cerrar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* TARJETA 1: VERIFICACIÓN RENIEC */}
        {globalError && (
          <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 font-bold text-sm flex items-center gap-3 shadow-sm">
            <XCircle className="w-5 h-5 shrink-0" /> {globalError}
          </div>
        )}

        {searchFeedback && (
          <div className={`p-4 rounded-xl border font-bold text-sm flex items-center gap-3 shadow-sm ${searchFeedback.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-amber-50 border-amber-200 text-amber-700'}`}>
            {searchFeedback.type === 'success' ? <CheckCircle2 className="w-5 h-5 shrink-0" /> : <Info className="w-5 h-5 shrink-0" />}
            {searchFeedback.message}
          </div>
        )}

        <section className="bg-[#FCFAF6] rounded-3xl p-6 sm:p-8 shadow-sm border border-[#E8D09E]/50 relative z-30">
          <div className="flex flex-col md:flex-row justify-between md:items-start gap-6 border-b border-[#E8D09E]/30 pb-6 mb-8">
            <div className="flex items-start gap-5">
              <div className="w-14 h-14 shrink-0 rounded-full border-2 border-[#D6A84A] flex items-center justify-center bg-white shadow-sm">
                <Fingerprint size={28} className="text-[#C5A059]" />
              </div>
              <div>
                <span className="inline-block px-3 py-1 rounded-full bg-[#F4E9D8] text-[#A67C00] text-[10px] font-bold uppercase tracking-widest mb-2">
                  Integración RENIEC
                </span>
                <h2 className="text-2xl font-black text-[#1E293B]">
                  Verificación de Identidad
                </h2>
                <p className="text-sm text-gray-500 font-medium mt-1">
                  Consulte automáticamente la información del postulante desde
                  RENIEC.
                </p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-3 opacity-90">
              <Building2 size={36} className="text-[#C5A059]" />
              <div>
                <h3 className="font-black text-[#C5A059] text-2xl leading-none">
                  RENIEC
                </h3>
                <p className="text-[9px] text-[#C5A059] font-bold uppercase leading-tight mt-1">
                  Registro Nacional de Identificación
                  <br />y Estado Civil
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row justify-center items-start gap-6 max-w-3xl mx-auto">
            <div className="w-full md:w-1/2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                Tipo Documento <span className="text-red-500">*</span>
              </label>
              <SimpleSelect
                options={[
                  { id: "DNI", name: "DNI" },
                  { id: "CE", name: "Carné de Extranjería" },
                  { id: "PASSPORT", name: "Pasaporte" }
                ]}
                placeholder="Seleccionar documento"
                value={form.documentType}
                onChange={(val) => updateField("documentType", val)}
                onBlur={() => handleBlur("documentType")}
                disabled={false}
                hasError={touched.documentType && !!errors.documentType}
                heightClass="h-12"
              />
              {getErrorText("documentType")}
            </div>

            <div className="w-full md:w-1/2">
              <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5 tracking-wide">
                Número Documento <span className="text-red-500">*</span>
              </label>
              <div className="flex">
                <input
                  type="text"
                  placeholder="Ingrese número de documento"
                  value={form.documentNumber}
                  onChange={(e) => updateField("documentNumber", e.target.value)}
                  onBlur={() => handleBlur("documentNumber")}
                  className={`h-12 ${getSearchInputClass("documentNumber", true)}`}
                />
                <button
                  type="button"
                  onClick={handleSearchDocument}
                  disabled={ isSearching || !form.documentNumber || form.documentType !== "DNI" }
                  className={`h-12 px-5 flex items-center justify-center rounded-r-xl transition-all duration-300 border-y border-r shadow-sm z-0 ${
                    isSearching || !form.documentNumber || form.documentType !== "DNI"
                      ? "bg-gray-200 text-gray-400 border-gray-200 cursor-not-allowed shadow-none"
                      : "bg-[#D4A353] hover:bg-[#C5A059] text-white border-[#D4A353] hover:border-[#C5A059]"
                  }`}
                >
                  {isSearching ? (
                    <svg className="animate-spin h-5 w-5 text-white/70" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  ) : (
                    <Search size={20} strokeWidth={2.5} />
                  )}
                </button>
              </div>
              {getErrorText("documentNumber")}
            </div>
          </div>
        </section>

        {/* TARJETA 2: INFORMACIÓN PERSONAL */}
        <section className="bg-white rounded-3xl border border-gray-200 shadow-sm transition-all duration-300 relative z-20">
          <div className="px-8 py-5 border-b border-gray-100 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#C5A059]/10 flex items-center justify-center">
              <UserCircle2 className="w-5 h-5 text-[#C5A059]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2F3136] tracking-tight">
                Información Personal
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Revise o complete sus datos principales.
              </p>
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">
                  Nombres <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isFormEnabled || isReniecFetched}
                  value={form.names}
                  onChange={(e) => updateField("names", e.target.value)}
                  onBlur={() => handleBlur("names")}
                  className={getInputClass("names", isReniecFetched)}
                />
                {getErrorText("names")}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">
                  Apellido Paterno <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isFormEnabled || isReniecFetched}
                  value={form.fatherLastName}
                  onChange={(e) =>
                    updateField("fatherLastName", e.target.value)
                  }
                  onBlur={() => handleBlur("fatherLastName")}
                  className={getInputClass("fatherLastName", isReniecFetched)}
                />
                {getErrorText("fatherLastName")}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">
                  Apellido Materno <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isFormEnabled || isReniecFetched}
                  value={form.motherLastName}
                  onChange={(e) =>
                    updateField("motherLastName", e.target.value)
                  }
                  onBlur={() => handleBlur("motherLastName")}
                  className={getInputClass("motherLastName", isReniecFetched)}
                />
                {getErrorText("motherLastName")}
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">
                  F. de Nacimiento <span className="text-red-500">*</span>
                </label>
                <PremiumDatePicker
                  value={form.birthDate}
                  onChange={(val) => updateField("birthDate", val)}
                  onBlur={() => handleBlur("birthDate")}
                  disabled={!isFormEnabled}
                  hasError={touched.birthDate && !!errors.birthDate}
                />
                {getErrorText("birthDate")}
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-gray-100">
              <h3 className="font-bold text-sm text-[#2F3136] uppercase tracking-wide mb-5">
                Contacto y Género
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">
                    Género <span className="text-red-500">*</span>
                  </label>
                  <SimpleSelect
                    options={[
                      { id: "MALE", name: "Masculino" },
                      { id: "FEMALE", name: "Femenino" }
                    ]}
                    placeholder="Seleccione..."
                    value={form.gender}
                    onChange={(val) => updateField("gender", val)}
                    onBlur={() => handleBlur("gender")}
                    disabled={!isFormEnabled}
                    hasError={touched.gender && !!errors.gender}
                    heightClass="h-11"
                  />
                  {getErrorText("gender")}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">
                    Celular <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    disabled={!isFormEnabled}
                    value={form.phone}
                    onChange={(e) => updateField("phone", e.target.value)}
                    onBlur={() => handleBlur("phone")}
                    className={getInputClass("phone")}
                  />
                  {getErrorText("phone")}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">
                    Correo Primario <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    disabled={!isFormEnabled}
                    placeholder="ejemplo@correo.com"
                    value={form.primaryEmail}
                    onChange={(e) =>
                      updateField("primaryEmail", e.target.value)
                    }
                    onBlur={() => handleBlur("primaryEmail")}
                    className={getInputClass("primaryEmail")}
                  />
                  {getErrorText("primaryEmail")}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">
                    Correo Secundario
                  </label>
                  <input
                    type="email"
                    disabled={!isFormEnabled}
                    placeholder="Opcional"
                    value={form.secondaryEmail ?? ""}
                    onChange={(e) =>
                      updateField("secondaryEmail", e.target.value)
                    }
                    onBlur={() => handleBlur("secondaryEmail")}
                    className={getInputClass("secondaryEmail")}
                  />
                  {getErrorText("secondaryEmail")}
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-gray-100">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-5 gap-3">
                <h3 className="font-bold text-sm text-[#2F3136] uppercase tracking-wide">
                  Ubicación Geográfica
                </h3>
                {isFormEnabled && (
                  <div className="bg-blue-50 text-blue-700 border border-blue-100 text-[11px] px-3 py-1.5 rounded-full font-bold flex items-center gap-1.5 shadow-sm">
                    <Info size={14} className="shrink-0" />
                    <span>
                      {!form.countryId 
                        ? "Seleccione un país para desglosar sus subdivisiones." 
                        : departments.length === 0 
                        ? "El país seleccionado no requiere subdivisiones adicionales." 
                        : "Las opciones se habilitan según la disponibilidad del país seleccionado."}
                    </span>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">
                    País <span className="text-red-500">*</span>
                  </label>
                  <SearchableSelect
                    options={countries}
                    placeholder="Seleccione..."
                    value={form.countryId}
                    onChange={(val) => updateField("countryId", val === "" ? 0 : val)}
                    onBlur={() => handleBlur("countryId")}
                    disabled={!isFormEnabled}
                    hasError={touched.countryId && !!errors.countryId}
                  />
                  {getErrorText("countryId")}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">
                    Departamento{" "}
                    {form.countryId === 1 && (
                      <span className="text-red-500">*</span>
                    )}
                  </label>
                  <SearchableSelect
                    options={departments}
                    placeholder={
                      !form.countryId
                        ? "Seleccione..."
                        : departments.length === 0
                        ? "País sin departamentos"
                        : "Seleccione..."
                    }
                    value={form.departmentId}
                    onChange={(val) => updateField("departmentId", val === "" ? undefined : val)}
                    onBlur={() => handleBlur("departmentId")}
                    disabled={isDeptDisabled}
                    hasError={touched.departmentId && !!errors.departmentId}
                    emptyMessage="País sin departamentos"
                  />
                  {getErrorText("departmentId")}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">
                    Provincia{" "}
                    {form.countryId === 1 && (
                      <span className="text-red-500">*</span>
                    )}
                  </label>
                  <SearchableSelect
                    options={provinces}
                    placeholder={
                      !form.departmentId
                        ? "Seleccione..."
                        : provinces.length === 0
                        ? "Departamento sin provincias"
                        : "Seleccione..."
                    }
                    value={form.provinceId}
                    onChange={(val) => updateField("provinceId", val === "" ? undefined : val)}
                    onBlur={() => handleBlur("provinceId")}
                    disabled={isProvDisabled}
                    hasError={touched.provinceId && !!errors.provinceId}
                    emptyMessage="Departamento sin provincias"
                  />
                  {getErrorText("provinceId")}
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">
                    Distrito{" "}
                    {form.countryId === 1 && (
                      <span className="text-red-500">*</span>
                    )}
                  </label>
                  <SearchableSelect
                    options={districts}
                    placeholder={
                      !form.provinceId
                        ? "Seleccione..."
                        : districts.length === 0
                        ? "Provincia sin distritos"
                        : "Seleccione..."
                    }
                    value={form.districtId}
                    onChange={(val) => updateField("districtId", val === "" ? undefined : val)}
                    onBlur={() => handleBlur("districtId")}
                    disabled={isDistDisabled}
                    hasError={touched.districtId && !!errors.districtId}
                    emptyMessage="Provincia sin distritos"
                  />
                  {getErrorText("districtId")}
                </div>
              </div>

              <div className="mt-6">
                <label className="text-xs font-bold text-slate-700 mb-1.5 block uppercase">
                  Dirección Completa <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  disabled={!isFormEnabled}
                  placeholder="Ej. Av. Los Canarios 155, Urb. San César..."
                  value={form.address}
                  onChange={(e) => updateField("address", e.target.value)}
                  onBlur={() => handleBlur("address")}
                  className={getInputClass("address")}
                />
                {getErrorText("address")}
              </div>
            </div>
          </div>
        </section>

        {/* TARJETA 5: DOCUMENTOS */}
        <section className="bg-white rounded-3xl border border-gray-200 overflow-hidden shadow-sm mb-8 transition-all duration-300 relative z-10">
          <div className="px-8 py-5 border-b border-gray-100 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-[#C5A059]/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-[#C5A059]" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2F3136] tracking-tight">
                Carga de Documentos
              </h2>
              <p className="text-xs text-gray-500 font-medium">
                Adjunte los documentos obligatorios.
              </p>
            </div>
          </div>

          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className={getDropzoneClass("photo")}>
                  <input
                    type="file"
                    accept="image/*"
                    disabled={!isFormEnabled}
                    onChange={(e) =>
                      updateField("photo", e.target.files?.[0] ?? null)
                    }
                    className="hidden"
                  />
                  {fotoPreviewFinal ? (
                    <div className="w-full h-full absolute inset-0 bg-black/5 flex items-center justify-center">
                      <img
                        src={fotoPreviewFinal}
                        alt="Preview"
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-60 transition-opacity"
                      />
                      {isFormEnabled && (
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm cursor-pointer">
                          <span className="bg-white/90 px-4 py-2 rounded-xl text-sm font-bold text-[#2F3136] flex items-center gap-2 shadow-lg">
                            <UploadCloud size={16} /> Cambiar Foto
                          </span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <>
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-colors ${!isFormEnabled ? "bg-[#e2e8f0] text-[#9ca3af]" : "bg-gray-100 text-gray-400 group-hover:bg-[#C5A059]/10 group-hover:text-[#C5A059]"}`}>
                        <ImageIcon className="w-6 h-6" />
                      </div>
                      <h3 className={`text-sm font-bold mb-1 ${!isFormEnabled ? "text-[#9ca3af]" : "text-[#2F3136]"}`}>
                        Fotografía Personal
                      </h3>
                      <p className={`text-xs mb-4 max-w-[200px] ${!isFormEnabled ? "text-[#9ca3af]" : "text-gray-500"}`}>
                        Tamaño carnet o pasaporte, fondo claro y alta
                        resolución.
                      </p>
                      {isFormEnabled && (
                        <div className="inline-flex items-center gap-2 text-[#C5A059] font-bold text-xs uppercase tracking-wider">
                          <UploadCloud size={16} /> Seleccionar Archivo
                        </div>
                      )}
                    </>
                  )}
                </label>
                {getErrorText("photo")}
              </div>

              <div>
                <label className={getDropzoneClass("identityDocument")}>
                  <input
                    type="file"
                    accept=".pdf,image/*"
                    disabled={!isFormEnabled}
                    onChange={(e) =>
                      updateField(
                        "identityDocument",
                        e.target.files?.[0] ?? null,
                      )
                    }
                    className="hidden"
                  />
                  {dniPreviewFinal ? (
                    dniPreviewFinal.type.startsWith("image/") ? (
                      <div className="w-full h-full absolute inset-0 bg-black/5 flex items-center justify-center">
                        <img
                          src={dniPreviewFinal.url}
                          alt="DNI Preview"
                          className="w-full h-full object-cover opacity-90 group-hover:opacity-60 transition-opacity"
                        />
                        {isFormEnabled && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm cursor-pointer">
                            <span className="bg-white/90 px-4 py-2 rounded-xl text-sm font-bold text-[#2F3136] flex items-center gap-2 shadow-lg">
                              <UploadCloud size={16} /> Cambiar DNI
                            </span>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 w-full bg-[#2F3136]/90 text-white text-[10px] truncate px-3 py-1.5 text-center font-medium backdrop-blur-md">
                          {dniPreviewFinal.name}
                        </div>
                      </div>
                    ) : dniPreviewFinal.type === "application/pdf" ? (
                      <div className="w-full h-full absolute inset-0 bg-white flex flex-col items-center justify-center overflow-hidden">
                        <iframe
                          src={`${dniPreviewFinal.url}#toolbar=0&navpanes=0&scrollbar=0`}
                          className="w-full h-full pointer-events-none"
                          title="DNI PDF Preview"
                        />
                        {isFormEnabled && (
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 backdrop-blur-sm cursor-pointer">
                            <span className="bg-white/90 px-4 py-2 rounded-xl text-sm font-bold text-[#2F3136] flex items-center gap-2 shadow-lg">
                              <UploadCloud size={16} /> Cambiar DNI (PDF)
                            </span>
                          </div>
                        )}
                        <div className="absolute bottom-0 left-0 w-full bg-[#2F3136]/90 text-white text-[10px] truncate px-3 py-1.5 text-center font-medium backdrop-blur-md z-10">
                          {dniPreviewFinal.name}
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full w-full relative z-10">
                        <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-colors ${!isFormEnabled ? "bg-[#e2e8f0] text-[#9ca3af]" : "bg-emerald-50 text-emerald-500"}`}>
                          <CheckCircle2 className="w-7 h-7" />
                        </div>
                        <h3 className={`text-sm font-bold mb-1 ${!isFormEnabled ? "text-[#9ca3af]" : "text-[#2F3136]"}`}>
                          Documento Cargado
                        </h3>
                        <p
                          className={`text-xs mb-4 truncate w-full max-w-[200px] ${!isFormEnabled ? "text-[#9ca3af]" : "text-gray-500"}`}
                          title={dniPreviewFinal.name}
                        >
                          {dniPreviewFinal.name}
                        </p>
                      </div>
                    )
                  ) : (
                    <>
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 transition-colors ${!isFormEnabled ? "bg-[#e2e8f0] text-[#9ca3af]" : "bg-gray-100 text-gray-400 group-hover:bg-[#C5A059]/10 group-hover:text-[#C5A059]"}`}>
                        <FileText className="w-6 h-6" />
                      </div>
                      <h3 className={`text-sm font-bold mb-1 ${!isFormEnabled ? "text-[#9ca3af]" : "text-[#2F3136]"}`}>
                        Documento de Identidad
                      </h3>
                      <p className={`text-xs mb-4 max-w-[200px] ${!isFormEnabled ? "text-[#9ca3af]" : "text-gray-500"}`}>
                        Adjunte DNI (ambos lados), CE o Pasaporte vigente.
                      </p>
                      {isFormEnabled && (
                        <div className="inline-flex items-center gap-2 text-[#C5A059] font-bold text-xs uppercase tracking-wider">
                          <UploadCloud size={16} /> Seleccionar Archivo
                        </div>
                      )}
                    </>
                  )}
                </label>
                {getErrorText("identityDocument")}
              </div>
            </div>
          </div>
        </section>

      </div>
    );
  }
);

PersonalDataStep.displayName = "PersonalDataStep";
export default PersonalDataStep;