"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, XCircle } from "lucide-react";

export default function ReviewEndorsementPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  
  const [status, setStatus] = useState<"IDLE" | "LOADING" | "SUCCESS" | "ERROR">("IDLE");
  const [message, setMessage] = useState("");

  const handleAction = async (action: "APPROVE" | "REJECT") => {
    setStatus("LOADING");
    try {
      const res = await fetch("/api/afiliaciones/avales/revisar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, action }),
      });
      
      const data = await res.json();
      
      if (data.success) {
        setStatus("SUCCESS");
        setMessage(action === "APPROVE" ? "Ha respaldado esta postulación exitosamente." : "Ha rechazado respaldar esta postulación.");
      } else {
        setStatus("ERROR");
        setMessage(data.message);
      }
    } catch (error) {
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
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Revisión de Postulación</h2>
            <p className="text-gray-600 mb-8">Usted ha sido designado como aval. ¿Desea respaldar la solicitud de este postulante?</p>
            <div className="flex gap-4 justify-center">
              <button onClick={() => handleAction("REJECT")} className="px-6 py-3 rounded-xl border-2 border-red-200 text-red-600 font-bold hover:bg-red-50 transition-colors">
                Rechazar
              </button>
              <button onClick={() => handleAction("APPROVE")} className="px-6 py-3 rounded-xl bg-[#c39254] text-white font-bold hover:bg-[#a67c46] shadow-lg transition-colors">
                Sí, Respaldar
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