// Live mode: the story pages talk to the agent directly, no copy and paste.
//
//   node doodle.mjs serve [.doodle] [--port 7311] [--open <story id>]
//        Serves the library on http://127.0.0.1:<port>/ (this computer only), rebuilds a
//        story when its JSON changes (the page reloads itself), and passes messages
//        between the page and the agent. Keeps running until stopped.
//   node doodle.mjs listen [--dir .doodle] [--timeout <minutes>]
//        Waits for the next message the reader sends from a page, prints it, and exits.
//   node doodle.mjs reply "text" | --file answer.md | (stdin) [--dir .doodle]
//        Puts the agent's answer in the page's chat thread.
//
// The conversation is kept in <dir>/talk.jsonl; the running server's port in <dir>/.server.json.
//
// Safety: the server only listens on 127.0.0.1, only answers requests addressed to
// 127.0.0.1/localhost (no DNS rebinding), turns away requests made by other websites,
// only serves the built story pages, and the agent's side (next, reply) needs the
// secret key from .server.json, which pages never see.
import http from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { readFileSync, writeFileSync, appendFileSync, existsSync, mkdirSync, unlinkSync, watch } from 'node:fs'
import { join, resolve, basename } from 'node:path'

const DEFAULT_PORT = 7311
const WITH_VALUE = new Set(['--port', '--open', '--dir', '--file', '--story', '--scene', '--timeout'])
const val = (argv, name) => {
  const k = argv.indexOf(name)
  return k >= 0 ? argv[k + 1] : undefined
}
const positional = argv => argv.filter((a, k) => !a.startsWith('--') && !WITH_VALUE.has(argv[k - 1]))
const defaultDir = () => resolve(existsSync('.doodle') ? '.doodle' : '.')

// the running server's port and the agent's key, from <dir>/.server.json
function serverFor(argv) {
  const dir = val(argv, '--dir') ? resolve(val(argv, '--dir')) : defaultDir()
  let info = {}
  try {
    info = JSON.parse(readFileSync(join(dir, '.server.json'), 'utf8'))
  } catch {}
  return { port: Number(val(argv, '--port')) || info.port || DEFAULT_PORT, key: info.key || '' }
}

export async function run(command, argv, helpers) {
  if (command === 'serve') return serve(argv, helpers)
  if (command === 'listen') return listen(argv)
  if (command === 'reply') return reply(argv)
}

// ---------------------------------------------------------------- serve
async function serve(argv, { library, openUrl }) {
  const dir = resolve(positional(argv)[0] || defaultDir())
  mkdirSync(dir, { recursive: true })
  let stories = library(dir)
  const talkFile = join(dir, 'talk.jsonl')
  const thread = existsSync(talkFile)
    ? readFileSync(talkFile, 'utf8').split('\n').filter(Boolean).map(l => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
    : []
  const inbox = []
  const waiters = []
  // true from the moment a message reaches the agent until the agent replies
  let working = false
  const clients = new Set()

  const push = (event, data) => {
    for (const res of clients) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
  }
  const state = () => ({ listening: waiters.length > 0, working, waiting: inbox.length })
  const status = () => push('status', state())
  const record = item => {
    thread.push(item)
    appendFileSync(talkFile, JSON.stringify(item) + '\n')
    push('thread', item)
  }
  const body = req =>
    new Promise((ok, no) => {
      let b = ''
      req.on('data', c => {
        b += c
        if (b.length > 300000) {
          req.destroy()
          no(new Error('message too large'))
        }
      })
      req.on('end', () => {
        try {
          ok(JSON.parse(b || '{}'))
        } catch (e) {
          no(e)
        }
      })
    })

  const key = randomBytes(24).toString('hex')
  const isAgent = req => {
    const got = Buffer.from(String(req.headers['x-doodle-key'] || ''))
    const want = Buffer.from(key)
    return got.length === want.length && timingSafeEqual(got, want)
  }
  let port = 0
  // only this computer's own pages: the Host must be ours, and a browser request must come from our origin
  const fromUs = req => {
    const ours = [`127.0.0.1:${port}`, `localhost:${port}`]
    if (!ours.includes(String(req.headers.host || '').toLowerCase())) return false
    const origin = req.headers.origin
    if (origin && !ours.some(h => origin.toLowerCase() === `http://${h}`)) return false
    const site = req.headers['sec-fetch-site']
    if (site && site !== 'same-origin' && site !== 'none') return false
    return true
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1')
    const json = (code, data) => {
      if (res.writableEnded) return
      res.writeHead(code, { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff' })
      res.end(JSON.stringify(data))
    }
    if (!fromUs(req)) return json(403, { error: 'only pages served by this doodle server can talk to it' })
    if (req.method === 'POST' && !String(req.headers['content-type'] || '').startsWith('application/json')) return json(415, { error: 'send JSON' })
    if ((url.pathname === '/api/next' || url.pathname === '/api/reply') && !isAgent(req)) return json(403, { error: 'agent key needed' })
    try {
      if (url.pathname === '/api/ping') return json(200, { ok: true, ...state() })
      if (url.pathname === '/api/thread') {
        const id = url.searchParams.get('story')
        return json(200, thread.filter(t => !id || t.story === id))
      }
      if (url.pathname === '/api/events') {
        res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache', connection: 'keep-alive' })
        res.write(`event: status\ndata: ${JSON.stringify(state())}\n\n`)
        clients.add(res)
        req.on('close', () => clients.delete(res))
        return
      }
      if (url.pathname === '/api/send' && req.method === 'POST') {
        const b = await body(req)
        const text = String(b.text || '').slice(0, 100000)
        if (!text.trim()) return json(400, { error: 'empty message' })
        const item = { from: 'you', story: String(b.story || ''), scene: Number(b.scene) || 0, text, display: String(b.display || '').slice(0, 2000), at: new Date().toISOString() }
        record(item)
        let delivered = false
        while (waiters.length && !delivered) delivered = waiters.shift()(item)
        if (!delivered) inbox.push(item)
        else working = true
        status()
        return json(200, { delivered, waiting: inbox.length })
      }
      if (url.pathname === '/api/next') {
        if (inbox.length) {
          working = true
          json(200, inbox.shift())
          status()
          return
        }
        let done = false
        const answer = item => {
          if (done) return false
          done = true
          clearTimeout(timer)
          json(200, item)
          return true
        }
        // answer "nothing yet" before an HTTP client gives up; `listen` simply asks again
        const timer = setTimeout(() => {
          if (done) return
          done = true
          waiters.splice(waiters.indexOf(answer), 1)
          json(204, {})
          status()
        }, 240000)
        waiters.push(answer)
        status()
        req.on('close', () => {
          if (done) return
          done = true
          clearTimeout(timer)
          const k = waiters.indexOf(answer)
          if (k >= 0) waiters.splice(k, 1)
          status()
        })
        return
      }
      if (url.pathname === '/api/reply' && req.method === 'POST') {
        const b = await body(req)
        const text = String(b.text || '').slice(0, 200000)
        if (!text.trim()) return json(400, { error: 'empty reply' })
        const last = [...thread].reverse().find(t => t.from === 'you')
        const item = { from: 'agent', story: String(b.story || last?.story || ''), scene: Number(b.scene ?? last?.scene ?? 0), text, at: new Date().toISOString() }
        record(item)
        working = false
        status()
        return json(200, { ok: true })
      }
      // the library itself: only the built story pages and the index, nothing else in the folder
      let p = url.pathname
      if (p === '/') p = '/index.html'
      const name = p.slice(1)
      const pages = new Set(['index.html', ...stories.map(s => `${s.story.id}.html`)])
      const file = join(dir, name)
      if (!pages.has(name) || !existsSync(file)) return json(404, { error: 'not found' })
      res.writeHead(200, {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff',
        'x-frame-options': 'DENY',
        'content-security-policy': "frame-ancestors 'none'",
      })
      res.end(readFileSync(file))
    } catch (e) {
      json(500, { error: String(e.message || e) })
    }
  })

  const want = Number(val(argv, '--port')) || DEFAULT_PORT
  port = await new Promise((ok, no) => {
    let p = want
    const attempt = () => {
      server.once('error', e => {
        if (e.code === 'EADDRINUSE' && p < want + 30) {
          p++
          attempt()
        } else no(e)
      })
      server.listen(p, '127.0.0.1', () => ok(p))
    }
    attempt()
  })
  const info = join(dir, '.server.json')
  writeFileSync(info, JSON.stringify({ port, pid: process.pid, key }), { mode: 0o600 })
  const stop = () => {
    try {
      unlinkSync(info)
    } catch {}
    process.exit(0)
  }
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  setInterval(() => {
    for (const res of clients) res.write(': still here\n\n')
  }, 25000)

  // a story JSON changed: rebuild, and tell its open pages to reload
  let pending = new Set()
  let timer = null
  watch(dir, (_event, name) => {
    if (!name || !name.endsWith('.json') || name.startsWith('.')) return
    pending.add(name)
    clearTimeout(timer)
    timer = setTimeout(() => {
      const changed = [...pending]
      pending = new Set()
      try {
        stories = library(dir)
        const touched = stories.filter(s => changed.includes(basename(s.file)))
        // a new or changed zoom/concept story also changes its parent's links
        const ids = [...new Set(touched.flatMap(s => [s.story.id, s.story.up].filter(Boolean)))]
        push('reload', { ids })
        if (ids.length) console.log(`doodle: rebuilt ${ids.join(', ')}`)
      } catch (e) {
        console.error(`doodle: could not rebuild: ${e.message}`)
      }
    }, 300)
  })

  const base = `http://127.0.0.1:${port}`
  console.log(`doodle: live at ${base}/  (this computer only; stop with Ctrl+C)`)
  const first = val(argv, '--open')
  if (first !== undefined) openUrl(first && first !== 'index' ? `${base}/${encodeURIComponent(first)}.html` : `${base}/`)
}

// ---------------------------------------------------------------- listen
async function listen(argv) {
  const { port, key } = serverFor(argv)
  const until = val(argv, '--timeout') ? Date.now() + Number(val(argv, '--timeout')) * 60000 : Infinity
  while (Date.now() < until) {
    let res
    try {
      res = await fetch(`http://127.0.0.1:${port}/api/next`, { headers: { 'x-doodle-key': key } })
    } catch {
      // a long wait can time out on the client side; only give up if the server is gone
      try {
        await fetch(`http://127.0.0.1:${port}/api/ping`)
        continue
      } catch {
        console.error(`doodle: no doodle server on port ${port}. Start one with: node doodle.mjs serve .doodle`)
        process.exit(3)
      }
    }
    if (res.status === 200) {
      const item = await res.json()
      console.log(item.text)
      return
    }
    if (res.status === 403) {
      console.error('doodle: the server refused (wrong or missing key). Run listen from the folder the server was started for, or pass --dir.')
      process.exit(3)
    }
  }
  console.log('doodle: no message yet.')
  process.exit(4)
}

// ---------------------------------------------------------------- reply
async function reply(argv) {
  let text = val(argv, '--file') ? readFileSync(resolve(val(argv, '--file')), 'utf8') : positional(argv).join(' ')
  if (!text.trim() && !process.stdin.isTTY) text = readFileSync(0, 'utf8')
  if (!text.trim()) {
    console.error('doodle: nothing to send. Use: node doodle.mjs reply "your answer"  (or --file answer.md, or pipe it in)')
    process.exit(2)
  }
  const { port, key } = serverFor(argv)
  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/reply`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-doodle-key': key },
      body: JSON.stringify({ text, story: val(argv, '--story'), scene: val(argv, '--scene') }),
    })
    console.log(res.ok ? 'doodle: reply shown on the page.' : `doodle: the server refused the reply (${res.status}).`)
  } catch {
    console.error(`doodle: no doodle server on port ${port}. Start one with: node doodle.mjs serve .doodle`)
    process.exit(3)
  }
}
