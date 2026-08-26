import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv, type Plugin } from 'vite'

const requiredFirebaseEnv = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
] as const

function requireFirebaseEnv(mode: string): Plugin {
  return {
    name: 'require-firebase-env',
    configResolved(config) {
      if (config.command !== 'build') return

      const env = loadEnv(mode, config.envDir ?? process.cwd(), '')
      const missing = requiredFirebaseEnv.filter((key) => !env[key]?.trim())

      if (missing.length === 0) {
        console.log(
          `[firebase] env OK (projectId=${env.VITE_FIREBASE_PROJECT_ID})`,
        )
        return
      }

      throw new Error(
        `[firebase] Faltan variables en el build: ${missing.join(', ')}. ` +
          'En Vercel: Settings → Environment Variables (Production/Preview) ' +
          'con valores no vacíos, luego Redeploy sin build cache.',
      )
    },
  }
}

export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), requireFirebaseEnv(mode)],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'src'),
    },
  },
}))
