export interface TemplateRecipient {
  name?: string | null;
  company?: string | null;
  position?: string | null;
  email?: string | null;
}

/** Variables permitidas por whitelist. Cualquier otra queda literal. */
export const TEMPLATE_VARIABLES = new Set(["nombre", "empresa", "cargo", "email"]);

function valueFor(recipient: TemplateRecipient, key: string): string {
  switch (key) {
    case "nombre": return recipient.name ?? "";
    case "empresa": return recipient.company ?? "";
    case "cargo": return recipient.position ?? "";
    case "email": return recipient.email ?? "";
    default: return "";
  }
}

/**
 * Sustitución controlada de variables por whitelist. No usa eval ni ejecuta
 * código. Las variables desconocidas quedan literal. Los valores vacíos se
 * sustituyen por cadena vacía y se limpia el espacio previo a una coma para
 * evitar "Estimado(a) ,".
 */
export function renderTemplate(template: string, recipient: TemplateRecipient): string {
  const substituted = template.replace(/\{\{(\w+)\}\}/g, (match, key: string) => {
    if (!TEMPLATE_VARIABLES.has(key)) return match;
    return valueFor(recipient, key).trim();
  });
  return substituted.replace(/\s+,/g, ",");
}
