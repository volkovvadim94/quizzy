import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const mediaRoots = [
  // Production build output (served by backend as /media/*)
  path.resolve(__dirname, '../../dist/media'),
  // Dev/source folder (copied into dist on build)
  path.resolve(__dirname, '../../../frontend/public/media'),
]
const placeholder = '/media/placeholder.png'

const safePath = (file) => (file || '').replace(/^[./\\]+/, '')

const normalizeRelative = (file, typeFolder) => {
  const rel = safePath(file)
  const prefixes = [`media/${typeFolder}/`, `${typeFolder}/`, `media\\${typeFolder}\\`, `${typeFolder}\\`]
  for (const p of prefixes) {
    if (rel.toLowerCase().startsWith(p.toLowerCase())) return rel.slice(p.length)
  }
  return rel
}

const resolveMedia = (file, typeFolder) => {
  if (!file) return null
  const relative = normalizeRelative(file, typeFolder)
  for (const root of mediaRoots) {
    const abs = path.join(root, typeFolder, relative)
    if (fs.existsSync(abs)) {
      return `/media/${typeFolder}/${relative}`
    }
  }
  return placeholder
}

export const withMediaPlaceholders = (question) => {
  if (!question) return null
  return {
    ...question,
    picture: resolveMedia(question.picture, 'pictures'),
    audio: resolveMedia(question.audio, 'audio'),
    video: resolveMedia(question.video, 'video'),
  }
}
