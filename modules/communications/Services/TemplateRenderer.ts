export interface TemplateRecipient {
  name?: string | null;
  company?: string | null;
  position?: string | null;
  email?: string | null;
  /** Variables específicas del origen "Asociados del sistema". */
  nombreCompleto?: string | null;
  correoAcceso?: string | null;
  tipoAsociado?: string | null;
  enlaceAcceso?: string | null;
  enlaceActivacion?: string | null;
}

/** Variables permitidas por whitelist. Cualquier otra queda literal. */
export const TEMPLATE_VARIABLES = new Set([
  "nombre",
  "empresa",
  "cargo",
  "email",
  "nombre_completo",
  "correo_acceso",
  "tipo_asociado",
  "enlace_acceso",
  "enlace_activacion",
]);

function valueFor(recipient: TemplateRecipient, key: string): string {
  switch (key) {
    case "nombre": return recipient.name ?? "";
    case "empresa": return recipient.company ?? "";
    case "cargo": return recipient.position ?? "";
    case "email": return recipient.email ?? "";
    case "nombre_completo": return recipient.nombreCompleto ?? "";
    case "correo_acceso": return recipient.correoAcceso ?? "";
    case "tipo_asociado": return recipient.tipoAsociado ?? "";
    case "enlace_acceso": return recipient.enlaceAcceso ?? "";
    case "enlace_activacion": return recipient.enlaceActivacion ?? "";
    default: return "";
  }
}

/**
 * Sustitución controlada de variables por whitelist. No usa eval ni ejecuta
 * código. Las variables desconocidas quedan literal. Los valores vacíos se
 * sustituyen por cadena vacía y se limpia el espacio previo a una coma para
 * evitar "Estimado(a) ,".
 *
 * También soporta bloques condicionales `{{#variable}}...{{/variable}}`: el
 * contenido se conserva solo si la variable tiene un valor no vacío. Permite
 * incluir secciones opcionales (p. ej. activación) sin dejar enlaces rotos.
 */
export function renderTemplate(template: string, recipient: TemplateRecipient): string {
  const withConditionals = template.replace(/\{\{#(\w+)\}\}([\s\S]*?)\{\{\/\1\}\}/g, (match, key: string, inner: string) => {
    if (!TEMPLATE_VARIABLES.has(key)) return match;
    return valueFor(recipient, key).trim() ? inner : "";
  });
  const substituted = withConditionals.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (!TEMPLATE_VARIABLES.has(key)) return match;
    return valueFor(recipient, key).trim();
  });
  return substituted.replace(/\s+,/g, ",");
}
