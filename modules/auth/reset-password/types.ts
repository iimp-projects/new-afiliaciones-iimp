export interface ResetPasswordState {
  success: boolean;
  message?: string;
  errors?: Record<string, string[] | undefined>;
}