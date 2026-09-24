export interface CredentialsLoginInput {
  email: string;
  password: string;
}

export interface CredentialsLoginResult {
  /** true = mantener loading (navegando); false = restaurar loading */
  keepLoading: boolean;
  errorMessage: string | null;
}

export interface CredentialsLoginDeps {
  checkLockStatus: (email: string) => Promise<{ locked: boolean; message?: string }>;
  signIn: (
    options: { email: string; password: string; redirect: boolean },
  ) => Promise<{ error?: string } | undefined>;
}

const GENERIC_ERROR_MESSAGE = "Ocurrió un error inesperado al conectar con el servidor.";
const INVALID_CREDENTIALS_MESSAGE = "Correo o contraseña incorrectos. Por favor, intenta de nuevo.";
const ACCOUNT_LOCKED_MESSAGE = "La cuenta se encuentra bloqueada.";

/**
 * Orquesta el flujo de credenciales y devuelve si el login quedó en estado
 * de transición (éxito, pendiente de navegación) o debe restaurar el loading
 * (error/credenciales inválidas/bloqueo).
 */
export async function resolveCredentialsLogin(
  input: CredentialsLoginInput,
  deps: CredentialsLoginDeps,
): Promise<CredentialsLoginResult> {
  try {
    const preCheck = await deps.checkLockStatus(input.email);
    if (preCheck.locked) {
      return {
        keepLoading: false,
        errorMessage: preCheck.message ?? ACCOUNT_LOCKED_MESSAGE,
      };
    }

    const result = await deps.signIn({
      email: input.email,
      password: input.password,
      redirect: false,
    });

    if (result?.error) {
      const postCheck = await deps.checkLockStatus(input.email);
      return {
        keepLoading: false,
        errorMessage: postCheck.locked
          ? (postCheck.message ?? ACCOUNT_LOCKED_MESSAGE)
          : INVALID_CREDENTIALS_MESSAGE,
      };
    }

    return { keepLoading: true, errorMessage: null };
  } catch {
    return { keepLoading: false, errorMessage: GENERIC_ERROR_MESSAGE };
  }
}
