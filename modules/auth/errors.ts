import { CredentialsSignin } from "next-auth";

// Heredamos de CredentialsSignin para que NextAuth permita pasar el mensaje al frontend
export abstract class AuthError extends CredentialsSignin {
  constructor(message: string) {
    super();
    this.name = this.constructor.name;
    // Auth.js v5 lee la propiedad 'code' para enviarla como res.error al cliente
    this.code = message; 
  }
}

export class SessionError extends AuthError {}
export class AuthenticationError extends AuthError {}
export class AuthorizationError extends AuthError {}
export class SecurityError extends AuthError {}