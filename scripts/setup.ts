import { copyFileSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { randomBytes } from 'node:crypto'
import { join } from 'node:path'

const PLACEHOLDER = 'JWT_SECRET_KEY=replace-me'

export function fillSecret(example: string, secret: string): string {
  if (!example.includes(PLACEHOLDER)) throw new Error(`.env.example has no ${PLACEHOLDER} line`)
  return example.replace(PLACEHOLDER, `JWT_SECRET_KEY=${secret}`)
}

function run(command: string[]): void {
  console.log(`> ${command.join(' ')}`)
  const { exitCode } = Bun.spawnSync(command, { stdout: 'inherit', stderr: 'inherit' })
  if (exitCode !== 0) throw new Error(`${command.join(' ')} exited with ${exitCode}`)
}

function writeEnvFile(root: string): void {
  const envPath = join(root, '.env')
  if (existsSync(envPath)) {
    console.log('.env already exists, leaving it alone')
    return
  }
  copyFileSync(join(root, '.env.example'), envPath)
  const secret = randomBytes(32).toString('hex')
  writeFileSync(envPath, fillSecret(readFileSync(envPath, 'utf8'), secret))
  console.log('wrote .env with a new JWT_SECRET_KEY')
}

if (import.meta.main) {
  if (Bun.which('uv') === null) {
    throw new Error(
      'uv is not installed, see https://docs.astral.sh/uv/getting-started/installation',
    )
  }
  writeEnvFile(join(import.meta.dir, '..'))
  run(['uv', 'sync', '--directory', 'apps/api'])
  run(['bunx', 'playwright', 'install', 'chromium'])
  console.log('ready, start the app with: bun run dev')
}
