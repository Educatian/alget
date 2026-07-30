#!/usr/bin/env node
/** Repair the known Selwyn book-identifier mismatch in CAT 531 content. */
import { readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const contentRoot = path.join(root, 'frontend', 'content', 'cat531-supplement')
const wrongDoi = '10.4324/9781315670160'
const correctDoi = '10.4324/9781315886350'
const canonicalCitation = 'Selwyn, N. (2014). Distrusting Educational Technology: Critical Questions for Changing Times. Routledge.'

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(target) : [target]
  }))
  return nested.flat()
}

const files = (await walk(contentRoot)).filter((file) => file.endsWith('.mdx'))
let changedFiles = 0
let replacedIdentifiers = 0

for (const file of files) {
  const before = await readFile(file, 'utf8')
  const identifierCount = before.split(wrongDoi).length - 1
  if (!identifierCount) continue

  let after = before.replaceAll(wrongDoi, correctDoi)
  after = after
    .replaceAll(
      'Selwyn (2016), Is Technology Good for Education? (critical edtech studies).',
      canonicalCitation,
    )
    .replaceAll(
      'Selwyn (2016), Education and technology: Key issues and debates.',
      canonicalCitation,
    )
    .replaceAll(
      'Selwyn, N. (2016). Education and technology: Key issues and debates. Routledge.',
      canonicalCitation,
    )
    .replaceAll(
      'Selwyn, N. (2016). Distrusting Educational Technology: Critical Questions for Changing Times. Routledge.',
      canonicalCitation,
    )
    .replaceAll(
      'Selwyn, N. Critical edtech studies (Routledge; author/title attribution pending editor verification of the DOI).',
      canonicalCitation,
    )

  await writeFile(file, after, 'utf8')
  changedFiles += 1
  replacedIdentifiers += identifierCount
}

console.log(`Repaired ${replacedIdentifiers} citation identifiers across ${changedFiles} files.`)
