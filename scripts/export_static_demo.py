"""Export one course's read-only API responses as static files for the static demo build.

    cd frontend
    VITE_STATIC_DEMO=true VITE_API_BASE=/demo-api npm run build
    python ../scripts/export_static_demo.py dist            # course defaults to ai-literacy

Writes dist/demo-api/book/<course>/toc.json, .../<chapter>/<section>.json,
mastery_graph/<course>/<chapter>.json and search/index.json (this course only), plus a
Cloudflare Pages _redirects file that maps
the reader's extensionless API paths onto those files, and a _worker.js/_routes.json pair that
serves the lecture clips with byte ranges (for seeking). Responses come from the real
FastAPI handlers, so the demo shows exactly what the backend would serve.
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "backend"))

from fastapi.testclient import TestClient  # noqa: E402
from server import app  # noqa: E402

REDIRECTS = """\
/demo-api/book/:course/toc /demo-api/book/:course/toc.json 200
/demo-api/book/:course/:chapter/:section /demo-api/book/:course/:chapter/:section.json 200
/demo-api/search/index /demo-api/search/index.json 200
/demo-api/mastery_graph/:course/:chapter /demo-api/mastery_graph/:course/:chapter.json 200
"""

# Pages static hosting answers Range requests with the whole file, so browsers cannot seek in the
# lecture clips. This advanced-mode worker, limited to /media/* by _routes.json, serves those
# files with byte ranges; every other path stays on plain static hosting (and _redirects).
MEDIA_WORKER = """\
export default {
    async fetch(request, env) {
        const url = new URL(request.url)
        const asset = await env.ASSETS.fetch(new Request(url.toString(), { method: 'GET' }))
        if (!asset.ok || !/\\.(mp4|webm)$/i.test(url.pathname)) return asset
        const headers = new Headers(asset.headers)
        headers.set('Accept-Ranges', 'bytes')
        const range = request.headers.get('Range')
        if (request.method === 'HEAD') return new Response(null, { status: 200, headers })
        if (!range) return new Response(asset.body, { status: 200, headers })
        const body = await asset.arrayBuffer()
        const size = body.byteLength
        const m = /^bytes=(\\d*)-(\\d*)$/.exec(range.trim())
        let start = m && m[1] !== '' ? Number(m[1]) : m && m[2] !== '' ? Math.max(0, size - Number(m[2])) : NaN
        let end = m && m[1] !== '' && m[2] !== '' ? Math.min(Number(m[2]), size - 1) : size - 1
        if (!m || !(start >= 0) || start >= size || start > end) {
            return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } })
        }
        headers.set('Content-Range', `bytes ${start}-${end}/${size}`)
        headers.set('Content-Length', String(end - start + 1))
        return new Response(body.slice(start, end + 1), { status: 206, headers })
    },
}
"""
MEDIA_ROUTES = {"version": 1, "include": ["/media/*"], "exclude": []}


def write(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False), encoding="utf-8")


def main(dist: Path, course: str) -> None:
    client = TestClient(app)
    api = dist / "demo-api"

    def get(url):
        res = client.get(url)
        res.raise_for_status()
        return res.json()

    toc = get(f"/api/book/{course}/toc")
    write(api / "book" / course / "toc.json", toc)
    count = 0
    for chapter in toc["chapters"]:
        # Chapter brain-network graph with no mastery; the browser applies the reader's own.
        graph = client.post("/api/mastery_graph", json={
            "mastery_data": {}, "course": course, "current_section_id": f"{course}/{chapter['id']}/-", "current_concepts": [],
        })
        graph.raise_for_status()
        write(api / "mastery_graph" / course / f"{chapter['id']}.json", graph.json())
        for section in chapter["sections"]:
            ch, sec = str(chapter["id"]), str(section["id"])
            write(api / "book" / course / ch / f"{sec}.json", get(f"/api/book/{course}/{ch}/{sec}"))
            count += 1

    index = get("/api/search/index")
    entries = [e for e in index["items"] if e.get("course") == course]
    write(api / "search" / "index.json", {**index, "items": entries})

    (dist / "_redirects").write_text(REDIRECTS, encoding="utf-8")
    (dist / "_worker.js").write_text(MEDIA_WORKER, encoding="utf-8")
    (dist / "_routes.json").write_text(json.dumps(MEDIA_ROUTES), encoding="utf-8")
    print(f"exported {course}: toc, {count} sections, {len(entries)} search entries -> {api}")


if __name__ == "__main__":
    main(Path(sys.argv[1]).resolve(), sys.argv[2] if len(sys.argv) > 2 else "ai-literacy")
