// types/auth.types.ts

export interface LoginFormData {
  emailOrUsername: string
  password: string
  rememberMe: boolean
}

export interface RegisterFormData {
  email: string
  password: string
  confirmPassword: string
  acceptTerms: boolean
}

export interface PasswordResetRequestData {
  email: string
}

export interface PasswordResetData {
  token: string
  newPassword: string
  confirmPassword: string
}

export interface AuthError {
  field?: string
  message: string
}

export type PasswordStrength = 'weak' | 'medium' | 'strong'