export abstract class AuthError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
    // Mantiene la traza de la pila limpia en V8 (Node.js)
    Error.captureStackTrace(this, this.constructor);
  }
}

export class SessionError extends AuthError {}
export class AuthenticationError extends AuthError {}
export class AuthorizationError extends AuthError {}
export class SecurityError extends AuthError {}