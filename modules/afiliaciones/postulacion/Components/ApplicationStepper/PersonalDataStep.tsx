"use client";

import { useEffect, useState } from "react";

import type { PersonalInformation } from "../../Models/PersonalInformation";

interface PersonalDataStepProps {
  value?: PersonalInformation;
  saving?: boolean;

  onSave(data: PersonalInformation): Promise<void>;

  onNext(): void;
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

export default function PersonalDataStep({
  value,
  saving = false,
  onSave,
  onNext,
}: PersonalDataStepProps) {
  const [form, setForm] = useState<PersonalInformation>(
    value ?? emptyPersonalInformation,
  );

  useEffect(() => {
    if (value) {
      setForm(value);
    }
  }, [value]);

  function updateField<K extends keyof PersonalInformation>(
    field: K,
    value: PersonalInformation[K],
  ) {
    setForm((previous) => ({
      ...previous,

      [field]: value,
    }));
  }

  async function handleSave() {
    await onSave(form);
  }

  async function handleNext() {
    await onSave(form);

    onNext();
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold">Información personal</h2>

        <p className="text-sm text-gray-500">
          Complete la información del postulante.
        </p>
      </div>

      {/* ==========================================
    IDENTIFICACIÓN
========================================== */}

      <section className="space-y-6">
        <h3 className="text-lg font-semibold">Identificación</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block mb-2 text-sm font-medium">
              Tipo de documento
            </label>

            <select
              value={form.documentType}
              onChange={(event) =>
                updateField("documentType", event.target.value)
              }
              className="w-full rounded-lg border px-4 py-2"
            >
              <option value="">Seleccione...</option>

              <option value="DNI">DNI</option>

              <option value="CE">Carné de Extranjería</option>

              <option value="PASSPORT">Pasaporte</option>
            </select>
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium">
              Número de documento
            </label>

            <input
              type="text"
              value={form.documentNumber}
              onChange={(event) =>
                updateField("documentNumber", event.target.value)
              }
              className="w-full rounded-lg border px-4 py-2"
            />
          </div>
        </div>
      </section>

      {/* ==========================================
    DATOS PERSONALES
========================================== */}

      <section className="space-y-6">
        <h3 className="text-lg font-semibold">Datos personales</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block mb-2 text-sm font-medium">Nombres</label>

            <input
              type="text"
              value={form.names}
              onChange={(event) => updateField("names", event.target.value)}
              className="w-full rounded-lg border px-4 py-2"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium">
              Apellido paterno
            </label>

            <input
              type="text"
              value={form.fatherLastName}
              onChange={(event) =>
                updateField("fatherLastName", event.target.value)
              }
              className="w-full rounded-lg border px-4 py-2"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium">
              Apellido materno
            </label>

            <input
              type="text"
              value={form.motherLastName}
              onChange={(event) =>
                updateField("motherLastName", event.target.value)
              }
              className="w-full rounded-lg border px-4 py-2"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium">
              Fecha de nacimiento
            </label>

            <input
              type="date"
              value={form.birthDate}
              onChange={(event) => updateField("birthDate", event.target.value)}
              className="w-full rounded-lg border px-4 py-2"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium">Género</label>

            <select
              value={form.gender}
              onChange={(event) => updateField("gender", event.target.value)}
              className="w-full rounded-lg border px-4 py-2"
            >
              <option value="">Seleccione...</option>

              <option value="MALE">Masculino</option>

              <option value="FEMALE">Femenino</option>
            </select>
          </div>
        </div>
      </section>

      {/* ==========================================
    CONTACTO
========================================== */}

      <section className="space-y-6">
        <h3 className="text-lg font-semibold">Información de contacto</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block mb-2 text-sm font-medium">Teléfono</label>

            <input
              type="text"
              value={form.phone}
              onChange={(event) => updateField("phone", event.target.value)}
              className="w-full rounded-lg border px-4 py-2"
            />
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium">
              Correo principal
            </label>

            <input
              type="email"
              value={form.primaryEmail}
              onChange={(event) =>
                updateField("primaryEmail", event.target.value)
              }
              className="w-full rounded-lg border px-4 py-2"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block mb-2 text-sm font-medium">
              Correo secundario
            </label>

            <input
              type="email"
              value={form.secondaryEmail ?? ""}
              onChange={(event) =>
                updateField("secondaryEmail", event.target.value)
              }
              className="w-full rounded-lg border px-4 py-2"
            />
          </div>
        </div>
      </section>

      {/* ==========================================
    UBICACIÓN
========================================== */}

      <section className="space-y-6">
        <h3 className="text-lg font-semibold">Ubicación</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block mb-2 text-sm font-medium">País</label>

            <select
              value={form.countryId}
              onChange={(event) =>
                updateField("countryId", Number(event.target.value))
              }
              className="w-full rounded-lg border px-4 py-2"
            >
              <option value={0}>Seleccione...</option>

              <option value={1}>Perú</option>
            </select>
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium">
              Departamento
            </label>

            <select
              value={form.departmentId ?? ""}
              onChange={(event) =>
                updateField("departmentId", Number(event.target.value))
              }
              className="w-full rounded-lg border px-4 py-2"
            >
              <option value="">Seleccione...</option>
            </select>
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium">Provincia</label>

            <select
              value={form.provinceId ?? ""}
              onChange={(event) =>
                updateField("provinceId", Number(event.target.value))
              }
              className="w-full rounded-lg border px-4 py-2"
            >
              <option value="">Seleccione...</option>
            </select>
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium">Distrito</label>

            <select
              value={form.districtId ?? ""}
              onChange={(event) =>
                updateField("districtId", Number(event.target.value))
              }
              className="w-full rounded-lg border px-4 py-2"
            >
              <option value="">Seleccione...</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <label className="block mb-2 text-sm font-medium">Dirección</label>

            <textarea
              rows={3}
              value={form.address}
              onChange={(event) => updateField("address", event.target.value)}
              className="w-full rounded-lg border px-4 py-2"
            />
          </div>
        </div>
      </section>

      {/* ==========================================
    DOCUMENTOS
========================================== */}

      <section className="space-y-6">
        <h3 className="text-lg font-semibold">Documentos</h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div>
            <label className="block mb-2 text-sm font-medium">Fotografía</label>

            <input
              type="file"
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;

                updateField("photo", file);
              }}
              className="block w-full"
            />

            {form.photo && (
              <p className="mt-2 text-sm text-green-600">{form.photo.name}</p>
            )}
          </div>

          <div>
            <label className="block mb-2 text-sm font-medium">
              Documento de identidad
            </label>

            <input
              type="file"
              accept=".pdf,image/*"
              onChange={(event) => {
                const file = event.target.files?.[0] ?? null;

                updateField("identityDocument", file);
              }}
              className="block w-full"
            />

            {form.identityDocument && (
              <p className="mt-2 text-sm text-green-600">
                {form.identityDocument.name}
              </p>
            )}
          </div>
        </div>
      </section>

      <div className="flex justify-end gap-3">
        <button type="button" onClick={handleSave} disabled={saving}>
          Guardar borrador
        </button>

        <button type="button" onClick={handleNext} disabled={saving}>
          Siguiente
        </button>
      </div>
    </div>
  );
}
