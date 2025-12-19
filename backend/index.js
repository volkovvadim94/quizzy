import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

const loadEnvFile = (envPath) => {
  if (!fs.existsSync(envPath)) return

  // Prefer Node's native loader when available (Node 20.6+).
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(envPath)
    return
  }

  // Minimal fallback loader for older Node versions.
  const content = fs.readFileSync(envPath, 'utf8')
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const eq = line.indexOf('=')
    if (eq <= 0) continue

    const key = line.slice(0, eq).trim()
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) continue

    let value = line.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

loadEnvFile(path.join(__dirname, '.env'))

// Import after env is loaded so modules can read process.env at import time.
await import('./server.js')

