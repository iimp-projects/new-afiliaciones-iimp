"use client";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";

type Decision = "APPROVE" | "REJECT";
type PageStatus = "IDLE" | "REJECT_FORM" | "LOADING" | "SUCCESS" | "ERROR";

export default function ReviewComitePage() {
  return (
    <Suspense fallback={null}>
      <ReviewComiteContent />
    </Suspense>
  );
}

function ReviewComiteContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const requested = searchParams.get("decision");
  const initialDecision: Decision | null =
    requested === "APPROVE" || requested === "REJECT" ? requested : null;

  const [status, setStatus] = useState<PageStatus>(initialDecision === "REJECT" ? "REJECT_FORM" : "IDLE");
  const [message, setMessage] = useState("");
  const [comment, setComment] = useState("");

  const handleAction = async (action: Decision) => {
    if (!token) return;
    if (action === "REJECT" && comment.trim().length === 0) {
      setStatus("REJECT_FORM");
      setMessage("Indique el motivo del rechazo.");
      return;
    }

    setStatus("LOADING");
    setMessage("");
    try {
      const res = await fetch("/api/afiliaciones/postulacion/comite/revisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action, comment: action === "REJECT" ? comment : undefined }),
      });

      const data = await res.json();
      if (data.success) {
        setStatus("SUCCESS");
        setMessage(action === "APPROVE" ? "Ha aprobado la postulación exitosamente." : "Ha rechazado la postulación.");
      } else {
        setStatus("ERROR");
        setMessage(data.message || "No se pudo registrar su respuesta.");
      }
    } catch {
      setStatus("ERROR");
      setMessage("Error de conexión.");
    }
  };

  if (!token) return <div className="p-10 text-center">Enlace inválido.</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full p-8 text-center">
        <img src="/images/logo-iimp.png" alt="IIMP" className="h-12 mx-auto mb-6" />

        {status === "IDLE" && (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Evaluación del Comité</h2>
            <p className="text-gray-600 mb-8">
              Usted ha sido designado como miembro del Comité Evaluador. ¿Aprueba la postulación para continuar con el proceso?
            </p>
            <div className="flex gap-4 justify-center">
              <button onClick={() => setStatus("REJECT_FORM")} className="px-6 py-3 rounded-xl border-2 border-red-200 text-red-600 font-bold hover:bg-red-50 transition-colors">
                Rechazar
              </button>
              <button onClick={() => handleAction("APPROVE")} className="px-6 py-3 rounded-xl bg-[#c39254] text-white font-bold hover:bg-[#a67c46] shadow-lg transition-colors">
                Sí, Aprobar
              </button>
            </div>
          </>
        )}

        {status === "REJECT_FORM" && (
          <>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Rechazar postulación</h2>
            <p className="text-gray-600 mb-4">Indique el motivo del rechazo. Esta información quedará registrada en el expediente.</p>
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={2000}
              rows={4}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-700 focus:outline-none focus:border-[#c39254] mb-2"
              placeholder="Motivo del rechazo"
            />
            {message && <p className="text-sm text-red-600 mb-3">{message}</p>}
            <div className="flex gap-4 justify-center mt-4">
              <button onClick={() => { setStatus("IDLE"); setMessage(""); }} className="px-6 py-3 rounded-xl border-2 border-gray-200 text-gray-600 font-bold hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button onClick={() => handleAction("REJECT")} className="px-6 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 shadow-lg transition-colors">
                Confirmar rechazo
              </button>
            </div>
          </>
        )}

        {status === "LOADING" && <div className="text-gray-500 font-bold">Procesando su respuesta...</div>}

        {status === "SUCCESS" && (
          <div className="flex flex-col items-center">
            <CheckCircle2 className="w-16 h-16 text-emerald-500 mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">¡Gracias por su tiempo!</h2>
            <p className="text-gray-600">{message}</p>
          </div>
        )}

        {status === "ERROR" && (
          <div className="flex flex-col items-center">
            <XCircle className="w-16 h-16 text-red-500 mb-4" />
            <h2 className="text-xl font-bold text-gray-800 mb-2">Ocurrió un problema</h2>
            <p className="text-gray-600">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
