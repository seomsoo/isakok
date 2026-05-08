import { Platform } from 'react-native'

const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost'
export const WEB_APP_URL = process.env.EXPO_PUBLIC_WEB_APP_URL ?? `http://${DEV_HOST}:5173`

export const SPLASH_TIMEOUT_MS = 5000

export const COLORS = {
  primary: '#0F766E',
  placeholder: '#9E9E9E',
  surface: '#FFFFFF',
  border: '#F0EFED',
  neutral: '#F8F7F5',
  secondary: '#333344',
  muted: '#6B6B7B',
} as const
