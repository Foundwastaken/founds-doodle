#!/usr/bin/env node
// Turns doodle stories (JSON) into self-contained HTML pages: animated scenes, drawing
// tools, a notebook and a "talk back" panel. Also keeps an index.html of every story in
// the folder, so the stories form a little library you can come back to.
// No dependencies; Node 18+.
//
//   node doodle.mjs .doodle/overview.json --open     build it (and its neighbours), open it
//   node doodle.mjs .doodle --open                   rebuild the library, open the index
//   cat story.json | node doodle.mjs - -o out.html
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync, existsSync } from 'node:fs'
import { dirname, resolve, join, basename, extname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
import { parseStory, slug } from './core.js'

const here = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const flag = name => args.includes(name)
const value = name => {
  const k = args.indexOf(name)
  return k >= 0 ? args[k + 1] : undefined
}
const input = args.find((a, k) => (a === '-' || !a.startsWith('-')) && args[k - 1] !== '-o')

if (!input || flag('-h') || flag('--help')) {
  console.log('usage: node doodle.mjs <story.json | folder | -> [-o out.html] [--open]')
  process.exit(input ? 0 : 1)
}

const core = readFileSync(join(here, 'core.js'), 'utf8').replace(/^export /gm, '')
const template = readFileSync(join(here, 'player.html'), 'utf8')
const safe = s => s.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--')
const escHtml = s => String(s).replace(/[<&"]/g, c => ({ '<': '&lt;', '&': '&amp;', '"': '&quot;' })[c])

// Reads one story file; warns about what it had to drop.
function load(raw, file) {
  const story = parseStory(raw)
  if (!story) return undefined
  let j = {}
  try {
    j = JSON.parse(raw.slice(raw.indexOf('{'), raw.lastIndexOf('}') + 1))
  } catch {}
  if (!j.id && file) story.id = slug(basename(file, extname(file)))
  const where = file ? basename(file) : 'story'
  const asked = Array.isArray(j.scenes) ? j.scenes.length : 1
  if (asked > story.scenes.length) console.warn(`doodle: ${where}: kept ${story.scenes.length} of ${asked} scenes (limit for style "${story.style}", or scenes with fewer than 2 valid nodes).`)
  ;(Array.isArray(j.scenes) ? j.scenes : [j]).forEach((s, k) => {
    const ids = new Set((s.nodes || []).map(nd => nd.id))
    const bad = (s.edges || []).filter(e => !ids.has(e.from) || !ids.has(e.to) || e.from === e.to)
    if (bad.length) console.warn(`doodle: ${where}: scene ${k + 1}: dropped ${bad.length} edge(s) with unknown or identical ends.`)
  })
  return story
}

function page(story, source, known) {
  return template
    .replace('__TITLE__', () => escHtml(story.title))
    .replace('/*__CORE__*/', () => safe(core))
    .replace('/*__STORY__*/null', () => safe(JSON.stringify(story)))
    .replace('/*__SOURCE__*/null', () => safe(JSON.stringify(source)))
    .replace('/*__KNOWN__*/null', () => safe(JSON.stringify(known)))
}

// Every story in a folder: build each page, then the index.
function library(dir) {
  const files = existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json')) : []
  const stories = []
  for (const f of files) {
    const file = join(dir, f)
    const s = load(readFileSync(file, 'utf8'), file)
    if (s) stories.push({ story: s, file, mtime: statSync(file).mtimeMs })
    else console.warn(`doodle: ${f}: not a doodle story, skipped.`)
  }
  const known = Object.fromEntries(stories.map(({ story }) => [story.id, { title: story.title, up: story.up, kind: story.kind, term: story.term }]))
  for (const { story, file } of stories) writeFileSync(join(dir, `${story.id}.html`), page(story, file, known))
  writeFileSync(join(dir, 'index.html'), index(stories))
  return stories
}

function index(stories) {
  const byId = new Map(stories.map(s => [s.story.id, s]))
  const parent = new Map()
  for (const { story } of stories) {
    if (story.up && byId.has(story.up)) parent.set(story.id, story.up)
    for (const sc of story.scenes) for (const nd of sc.nodes) if (nd.zoom && byId.has(nd.zoom) && !parent.has(nd.zoom) && nd.zoom !== story.id) parent.set(nd.zoom, story.id)
  }
  const kids = id => stories.filter(s => parent.get(s.story.id) === id).sort((a, b) => a.story.title.localeCompare(b.story.title))
  const item = ({ story, mtime }, depth) => {
    if (depth > 6) return ''
    const notes = story.scenes.reduce((n, sc) => n + sc.notes.length, 0)
    const meta = `${story.scenes.length} scene${story.scenes.length === 1 ? '' : 's'} · ${story.style}${notes ? ` · ${notes} note${notes === 1 ? '' : 's'}` : ''} · ${new Date(mtime).toLocaleDateString()}`
    const sub = kids(story.id)
    const tag = story.kind === 'concept' ? `<em>concept${story.term ? `: ${escHtml(story.term)}` : ''}</em> ` : ''
    return `<li>${tag}<a href="${escHtml(story.id)}.html">${escHtml(story.title)}</a> <span>${meta}</span>${sub.length ? `<ul>${sub.map(s => item(s, depth + 1)).join('')}</ul>` : ''}</li>`
  }
  const roots = stories.filter(s => !parent.has(s.story.id)).sort((a, b) => b.mtime - a.mtime)
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Founds Doodle library</title>
<style>
:root { --bg: #f4f1ea; --ink: #2f2a26; --muted: #7a7064; --line: #e2dccf; --accent: #d97757; }
@media (prefers-color-scheme: dark) { :root { --bg: #1d1b19; --ink: #eee7dc; --muted: #a39887; --line: #3a3530; } }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.5 system-ui, -apple-system, "Segoe UI", sans-serif; }
main { max-width: 760px; margin: 0 auto; padding: 36px 16px; }
h1 { font: 700 30px/1.2 "Segoe Print", "Comic Sans MS", "Bradley Hand", cursive; margin: 0 0 6px; }
p { color: var(--muted); margin: 0 0 24px; }
ul { list-style: none; padding-left: 22px; margin: 6px 0; border-left: 2px dashed var(--line); }
main > ul { padding-left: 0; border: 0; }
li { margin: 8px 0; }
a { color: var(--ink); font-weight: 600; text-decoration-color: var(--accent); text-underline-offset: 3px; }
span { color: var(--muted); font-size: 13.5px; margin-left: 6px; }
em { font-style: normal; font-size: 12px; color: var(--accent); border: 1px solid var(--accent); border-radius: 999px; padding: 1px 8px; margin-right: 6px; }
</style></head><body><main><h1>Founds Doodle library</h1><p>Every story in this folder. Deeper stories and concept explainers sit under the story they belong to.</p>
<ul>${roots.map(s => item(s, 0)).join('') || '<li>No stories yet.</li>'}</ul></main></body></html>`
}

function open(target) {
  const url = pathToFileURL(target).href
  const [cmd, cmdArgs] =
    process.platform === 'win32' ? ['cmd', ['/c', 'start', '""', url]] : process.platform === 'darwin' ? ['open', [url]] : ['xdg-open', [url]]
  try {
    spawn(cmd, cmdArgs, { detached: true, stdio: 'ignore' }).unref()
  } catch {
    console.log(`doodle: open it in a browser: ${url}`)
  }
}

const fail = () => {
  console.error('doodle: could not read the story. It needs {"title", "scenes": [{"title", "nodes": [{"id","label"}...], "edges": [{"from","to"}...]}]}, with at least 2 nodes per scene. See references/story-format.md.')
  process.exit(2)
}

if (input === '-') {
  const story = load(readFileSync(0, 'utf8'))
  if (!story) fail()
  const out = resolve(value('-o') ?? `${story.id}.html`)
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, page(story, null, {}))
  console.log(`doodle: "${story.title}" (${story.scenes.length} scenes, style ${story.style}) -> ${out}`)
  if (flag('--open')) open(out)
} else if (statSync(resolve(input)).isDirectory()) {
  const dir = resolve(input)
  const all = library(dir)
  console.log(`doodle: built ${all.length} stor${all.length === 1 ? 'y' : 'ies'} -> ${join(dir, 'index.html')}`)
  if (flag('--open')) open(join(dir, 'index.html'))
} else {
  const file = resolve(input)
  const story = load(readFileSync(file, 'utf8'), file)
  if (!story) fail()
  library(dirname(file))
  let out = join(dirname(file), `${story.id}.html`)
  if (value('-o')) {
    out = resolve(value('-o'))
    writeFileSync(out, readFileSync(join(dirname(file), `${story.id}.html`), 'utf8'))
  }
  console.log(`doodle: "${story.title}" (${story.scenes.length} scene${story.scenes.length === 1 ? '' : 's'}, style ${story.style}) -> ${out}`)
  console.log(`doodle: library -> ${join(dirname(file), 'index.html')}`)
  if (flag('--open')) open(out)
}
