#!/usr/bin/env node
// Verify that the Cloudflare Pages static API snapshot is complete enough to
// serve the hosted ALGET app without a Python backend.
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CONTENT = join(ROOT, 'frontend', 'content')
const API = join(ROOT, 'frontend', 'public', 'api')
const BOOK = join(API, 'book')
const EXPECTED_SECTIONS = 256

const errors = []
const isDir = (p) => {
  try { return statSync(p).isDirectory() } catch { return false }
}
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

function fail(message) {
  errors.push(message)
}

function listCourses(root) {
  if (!isDir(root)) return []
  return readdirSync(root).filter((name) => !name.startsWith('_') && isDir(join(root, name))).sort()
}

const courses = listCourses(CONTENT)
const sourceSections = []
for (const course of courses) {
  for (const chapter of readdirSync(join(CONTENT, course)).sort()) {
    const chapterDir = join(CONTENT, course, chapter)
    if (!isDir(chapterDir)) continue
    for (const file of readdirSync(chapterDir).sort()) {
      if (file.endsWith('.mdx')) sourceSections.push({ course, chapter, section: file.replace(/\.mdx$/, '') })
    }
  }
}

if (sourceSections.length !== EXPECTED_SECTIONS) {
  fail(`expected ${EXPECTED_SECTIONS} authored sections, found ${sourceSections.length}`)
}

for (const required of ['search/index', 'concept-origins']) {
  if (!existsSync(join(API, required))) fail(`missing /api/${required}`)
}

let snapshotSections = 0
for (const course of courses) {
  if (!existsSync(join(BOOK, course, 'toc'))) fail(`missing /api/book/${course}/toc`)
  if (!existsSync(join(API, 'diagnostic', 'questions', course))) fail(`missing /api/diagnostic/questions/${course}`)
  if (!existsSync(join(API, 'mastery-graph', course))) fail(`missing /api/mastery-graph/${course}`)
}

for (const { course, chapter, section } of sourceSections) {
  const path = join(BOOK, course, chapter, section)
  if (!existsSync(path)) {
    fail(`missing static section /api/book/${course}/${chapter}/${section}`)
    continue
  }
  snapshotSections += 1
  let data
  try {
    data = readJson(path)
  } catch (err) {
    fail(`invalid JSON in /api/book/${course}/${chapter}/${section}: ${err.message}`)
    continue
  }
  if (!data?.meta?.title) fail(`missing meta.title in /api/book/${course}/${chapter}/${section}`)
  if (!data?.content || typeof data.content !== 'string') fail(`missing content in /api/book/${course}/${chapter}/${section}`)
  if (!Array.isArray(data?.practice?.problems)) fail(`missing practice.problems in /api/book/${course}/${chapter}/${section}`)
  if (!Array.isArray(data?.misconceptions)) fail(`missing baked misconceptions in /api/book/${course}/${chapter}/${section}`)
  if (!data?.content_version?.content_version || !data?.content_version?.algorithm) {
    fail(`missing content_version descriptor in /api/book/${course}/${chapter}/${section}`)
  }
}

if (snapshotSections !== EXPECTED_SECTIONS) {
  fail(`expected ${EXPECTED_SECTIONS} static section snapshots, found ${snapshotSections}`)
}

if (errors.length) {
  console.error(`verify_static_snapshot: FAIL - ${errors.length} issue(s)`)
  for (const error of errors.slice(0, 40)) console.error(`  - ${error}`)
  if (errors.length > 40) console.error(`  ...and ${errors.length - 40} more`)
  process.exit(1)
}

console.log(`verify_static_snapshot: PASS - ${snapshotSections} sections across ${courses.length} courses`)
