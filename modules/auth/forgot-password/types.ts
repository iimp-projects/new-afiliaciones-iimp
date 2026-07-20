export interface ForgotPasswordState {
  success: boolean;
  message?: string;
  errors?: Record<string, string[] | undefined>;
}