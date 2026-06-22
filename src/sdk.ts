// Mode A auth: public key + API base URL from Vite env (see .env.example).
// Origin (http://localhost:5173) must be registered in UAT onboarding for pk_ to work.
export const sdkConfig = {
  publicKey: import.meta.env.VITE_PACKIKO_PUBLIC_KEY,
  apiBaseUrl: import.meta.env.VITE_PACKIKO_API_BASE_URL,
}
