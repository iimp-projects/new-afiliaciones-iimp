/**
 * Saneo de texto de observaciones en servidor.
 *
 * Elimina etiquetas HTML y normaliza espacios para que el valor almacenado sea
 * texto plano. React lo renderiza como texto (sin `dangerouslySetInnerHTML`).
 */
export function stripObservationMarkup(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/[<>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
