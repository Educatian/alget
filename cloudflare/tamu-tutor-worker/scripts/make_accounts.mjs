/**
 * Makes the TAMU preview roster: IDs TAMU-001..N, each with its own easy password
 * (word-word-number, for example maple-river-42).
 *
 *   node scripts/make_accounts.mjs --count 40 --roster <roster.csv> --kv <kv-bulk.json> [--start 1]
 *
 * TAMU-9xx IDs are reserved for instructor and test accounts (--start 999 --count 1), so their
 * events can be left out of analysis. An instructor account opens the class dashboard and gets a
 * longer passphrase (three words and a number):
 *
 *   node scripts/make_accounts.mjs --start 901 --count 1 --role instructor --name "Prof. Name" --roster <csv> --kv <json>
 *
 * roster.csv holds the plain passwords for the instructor to hand out; kv-bulk.json holds only
 * PBKDF2 hashes for `wrangler kv bulk put`. Both must be written outside the repository, and
 * the kv file can be deleted once uploaded. Re-running makes new passwords for every ID.
 *
 * To rebuild the hashes from an existing roster (same passwords, fresh salts), for example after
 * the account store was cleared:
 *
 *   node scripts/make_accounts.mjs --from-roster <roster.csv> --kv <kv-bulk.json>
 */
import { pbkdf2Sync, randomBytes, randomInt } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const ITERATIONS = 100_000 // the Workers PBKDF2 limit

// Short, common, easy-to-spell words with no awkward meanings.
const WORDS = `apple amber anchor arrow aspen badge banjo basil beach berry birch bison blaze bloom brave breeze brook cabin cactus
camel candle canoe canyon cedar cherry cider cliff clover cobalt comet coral cotton crane crystal daisy delta desert dolphin
dragon eagle ember falcon fern fiddle field flame forest fossil fox galaxy garden geyser ginger glacier globe grape harbor
hazel heron honey island ivory jasmine jungle kayak kettle kite koala lagoon lantern lemon lily lotus maple meadow melon
mint moon mosaic nectar noble oasis ocean olive orbit orchid otter owl panda pebble pepper pine planet plum pony prairie
quartz quill rabbit radar rain raven reef ribbon river robin rocket saddle sage salmon sandal sierra silver sky sparrow
spruce star stone summit sunny swan tango thistle thunder tiger timber topaz tulip tundra valley velvet violet walnut
willow window wren yarrow zebra zephyr`.split(/\s+/)

const arg = (name, fallback) => { const i = process.argv.indexOf(`--${name}`); return i > -1 ? process.argv[i + 1] : fallback }
const count = Number(arg('count', 40))
const start = Number(arg('start', 1))
const rosterPath = arg('roster')
const fromRoster = arg('from-roster')
const role = arg('role', 'student')
const name = arg('name', null)
if (!['student', 'instructor'].includes(role)) throw new Error('--role must be student or instructor')
const kvPath = arg('kv')
const repo = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
for (const p of [fromRoster || rosterPath, kvPath]) {
    if (!p) throw new Error('give --roster (or --from-roster) and --kv paths')
    if (resolve(p).toLowerCase().startsWith(repo.toLowerCase() + sep)) throw new Error(`refusing to use ${p} inside the repository`)
}

const hashed = (id, password, extra = {}) => {
    const salt = randomBytes(16).toString('hex')
    const hash = pbkdf2Sync(password, Buffer.from(salt, 'hex'), ITERATIONS, 32, 'sha256').toString('hex')
    return { key: `account:${id}`, value: JSON.stringify({ salt, iter: ITERATIONS, hash, ...extra }) }
}
const accountExtra = role === 'instructor' ? { role, ...(name ? { name } : {}) } : {}

if (fromRoster) {
    // Roster columns: ID,Password[,Role,Name]
    const entries = readFileSync(fromRoster, 'utf8').split(/\r?\n/).slice(1)
        .map((line) => line.trim().split(','))
        .filter(([id, password]) => /^TAMU-\d{3}$/.test(id) && password)
    writeFileSync(kvPath, JSON.stringify(entries.map(([id, password, r, n]) => hashed(id, password, r === 'instructor' ? { role: r, ...(n ? { name: n } : {}) } : {}))))
    console.log(`rebuilt ${entries.length} account hashes from ${fromRoster} -> ${kvPath}`)
    process.exit(0)
}

const used = new Set()
const rows = []
const kv = []
for (let n = start; n < start + count; n++) {
    let password
    do {
        const a = WORDS[randomInt(WORDS.length)]
        let b
        do b = WORDS[randomInt(WORDS.length)]; while (b === a)
        let c
        do c = WORDS[randomInt(WORDS.length)]; while (c === a || c === b)
        password = role === 'instructor' ? `${a}-${b}-${c}-${randomInt(10, 100)}` : `${a}-${b}-${randomInt(10, 100)}`
    } while (used.has(password))
    used.add(password)
    const id = `TAMU-${String(n).padStart(3, '0')}`
    rows.push(role === 'instructor' ? `${id},${password},instructor,${name || ''}` : `${id},${password}`)
    kv.push(hashed(id, password, accountExtra))
}
writeFileSync(rosterPath, `${role === 'instructor' ? 'ID,Password,Role,Name' : 'ID,Password'}\r\n${rows.join('\r\n')}\r\n`)
writeFileSync(kvPath, JSON.stringify(kv))
console.log(`wrote ${count} accounts: roster -> ${rosterPath}, hashes -> ${kvPath}`)
