import Keycloak from 'keycloak-js'

const env = import.meta.env

export const modeB = {
  publicKey: (env.VITE_PACKIKO_MODE_B_PUBLIC_KEY as string | undefined) ?? 'pk_uat_example_41340973f06bfdfbd095a3e832aa93d4234eccefa845e94d',
  url: (env.VITE_PACKIKO_KEYCLOAK_URL as string | undefined) ?? 'https://login.thaicloud.com',
  realm: (env.VITE_PACKIKO_KEYCLOAK_REALM as string | undefined) ?? 'common',
  clientId: (env.VITE_PACKIKO_KEYCLOAK_CLIENT_ID as string | undefined) ?? '019be89c-cc99-7f1d-b5c6-ca4ddddddddd',
}

export const modeBConfigured = Boolean(modeB.publicKey && modeB.url && modeB.realm && modeB.clientId)

let keycloak: Keycloak | null = null
export let authInitError = false

export async function initAuth(): Promise<void> {
  if (!modeBConfigured) return
  try {
    const client = new Keycloak({ url: modeB.url, realm: modeB.realm, clientId: modeB.clientId })
    await client.init({ pkceMethod: 'S256' })
    keycloak = client
  } catch {
    authInitError = true
  }
}

export const isAuthenticated = () => Boolean(keycloak?.authenticated)
export const subject = () => keycloak?.tokenParsed?.sub ?? ''
export const login = () => void keycloak?.login({ redirectUri: window.location.href })
export const logout = () => void keycloak?.logout({ redirectUri: window.location.href })

export async function getUserToken(): Promise<string> {
  if (!keycloak) return ''
  try {
    await keycloak.updateToken(30)
  } catch {
    // Keep the current token so the SDK can report the authentication result.
  }
  return keycloak.token ?? ''
}
