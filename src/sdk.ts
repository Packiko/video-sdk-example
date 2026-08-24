import { getUserToken, isAuthenticated, modeB } from './auth'

// Mode A by default: public key + API base URL from Vite env (see .env.example).
// Origin (http://localhost:5173) must be registered in UAT onboarding for pk_ to work.
//
// After a Keycloak login (Mode B, see src/auth.ts) the getters switch to the
// Mode B key + user token. Getters, not values: the SDK reads config per
// request, so the one object serves both modes and no consumer changes.
export const sdkConfig = {
  apiBaseUrl: import.meta.env.VITE_PACKIKO_API_BASE_URL || 'https://video-uat.packiko.com',
  get publicKey() {
    return isAuthenticated() ? modeB.publicKey! : (import.meta.env.VITE_PACKIKO_PUBLIC_KEY || '')
  },
  get getUserToken() {
    return isAuthenticated() ? getUserToken : undefined
  },
}
