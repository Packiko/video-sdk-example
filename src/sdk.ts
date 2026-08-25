import { getUserToken, isAuthenticated, modeB } from './auth'

export const modeAConfig = {
  apiBaseUrl: import.meta.env.VITE_PACKIKO_API_BASE_URL || 'https://video-uat.packiko.com',
  publicKey: import.meta.env.VITE_PACKIKO_PUBLIC_KEY || '',
}

export const sdkConfig = {
  apiBaseUrl: modeAConfig.apiBaseUrl,
  get publicKey() {
    return isAuthenticated() ? modeB.publicKey : modeAConfig.publicKey
  },
  get getUserToken() {
    return isAuthenticated() ? getUserToken : undefined
  },
}
