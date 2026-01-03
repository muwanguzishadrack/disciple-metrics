export const APP_NAME = 'Disciple Metrics'
export const APP_DESCRIPTION = 'Track and grow your discipleship journey'

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  FORGOT_PASSWORD: '/forgot-password',
  RESET_PASSWORD: '/reset-password',
  VERIFY_EMAIL: '/verify-email',
  SUBMIT_PGA: '/whm-submit-pga',
  DASHBOARD: '/dashboard',
  TEAM: '/team',
  LOCATIONS: '/locations',
  REPORTS: '/reports',
  SETTINGS: '/settings',
  SETTINGS_PROFILE: '/settings/profile',
  SETTINGS_PASSWORD: '/settings/password',
  SETTINGS_APPEARANCE: '/settings/appearance',
} as const

export const PASSWORD_REQUIREMENTS = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSpecialChar: true,
} as const

export const PASSWORD_REQUIREMENTS_TEXT = [
  'At least 8 characters',
  'At least one uppercase letter',
  'At least one lowercase letter',
  'At least one number',
  'At least one special character (!@#$%^&*)',
] as const
