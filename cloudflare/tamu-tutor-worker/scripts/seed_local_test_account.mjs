/**
 * Local end-to-end testing only: adds test accounts to the *local* ACCOUNTS KV used by
 * `wrangler dev`, and applies the migrations to the local D1. Never touches the deployed
 * worker. The passwords are fixed local test values:
 *
 *   TAMU-900            test student (left out of the class dashboard)   local-test-42
 *   TAMU-001, TAMU-002  students shown on the class dashboard            local-test-42
 *   TAMU-950            instructor (opens the class dashboard)           local-teach-42
 *
 *   node scripts/seed_local_test_account.mjs
 *   node scripts/seed_local_test_account.mjs --prefix UTK --config wrangler.utk.jsonc   (same IDs as UTK-...)
 *   npx wrangler dev --port 8787 --var ALLOWED_ORIGINS:http://127.0.0.1:8788 --var CONTENT_BASE:http://127.0.0.1:8788/demo-api
 */
import { execFileSync } from 'node:child_process'
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const cwd = fileURLToPath(new URL('..', import.meta.url))
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : fallback }
const prefix = arg('prefix', 'TAMU')
const config = arg('config', 'wrangler.jsonc')
const persist = arg('persist-to') // the same --persist-to as the wrangler dev run, if it has one
const local = ['--local', '-c', config, ...(persist ? ['--persist-to', persist] : [])]
const run = (args) => execFileSync(npx, ['--yes', 'wrangler@4.93.0', ...args], { cwd, stdio: 'inherit', shell: process.platform === 'win32' })

const ACCOUNTS = [
    [`${prefix}-900`, 'local-test-42', {}],
    [`${prefix}-001`, 'local-test-42', {}],
    [`${prefix}-002`, 'local-test-42', {}],
    [`${prefix}-950`, 'local-teach-42', { role: 'instructor', name: 'Local Instructor' }],
]
for (const [id, password, extra] of ACCOUNTS) {
    const salt = randomBytes(16).toString('hex')
    const hash = pbkdf2Sync(password, Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex')
    const value = JSON.stringify({ salt, iter: 100000, hash, ...extra })
    run(['kv', 'key', 'put', '--binding', 'ACCOUNTS', ...local, `account:${id}`, process.platform === 'win32' ? `"${value.replace(/"/g, '\\"')}"` : value])
}
run(['d1', 'migrations', 'apply', config === 'wrangler.jsonc' ? 'alget-tamu-events' : `alget-${prefix.toLowerCase()}-events`, ...local])
console.log(`local test accounts ready: ${ACCOUNTS.map(([id]) => id).join(', ')}`)
