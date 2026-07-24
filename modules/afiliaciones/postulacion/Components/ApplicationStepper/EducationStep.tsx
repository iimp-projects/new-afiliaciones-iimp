import type { ApplicationDraft } from "../../Models/ApplicationDraft";

interface EducationStepProps {
  value?: ApplicationDraft["academicStudies"];

  saving?: boolean;

  onSave(studies: ApplicationDraft["academicStudies"]): Promise<void>;

  onNext(): void;

  onBack(): void;
}

export default function EducationStep({ onBack }: EducationStepProps) {
  return (
    <div className="rounded-xl border p-8 space-y-6">
      <h2 className="text-2xl font-semibold">Formación Académica</h2>

      <p>Próximamente...</p>

      <div className="flex justify-between">
        <button type="button" onClick={onBack}>
          Anterior
        </button>

        <button type="button">Guardar y continuar</button>
      </div>
    </div>
  );
}
