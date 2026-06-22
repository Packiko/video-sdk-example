import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// ponytail: port pinned to 5173 because Mode A auth registers Origin http://localhost:5173 in UAT onboarding
export default defineConfig({
  plugins: [react()],
  server: { port: 5173, strictPort: true },
})
