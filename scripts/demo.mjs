import { spawn } from 'node:child_process'

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const spawnOptions = { stdio: 'inherit', shell: process.platform === 'win32' }
const children = [
  spawn(npmCommand, ['run', 'dev:api'], spawnOptions),
  spawn(npmCommand, ['run', 'dev:ui'], spawnOptions),
]

let stopping = false
function stop(exitCode = 0) {
  if (stopping) return
  stopping = true
  for (const child of children) child.kill()
  process.exit(exitCode)
}

for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => stop())
for (const child of children) {
  child.on('error', (error) => {
    console.error(`Unable to start demonstration service: ${error.message}`)
    stop(1)
  })
  child.on('exit', (code) => {
    if (!stopping && code !== 0) stop(code ?? 1)
  })
}
