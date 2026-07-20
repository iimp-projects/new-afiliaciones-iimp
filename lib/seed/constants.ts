/**
 * Diccionario centralizado del Dominio (Ubiquitous Language).
 * Protege contra Magic Strings y unifica las reglas de negocio base.
 */
export const SEED_ENV = process.env.NODE_ENV || 'development';
export const IS_PRODUCTION = SEED_ENV === 'production';

export const SEED_CONSTANTS = {
  SYSTEM: {
    ADMIN_EMAIL: 'admin@iimp.org.pe',
    DEFAULT_PASSWORD: 'ChangeThisPassword123!',
  },
  
  // Catálogo estático de Roles inmutables de negocio
  ROLES: {
    SYSTEM_ADMIN: { name: 'System Administrator', slug: 'system-admin' },
    VALIDATOR: { name: 'Validator', slug: 'validator' },
    APPLICANT: { name: 'Applicant', slug: 'applicant' },
  },
  
  // Categorías y Estados del Dominio Identity (Equivalentes a los Enums de Prisma)
  IDENTITY: {
    CREDENTIAL_TYPE: {
      PASSWORD: 'PASSWORD',
      PASSKEY: 'PASSKEY',
    },
    USER_TYPE: {
      SYSTEM_ADMIN: 'SYSTEM_ADMIN',
      VALIDATOR: 'VALIDATOR',
      APPLICANT: 'APPLICANT',
    },
    USER_STATUS: {
      ACTIVE: 'ACTIVE',
      BLOCKED: 'BLOCKED',
      PENDING: 'PENDING',
    },
  },

  // Documentos de Identidad (Equivalentes a los Enums de Prisma)
  DOCUMENT_TYPE: {
    DNI: 'DNI',
    CE: 'CE',
    PASSPORT: 'PASSPORT',
  },

  // Catálogo base de geografía obligatoria
  COUNTRIES: {
    PERU: { isoCode: 'PER', name: 'Perú', phoneCode: '+51' },
  },

  // Configuraciones iniciales base (System Configuration)
  CONFIG_KEYS: {
    MAX_FAILED_LOGIN_ATTEMPTS: 'MAX_FAILED_LOGIN_ATTEMPTS',
    DEFAULT_CURRENCY: 'DEFAULT_CURRENCY',
  },
} as const;