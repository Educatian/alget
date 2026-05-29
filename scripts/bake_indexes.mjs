// Bake static indexes from the content snapshot so the Worker can serve
// concept-origin + mastery-graph with no backend:
//   - /api/concept-origins        : { concept_id -> first "course/ch/sec" slug }
//   - /api/mastery-graph/<course> : { nodes, links } skeleton (no per-user
//     mastery); the Worker overlays p_known / status / is_current per request.
// Run AFTER export_static_content.mjs (reads frontend/public/api/book).
import { readdirSync, readFileSync, writeFileSync, mkdirSync, existsSync, statSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const BOOK = join(ROOT, 'frontend', 'public', 'api', 'book')
const OUT = join(ROOT, 'frontend', 'public', 'api')

const isDir = (p) => { try { return statSync(p).isDirectory() } catch { return false } }
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const save = (rel, data) => { const f = join(OUT, rel); mkdirSync(dirname(f), { recursive: true }); writeFileSync(f, JSON.stringify(data)) }
const humanize = (v) => {
  if (!v) return 'Untitled concept'
  return String(v).replace(/[-_]/g, ' ').trim().split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

const conceptOrigins = {}
let graphCount = 0
const courses = readdirSync(BOOK).filter((c) => isDir(join(BOOK, c)))

for (const course of courses.sort()) {
  const tocPath = join(BOOK, course, 'toc')
  if (!existsSync(tocPath)) continue
  const toc = readJson(tocPath)
  const nodes = []
  const links = []
  let prevLast = null
  const chapters = toc.chapters || []
  chapters.forEach((chapter, ci) => {
    const chapterOrder = ci + 1
    const chapterId = String(chapter.id ?? '')
    const chapterTitle = String(chapter.title ?? `Chapter ${chapterId}`)
    ;(chapter.sections || []).forEach((section, si) => {
      const sectionOrder = si + 1
      const sectionId = String(section.id ?? '')
      const slug = `${course}/${chapterId}/${sectionId}`
      const secPath = join(BOOK, course, chapterId, sectionId)
      let conceptIds = []
      if (existsSync(secPath)) {
        try { conceptIds = (readJson(secPath).meta || {}).concept_ids || [] } catch { conceptIds = [] }
      }
      if (!conceptIds.length) conceptIds = [`section_${chapterId}_${sectionId}`]
      const sectionNodeIds = []
      conceptIds.forEach((conceptId, idx) => {
        const nodeId = String(conceptId || `section_${chapterId}_${sectionId}_${idx + 1}`)
        sectionNodeIds.push(nodeId)
        nodes.push({
          id: nodeId, label: humanize(conceptId), group: chapterId, course,
          chapter: chapterId, chapter_title: chapterTitle, chapter_order: chapterOrder,
          section_id: slug, section_title: String(section.title ?? `Section ${sectionId}`),
          section_order: sectionOrder, concept_order: idx + 1,
        })
        if (!(nodeId in conceptOrigins)) conceptOrigins[nodeId] = slug
      })
      for (let k = 0; k < sectionNodeIds.length - 1; k++) links.push({ source: sectionNodeIds[k], target: sectionNodeIds[k + 1] })
      if (prevLast && sectionNodeIds.length) links.push({ source: prevLast, target: sectionNodeIds[0] })
      if (sectionNodeIds.length) prevLast = sectionNodeIds[sectionNodeIds.length - 1]
    })
  })
  save(`mastery-graph/${course}`, { nodes, links })
  graphCount++
}

save('concept-origins', conceptOrigins)
console.log(`baked ${graphCount} mastery-graph skeletons + concept-origins (${Object.keys(conceptOrigins).length} concepts)`)
