import Keycloak from 'keycloak-js'

// ThaiCloud UAT defaults so the Mode B demo works straight from a clone —
// all overridable via env for partners pointing at their own IdP.
// The Keycloak values are public by nature (public client + PKCE; visible in
// any browser's network tab). The pk is committed knowingly: a Mode B key is
// useless without a live JWT from this realm (enforce-or-reject), so the only
// exposure is realm users spending UAT demo credit.
const DEFAULT_MODE_B_PUBLIC_KEY = 'pk_uat_example_41340973f06bfdfbd095a3e832aa93d4234eccefa845e94d'
const env = import.meta.env
export const modeB = {
  publicKey: (env.VITE_PACKIKO_MODE_B_PUBLIC_KEY as string | undefined) ?? DEFAULT_MODE_B_PUBLIC_KEY,
  url: (env.VITE_PACKIKO_KEYCLOAK_URL as string | undefined) ?? 'https://login.thaicloud.com',
  realm: (env.VITE_PACKIKO_KEYCLOAK_REALM as string | undefined) ?? 'common',
  // ThaiCloud's Keycloak client-id convention is a UUID, not a slug.
  clientId: (env.VITE_PACKIKO_KEYCLOAK_CLIENT_ID as string | undefined) ?? '019be89c-cc99-7f1d-b5c6-ca4ddddddddd',
}
// The pk is the only value without a usable default until provisioning — it
// alone gates the login UI.
export const modeBConfigured = Boolean(modeB.publicKey)

let kc: Keycloak | null = null
export let authInitError = false

// Call once before render. Login is a full redirect, so after Keycloak sends
// the browser back here init() resumes the session from the callback URL —
// no mid-session mode switching is ever needed.
export async function initAuth(): Promise<void> {
  if (!modeBConfigured) return
  const keycloak = new Keycloak({ url: modeB.url!, realm: modeB.realm!, clientId: modeB.clientId! })
  try {
    await keycloak.init({ pkceMethod: 'S256' })
    kc = keycloak
  } catch {
    authInitError = true // Keycloak unreachable/misconfigured → stay Mode A
  }
}

export const isAuthenticated = () => Boolean(kc?.authenticated)
export const subject = () => kc?.tokenParsed?.sub ?? ''
export const login = () => void kc?.login({ redirectUri: window.location.href })
export const logout = () => void kc?.logout({ redirectUri: window.location.href })

// Wired into sdkConfig as getUserToken — the SDK awaits this on EVERY request,
// so refreshing here keeps the X-User-Token header fresh for long sessions.
export async function getUserToken(): Promise<string> {
  if (!kc) return ''
  try {
    await kc.updateToken(30)
  } catch {
    // refresh failed (session expired) — send what we have; the server 401s
  }
  return kc.token ?? ''
}
