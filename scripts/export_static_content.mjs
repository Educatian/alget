// Snapshot the backend's GET content endpoints into static JSON under
// frontend/public/api/ so the app serves a full reading experience on
// Cloudflare Pages with no Python backend. Requires the local backend on :8000.
import { mkdirSync, writeFileSync, readdirSync, existsSync, statSync } from 'fs'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const API = 'http://127.0.0.1:8000/api'
const OUT = join(ROOT, 'frontend', 'public', 'api')
const CONTENT = join(ROOT, 'frontend', 'content')

const requestedCourseIndex = process.argv.indexOf('--course')
const requestedCourse = requestedCourseIndex >= 0 ? process.argv[requestedCourseIndex + 1] : null
if (requestedCourseIndex >= 0 && !requestedCourse) {
  throw new Error('--course requires a course directory name')
}

const isDir = (p) => { try { return statSync(p).isDirectory() } catch { return false } }
const allCourses = readdirSync(CONTENT).filter((c) => !c.startsWith('_') && isDir(join(CONTENT, c)))
const courses = requestedCourse ? allCourses.filter((course) => course === requestedCourse) : allCourses
if (requestedCourse && courses.length === 0) {
  throw new Error(`Unknown course: ${requestedCourse}`)
}

async function save(routePath, data) {
  const file = join(OUT, routePath)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, JSON.stringify(data))
}
async function get(path) {
  const r = await fetch(API + path)
  if (!r.ok) throw new Error(`${path} -> ${r.status}`)
  return r.json()
}

let ok = 0, fail = 0
const failures = []
// search index
try { await save('search/index', await get('/search/index')); ok++; console.log('OK   search/index') }
catch (e) { fail++; failures.push(`search/index: ${e?.message || e}`); console.log('FAIL search/index', String(e).slice(0, 60)) }

for (const course of courses) {
  // toc
  try { await save(`book/${course}/toc`, await get(`/book/${course}/toc`)); ok++ }
  catch (e) { fail++; failures.push(`${course}/toc: ${e?.message || e}`); console.log(`FAIL ${course}/toc`, String(e).slice(0, 50)) }
  // diagnostic questions (deterministic, content-derived) -> static so the
  // pathway probe is instant and needs no live backend.
  try { await save(`diagnostic/questions/${course}`, await get(`/diagnostic/questions/${course}`)); ok++ }
  catch (e) { fail++; failures.push(`${course}/diagnostic: ${e?.message || e}`); console.log(`FAIL ${course}/diagnostic`, String(e).slice(0, 50)) }
  // sections
  for (const ch of readdirSync(join(CONTENT, course))) {
    const chdir = join(CONTENT, course, ch)
    let files = []
    try { files = readdirSync(chdir) } catch { continue }
    for (const f of files) {
      if (!f.endsWith('.mdx')) continue
      const sec = f.replace('.mdx', '')
      try { await save(`book/${course}/${ch}/${sec}`, await get(`/book/${course}/${ch}/${sec}`)); ok++ }
      catch (e) { fail++; failures.push(`${course}/${ch}/${sec}: ${e?.message || e}`); console.log(`FAIL ${course}/${ch}/${sec}`, String(e).slice(0, 50)) }
    }
  }
  console.log(`OK   ${course} (toc + sections)`)
}
console.log(`\nexported ${ok} files, ${fail} failed -> ${OUT}`)
if (fail > 0) {
  console.error('\nStatic export failed:')
  for (const failure of failures.slice(0, 20)) console.error(`  - ${failure}`)
  if (failures.length > 20) console.error(`  ...and ${failures.length - 20} more`)
  process.exit(1)
}
