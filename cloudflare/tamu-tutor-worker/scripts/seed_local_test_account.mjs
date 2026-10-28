/**
 * Local end-to-end testing only: adds the test account TAMU-900 to the *local* ACCOUNTS KV used by
 * `wrangler dev`, and applies the events migration to the local D1. Never touches the deployed
 * worker. The password is a fixed local test value:
 *
 *   ID TAMU-900, password local-test-42
 *
 *   node scripts/seed_local_test_account.mjs
 *   npx wrangler dev --port 8787 --var ALLOWED_ORIGINS:http://127.0.0.1:8788 --var CONTENT_BASE:http://127.0.0.1:8788/demo-api
 */
import { execFileSync } from 'node:child_process'
import { pbkdf2Sync, randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const cwd = fileURLToPath(new URL('..', import.meta.url))
const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
const run = (args) => execFileSync(npx, ['--yes', 'wrangler@4.93.0', ...args], { cwd, stdio: 'inherit', shell: process.platform === 'win32' })

const salt = randomBytes(16).toString('hex')
const hash = pbkdf2Sync('local-test-42', Buffer.from(salt, 'hex'), 100000, 32, 'sha256').toString('hex')
const value = JSON.stringify({ salt, iter: 100000, hash })
run(['kv', 'key', 'put', '--binding', 'ACCOUNTS', '--local', 'account:TAMU-900', process.platform === 'win32' ? `"${value.replace(/"/g, '\\"')}"` : value])
run(['d1', 'migrations', 'apply', 'alget-tamu-events', '--local'])
console.log('local test account TAMU-900 ready')
