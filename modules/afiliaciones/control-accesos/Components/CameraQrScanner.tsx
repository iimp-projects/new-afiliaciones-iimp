"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, LoaderCircle } from "lucide-react";

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorLike = { detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]> };

declare global {
  interface Window {
    BarcodeDetector?: new (options?: { formats?: string[] }) => BarcodeDetectorLike;
  }
}

export function CameraQrScanner({ onDetected, disabled = false }: { onDetected: (value: string) => void; disabled?: boolean }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const stop = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setStarting(false);
  }, []);

  useEffect(() => () => stop(), [stop]);
  useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);

  const start = useCallback(async () => {
    setMessage(null);
    if (typeof window === "undefined" || !window.BarcodeDetector) {
      setMessage("La lectura por cámara no está soportada en este navegador. Use el lector USB o la búsqueda manual.");
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      setMessage("El navegador no permite acceder a la cámara. Use el lector USB o la búsqueda manual.");
      return;
    }
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) {
        stop();
        return;
      }
      video.srcObject = stream;
      await video.play();
      setActive(true);
      setStarting(false);

      const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      const loop = async () => {
        if (!streamRef.current || !videoRef.current) return;
        try {
          const found = await detector.detect(videoRef.current);
          const value = found[0]?.rawValue;
          if (value) {
            stop();
            onDetected(value);
            return;
          }
        } catch {
          // Frame no disponible; se reintenta.
        }
        timerRef.current = window.setTimeout(() => void loop(), 350);
      };
      void loop();
    } catch (error) {
      const name = error instanceof DOMException ? error.name : "";
      setMessage(
        name === "NotAllowedError"
          ? "Permiso de cámara denegado. Habilítalo en el navegador o use el lector USB."
          : name === "NotFoundError"
            ? "No se encontró una cámara disponible. Use el lector USB o la búsqueda manual."
            : name === "NotReadableError"
              ? "La cámara está ocupada por otra aplicación."
              : "No se pudo iniciar la cámara. Use el lector USB o la búsqueda manual.",
      );
      stop();
    }
  }, [onDetected, stop]);

  return (
    <div>
      <div className="relative aspect-video overflow-hidden rounded-xl border border-slate-200 bg-slate-900">
        <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
        {!active && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-slate-300">
            <Camera size={28} />
            <p className="px-6 text-center text-xs">Activa la cámara para leer el QR del carné.</p>
          </div>
        )}
        {active && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="h-40 w-40 rounded-2xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(2,6,23,0.35)]" />
          </div>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        {active ? (
          <button type="button" onClick={stop} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 text-xs font-semibold text-slate-600 hover:bg-slate-50">
            <CameraOff size={16} /> Detener cámara
          </button>
        ) : (
          <button type="button" onClick={() => void start()} disabled={starting || disabled} className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-[#a87924] px-4 text-xs font-semibold text-white hover:bg-[#8f661d] disabled:opacity-50">
            {starting ? <LoaderCircle size={16} className="animate-spin" /> : <Camera size={16} />} {starting ? "Iniciando…" : "Activar cámara"}
          </button>
        )}
      </div>
      {message && <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs leading-5 text-amber-800">{message}</p>}
      <p className="mt-2 text-[11px] leading-4 text-slate-400">La imagen no se almacena ni se envía; el QR se procesa en el navegador.</p>
    </div>
  );
}
