import fs from 'node:fs'
import path from 'node:path'

function readDatabaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL
  if (!fs.existsSync('.env')) return null

  const line = fs
    .readFileSync('.env', 'utf8')
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith('DATABASE_URL='))

  if (!line) return null

  const value = line.slice(line.indexOf('=') + 1).trim()
  return value.replace(/^(["'])(.*)\1$/, '$2')
}

const databaseUrl = readDatabaseUrl()

if (!databaseUrl) {
  throw new Error('DATABASE_URL is missing. Copy .env.example to .env first.')
}

if (!databaseUrl.startsWith('file:')) {
  process.exit(0)
}

const fileValue = databaseUrl.slice('file:'.length)
if (!fileValue || fileValue === ':memory:') {
  process.exit(0)
}

const isWindowsAbsolute = /^[A-Za-z]:[\\/]/.test(fileValue)
const databasePath = path.isAbsolute(fileValue) || isWindowsAbsolute
  ? path.normalize(fileValue)
  : path.resolve('prisma', fileValue)

fs.mkdirSync(path.dirname(databasePath), { recursive: true })
const descriptor = fs.openSync(databasePath, 'a')
fs.closeSync(descriptor)

console.log('SQLite database file is ready.')
