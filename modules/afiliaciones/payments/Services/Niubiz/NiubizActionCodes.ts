export type NiubizDeclineType = "TEMPORARY" | "PERMANENT";
export type NiubizDeclineOrigin = "ISSUER" | "NIUBIZ" | "AUTHENTICATION";

export interface NiubizActionCodeDefinition {
  code: string;
  label: string;
  userMessage: string;
  origin: NiubizDeclineOrigin;
  rejectionType?: NiubizDeclineType;
}

const entry = (code: string, label: string, origin: NiubizDeclineOrigin, rejectionType?: NiubizDeclineType, userMessage = label): NiubizActionCodeDefinition => ({ code, label, userMessage, origin, ...(rejectionType ? { rejectionType } : {}) });

/** Complete official Niubiz action-code table supplied for this integration. */
export const NIUBIZ_ACTION_CODES: Readonly<Record<string, NiubizActionCodeDefinition>> = Object.freeze({
  "000": entry("000", "Aprobado y completado con éxito", "ISSUER"),
  "010": entry("010", "Aprobado y completado con éxito", "ISSUER"),
  "101": entry("101", "Tarjeta vencida", "ISSUER", "PERMANENT", "La tarjeta ingresada se encuentra vencida. Por favor, comunícate con tu banco para mayor información."),
  "102": entry("102", "Contactar con la entidad emisora", "ISSUER", "PERMANENT", "La venta no ha podido ser procesada. Por favor, comunícate con tu banco para mayor información."),
  "104": entry("104", "Transaction not Permitted to Issuer/Cardholder", "ISSUER", "TEMPORARY"),
  "106": entry("106", "Exceso de intentos de ingreso de clave secreta", "ISSUER", "TEMPORARY"),
  "107": entry("107", "Contactar con la entidad emisora", "ISSUER", "TEMPORARY"),
  "108": entry("108", "Exceso de actividad", "ISSUER", "TEMPORARY"),
  "109": entry("109", "Identificación inválida de establecimiento", "ISSUER", "TEMPORARY"),
  "111": entry("111", "Exceeds Withdrawal Amount Limit", "NIUBIZ", "TEMPORARY"),
  "113": entry("113", "Monto no permitido", "ISSUER", "TEMPORARY"),
  "114": entry("114", "OPER INVALIDA", "ISSUER", "TEMPORARY"),
  "116": entry("116", "Fondos insuficientes", "ISSUER", "TEMPORARY", "No cuentas con fondos suficientes para completar la compra. Intenta nuevamente con otra tarjeta."),
  "117": entry("117", "Clave secreta incorrecta", "ISSUER", "TEMPORARY"),
  "118": entry("118", "Tarjeta no válida", "ISSUER", "PERMANENT", "La tarjeta ingresada es inválida. Verifica los datos ingresados e intenta nuevamente."),
  "121": entry("121", "Operación denegada", "ISSUER", "TEMPORARY"),
  "122": entry("122", "DENEGADA", "ISSUER", "TEMPORARY"),
  "126": entry("126", "Clave secreta no válida", "ISSUER", "TEMPORARY"),
  "129": entry("129", "Tarjeta no operativa", "ISSUER", "TEMPORARY"),
  "151": entry("151", "TARJETA NO HABIL", "ISSUER", "PERMANENT"),
  "159": entry("159", "REINTENTE", "ISSUER", "TEMPORARY"),
  "170": entry("170", "RECHAZADA (170)", "ISSUER", "PERMANENT"),
  "180": entry("180", "Invalid Card Number", "ISSUER", "PERMANENT", "La tarjeta ingresada es inválida. Por favor, comunícate con tu banco para mayor información."),
  "182": entry("182", "Tarjeta con restricciones de crédito", "ISSUER", "TEMPORARY"),
  "183": entry("183", "Error de sistema", "ISSUER", "PERMANENT"),
  "184": entry("184", "FALLA CRIPT", "ISSUER", "TEMPORARY"),
  "190": entry("190", "Contactar con entidad emisora", "ISSUER", "TEMPORARY"),
  "191": entry("191", "Contactar con entidad emisora", "ISSUER", "TEMPORARY"),
  "201": entry("201", "Expire Card", "NIUBIZ", "PERMANENT"),
  "204": entry("204", "Restricted Card", "NIUBIZ", "PERMANENT"),
  "207": entry("207", "Contactar con entidad emisora", "ISSUER", "PERMANENT"),
  "208": entry("208", "Tarjeta perdida", "ISSUER", "PERMANENT", "La tarjeta fue reportada como perdida. Por favor, comunícate con tu banco para mayor información."),
  "209": entry("209", "Tarjeta robada", "ISSUER", "PERMANENT", "La tarjeta fue reportada como robada. Por favor, comunícate con tu banco para mayor información."),
  "211": entry("211", "COMPR INTERN OFF", "ISSUER", "TEMPORARY"),
  "265": entry("265", "Clave secreta del tarjetahabiente incorrecta", "AUTHENTICATION", "TEMPORARY"),
  "279": entry("279", "DECL. CICLO VIDA", "ISSUER", "TEMPORARY"),
  "280": entry("280", "Clave errónea", "ISSUER", "TEMPORARY"),
  "282": entry("282", "DECL. POLÍTICAS", "ISSUER", "TEMPORARY"),
  "283": entry("283", "DECL. SEGURIDAD", "ISSUER", "TEMPORARY"),
  "290": entry("290", "Contactar con entidad emisora", "NIUBIZ", "PERMANENT"),
  "300": entry("300", "Número de pedido del comercio duplicado", "NIUBIZ", "TEMPORARY"),
  "401": entry("401", "Tienda inhabilitada", "NIUBIZ", "TEMPORARY"),
  "403": entry("403", "Transacción no autenticada", "NIUBIZ", "TEMPORARY"),
  "408": entry("408", "CVV2 no coincide", "NIUBIZ", "TEMPORARY"),
  "421": entry("421", "BIN riesgoso", "NIUBIZ", "PERMANENT"),
  "424": entry("424", "BIN en lista negra", "NIUBIZ", "PERMANENT"),
  "427": entry("427", "Insufficient Funds/Over Credit Limit", "NIUBIZ", "TEMPORARY"),
  "428": entry("428", "Número de tarjeta no es válido", "NIUBIZ", "TEMPORARY"),
  "429": entry("429", "La operación ya está en un depósito", "NIUBIZ", "TEMPORARY"),
  "480": entry("480", "Número de orden inválido", "NIUBIZ", "TEMPORARY"),
  "666": entry("666", "Error de comunicación", "NIUBIZ", "TEMPORARY"),
  "667": entry("667", "Transacción sin autenticación. Inicio del proceso de pago.", "AUTHENTICATION", "TEMPORARY"),
  "665": entry("665", "Operación denegada. Tarjeta no válida", "NIUBIZ", "TEMPORARY"),
  "670": entry("670", "Operación denegada", "NIUBIZ", "TEMPORARY", "La operación fue rechazada por controles de seguridad. Intenta nuevamente más tarde."),
  "671": entry("671", "Cybersource Reject", "NIUBIZ", "TEMPORARY"),
  "673": entry("673", "Authorization System or Issuer System Inoperative", "NIUBIZ", "TEMPORARY"),
  "675": entry("675", "Denegada", "NIUBIZ", "TEMPORARY"),
  "678": entry("678", "Error con Verified by Visa", "NIUBIZ", "TEMPORARY", "No se pudo completar el proceso de autenticación. Intenta nuevamente."),
  "680": entry("680", "Transacción denegada", "NIUBIZ", "TEMPORARY"),
  "683": entry("683", "ERROR EN FORMATO", "ISSUER", "TEMPORARY"),
  "686": entry("686", "Transacción no pudo ser procesada", "NIUBIZ", "TEMPORARY"),
  "687": entry("687", "Error de formato", "NIUBIZ", "TEMPORARY"),
  "690": entry("690", "El comercio no tiene permitido autorizar pagos con QR", "NIUBIZ", "TEMPORARY"),
  "691": entry("691", "Contactar con el comercio", "NIUBIZ", "TEMPORARY"),
  "692": entry("692", "Tarjeta vencida", "NIUBIZ", "TEMPORARY"),
  "754": entry("754", "Transacción autenticada", "NIUBIZ", "TEMPORARY"),
  "760": entry("760", "OP. NO PERMITIDA", "NIUBIZ", "TEMPORARY"),
  "904": entry("904", "Formato de mensaje erróneo", "ISSUER", "TEMPORARY"),
  "909": entry("909", "Problema de comunicación", "ISSUER", "TEMPORARY"),
  "912": entry("912", "Entidad emisora no disponible", "ISSUER", "TEMPORARY"),
  "913": entry("913", "Transmisión duplicada", "NIUBIZ", "TEMPORARY"),
  "928": entry("928", "Contactar con entidad emisora", "ISSUER", "TEMPORARY"),
  "965": entry("965", "Contactar con entidad emisora", "NIUBIZ", "TEMPORARY"),
  "55": entry("55", "PIN inválido", "NIUBIZ", "TEMPORARY"),
  "75": entry("75", "Exced. Inten. PIN", "NIUBIZ", "TEMPORARY"),
  "80": entry("80", "Trx. Rechazada", "NIUBIZ", "TEMPORARY"),
  "83": entry("83", "DENEGADO 83", "NIUBIZ", "TEMPORARY"),
});

export const NIUBIZ_APPROVED_ACTION_CODES = new Set(["000", "010"]);

export function getNiubizActionCode(code: string | undefined): NiubizActionCodeDefinition | undefined {
  return code ? NIUBIZ_ACTION_CODES[code] : undefined;
}
