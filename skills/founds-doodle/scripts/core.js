// doodle core: story parsing, layout and the hand-drawn SVG renderer.
// Plain ES module with no dependencies. The player inlines it with the 'export' keywords removed.

export const SHAPES = ['box', 'round', 'diamond', 'db', 'person', 'cloud', 'note', 'server', 'laptop', 'bulb', 'lock', 'doc', 'star', 'gear'];
const PICTOS = ['person', 'server', 'laptop', 'bulb', 'lock', 'doc', 'star', 'gear'];
const BASIC = ['box', 'round', 'diamond', 'db', 'person', 'cloud'];
// Safety limits only, far above any readable scene: depth is the story's choice, not the script's.
const MAX_NODES = { simple: 40, normal: 40, rich: 40 };
const INK = '#2f2a26';
const PAPER = '#fffdf6';
const FILLS = ['#ffd7a8', '#cfe8ff', '#d4f1c5', '#ffd0e0', '#e6d9ff', '#fff1a8'];
const FONT = "'Segoe Print','Comic Sans MS','Bradley Hand','Chalkboard SE',cursive";
const PITCH_X = 200;
const TITLE_H = 64;
const PAD = 30;
export const clip = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f = (v) => Math.round(v * 10) / 10;
function parseScene(j, style) {
    if (!j || !Array.isArray(j.nodes))
        return undefined;
    const seen = new Set();
    const nodes = [];
    for (const n of j.nodes.slice(0, MAX_NODES[style])) {
        const id = String(n?.id ?? '');
        if (!id || seen.has(id))
            continue;
        seen.add(id);
        nodes.push({
            id,
            label: clip(String(n.label ?? id), 40),
            shape: SHAPES.includes(n.shape) ? n.shape : 'box',
            note: n.note ? clip(String(n.note), 60) : undefined,
            zoom: n.zoom ? slug(String(n.zoom)) : undefined,
            step: n.step ? clip(String(n.step), 160) : undefined,
            col: Number.isInteger(n.col) && n.col >= 0 && n.col < 30 ? n.col : undefined,
            row: Number.isInteger(n.row) && n.row >= 0 && n.row < 20 ? n.row : undefined,
            details: n.details ? clip(String(n.details), 700) : undefined,
            file: n.file ? clip(String(n.file), 120) : undefined,
            code: n.code ? String(n.code).replace(/\t/g, '  ').split('\n').slice(0, 30).map(l => clip(l, 110)).join('\n') : undefined,
        });
    }
    if (nodes.length < 2)
        return undefined;
    const edges = [];
    for (const e of Array.isArray(j.edges) ? j.edges.slice(0, 80) : []) {
        const from = String(e?.from ?? '');
        const to = String(e?.to ?? '');
        if (from !== to && seen.has(from) && seen.has(to)) {
            edges.push({ from, to, label: e.label ? clip(String(e.label), 18) : undefined, step: e.step ? clip(String(e.step), 160) : undefined });
        }
    }
    return {
        title: clip(String(j.title ?? 'Doodle'), 44),
        style,
        layout: j.layout === 'down' || j.layout === 'cycle' ? j.layout : 'flow',
        nodes,
        edges,
        caption: j.narration || j.caption ? clip(String(j.narration ?? j.caption), 230) : undefined,
        notes: Array.isArray(j.notes) ? j.notes.slice(0, 50).map(x => clip(String(x), 280)).filter(Boolean) : [],
        points: Array.isArray(j.points) ? j.points.slice(0, 10).map(x => clip(String(x), 160)).filter(Boolean) : [],
        zones: Array.isArray(j.zones)
            ? j.zones.slice(0, 8).map(z => ({ label: clip(String(z?.label ?? ''), 30), nodes: (Array.isArray(z?.nodes) ? z.nodes : []).map(String).filter(id => seen.has(id)) })).filter(z => z.nodes.length)
            : [],
    };
}
const MAX_SCENES = { simple: 60, normal: 60, rich: 60 };
// A file-name-safe id: stories link to each other and keep the reader's drawings by it.
export const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'story';
export function parseStory(raw, asked = 'normal') {
    const a = raw.indexOf('{');
    const b = raw.lastIndexOf('}');
    if (a < 0 || b <= a)
        return undefined;
    let j;
    try {
        j = JSON.parse(raw.slice(a, b + 1));
    }
    catch {
        return undefined;
    }
    if (!j)
        return undefined;
    const style = j.style === 'simple' || j.style === 'rich' ? j.style : asked;
    const raws = Array.isArray(j.scenes) ? j.scenes : [j];
    const scenes = [];
    for (const r of raws.slice(0, MAX_SCENES[style])) {
        const sc = parseScene(r, style);
        if (sc)
            scenes.push(sc);
    }
    if (!scenes.length)
        return undefined;
    const title = clip(String(j.title ?? scenes[0].title), 44);
    return { id: slug(j.id ?? title), title, style, up: j.up ? slug(j.up) : undefined, kind: j.kind === 'concept' ? 'concept' : undefined, term: j.term ? clip(String(j.term), 40) : undefined, scenes };
}
export function mulberry32(seed) {
    let a = seed >>> 0;
    return () => {
        a = (a + 0x6d2b79f5) >>> 0;
        let t = a;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}
export function hash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++)
        h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
}
export function wrap(s, max, maxLines) {
    const lines = [];
    let cur = '';
    for (const w of s.split(/\s+/)) {
        if (cur && (cur + ' ' + w).length > max) {
            lines.push(cur);
            cur = w;
        }
        else
            cur = cur ? cur + ' ' + w : w;
    }
    if (cur)
        lines.push(cur);
    if (lines.length > maxLines) {
        const rest = lines.splice(maxLines - 1).join(' ');
        lines.push(clip(rest, max));
    }
    return lines;
}
// A wobbly line as one quadratic segment, overshooting a touch like a pen.
function rl(x1, y1, x2, y2, rng, j = 2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const ox = (dx / len) * rng() * 3;
    const oy = (dy / len) * rng() * 3;
    const mx = (x1 + x2) / 2 + (rng() - 0.5) * j * 2;
    const my = (y1 + y2) / 2 + (rng() - 0.5) * j * 2;
    return `M${f(x1 + (rng() - 0.5) * j - ox)} ${f(y1 + (rng() - 0.5) * j - oy)} Q${f(mx)} ${f(my)} ${f(x2 + ox)} ${f(y2 + oy)}`;
}
function blob(rx, ry, rng, opts) {
    const steps = opts.steps ?? 28;
    const th0 = rng() * 6.28;
    const pts = [];
    const fill = [];
    for (let i = 0; i <= steps + 2; i++) {
        const th = th0 + (i / steps) * Math.PI * 2;
        const bump = opts.bumps ? 1 + (opts.amp ?? 0.13) * Math.sin(opts.bumps * th) : 1;
        const jr = 1 + (rng() - 0.5) * (opts.jitter ?? 0.04);
        const x = Math.cos(th) * rx * bump * jr;
        const y = Math.sin(th) * ry * bump * jr + (opts.cy ?? 0);
        pts.push(`${i === 0 ? 'M' : 'L'}${f(x)} ${f(y)}`);
        if (i < steps)
            fill.push(`${i === 0 ? 'M' : 'L'}${f(x)} ${f(y)}`);
    }
    return { d: pts.join(' '), fill: fill.join(' ') + ' Z' };
}
function pictogram(kind, rng) {
    const box = (x0, y0, x1, y1, j = 1.4) => [rl(x0, y0, x1, y0, rng, j), rl(x1, y0, x1, y1, rng, j), rl(x1, y1, x0, y1, rng, j), rl(x0, y1, x0, y0, rng, j)].join(' ');
    const poly = (x0, y0, x1, y1) => `M${x0} ${y0} L${x1} ${y0} L${x1} ${y1} L${x0} ${y1} Z`;
    switch (kind) {
        case 'server': {
            const d = [box(-28, -36, 28, -10), box(-28, -8, 28, 18), rl(-20, -23, -8, -23, rng, 0.6), rl(-20, 5, -8, 5, rng, 0.6), rl(14, -23, 20, -23, rng, 0.6), rl(14, 5, 20, 5, rng, 0.6), rl(0, 18, 0, 28, rng, 0.6), rl(-16, 28, 16, 28, rng, 0.8)].join(' ');
            return { d, fill: poly(-28, -36, 28, 18) };
        }
        case 'laptop': {
            const d = [box(-26, -32, 26, 6), rl(-36, 16, 36, 16, rng, 1), rl(-26, 6, -36, 16, rng, 0.8), rl(26, 6, 36, 16, rng, 0.8)].join(' ');
            return { d, fill: poly(-26, -32, 26, 6) };
        }
        case 'bulb': {
            const g = blob(17, 17, rng, { steps: 20, jitter: 0.05, cy: -14 });
            const d = [g.d, rl(-8, 6, 8, 6, rng, 0.8), rl(-6, 12, 6, 12, rng, 0.8), rl(0, -46, 0, -40, rng, 0.5), rl(-24, -38, -20, -34, rng, 0.5), rl(24, -38, 20, -34, rng, 0.5), rl(-32, -14, -27, -14, rng, 0.5), rl(32, -14, 27, -14, rng, 0.5)].join(' ');
            return { d, fill: g.fill };
        }
        case 'lock': {
            const arc = [];
            for (let i = 0; i <= 10; i++) {
                const th = Math.PI - (i / 10) * Math.PI;
                arc.push(`${i === 0 ? 'M' : 'L'}${f(Math.cos(th) * 12)} ${f(-8 - Math.sin(th) * 18 + (rng() - 0.5))}`);
            }
            const key = blob(3, 3, rng, { steps: 8, jitter: 0.1, cy: 6 });
            return { d: [box(-20, -8, 20, 22), arc.join(' '), key.d].join(' '), fill: poly(-20, -8, 20, 22) };
        }
        case 'doc': {
            const d = [rl(-20, -34, 8, -34, rng, 1), rl(8, -34, 20, -22, rng, 1), rl(20, -22, 20, 26, rng, 1), rl(20, 26, -20, 26, rng, 1), rl(-20, 26, -20, -34, rng, 1), rl(8, -34, 8, -22, rng, 0.6), rl(8, -22, 20, -22, rng, 0.6), rl(-12, -10, 12, -10, rng, 0.8), rl(-12, 2, 12, 2, rng, 0.8), rl(-12, 14, 4, 14, rng, 0.8)].join(' ');
            return { d, fill: 'M-20 -34 L8 -34 L20 -22 L20 26 L-20 26 Z' };
        }
        case 'star': {
            const pts = [];
            for (let i = 0; i <= 10; i++) {
                const r = (i % 2 === 0 ? 28 : 12) * (1 + (rng() - 0.5) * 0.06);
                const th = -Math.PI / 2 + (i * Math.PI) / 5;
                pts.push(`${i === 0 ? 'M' : 'L'}${f(Math.cos(th) * r)} ${f(Math.sin(th) * r - 4)}`);
            }
            return { d: pts.join(' '), fill: pts.slice(0, 10).join(' ') + ' Z' };
        }
        default: {
            const g = blob(24, 24, rng, { bumps: 8, steps: 64, amp: 0.14, jitter: 0.02, cy: -6 });
            const hole = blob(8, 8, rng, { steps: 12, jitter: 0.06, cy: -6 });
            return { d: g.d + ' ' + hole.d, fill: g.fill };
        }
    }
}
function outline(n, rng) {
    const label = wrap(n.label, 14, 3);
    const longest = Math.max(...label.map(l => l.length));
    const w = Math.max(96, Math.min(156, longest * 8.6 + 30));
    const h = label.length * 19 + 24;
    const hw = w / 2;
    const hh = h / 2;
    const rect = (x0, y0, x1, y1) => [rl(x0, y0, x1, y0, rng), rl(x1, y0, x1, y1, rng), rl(x1, y1, x0, y1, rng), rl(x0, y1, x0, y0, rng)].join(' ');
    const labelStart = -((label.length - 1) * 9.5) + 5;
    switch (n.shape) {
        case 'round': {
            const b = blob(hw + 8, hh + 5, rng, {});
            return { d: b.d, fill: b.fill, hw: hw + 14, hh: hh + 10, label, labelY: labelStart, noteY: hh + 24 };
        }
        case 'cloud': {
            const b = blob(hw + 14, hh + 12, rng, { bumps: 6, steps: 60, amp: 0.12, jitter: 0.02 });
            return { d: b.d, fill: b.fill, hw: hw + 22, hh: hh + 20, label, labelY: labelStart, noteY: hh + 32 };
        }
        case 'diamond': {
            const px = hw * 1.15;
            const py = hh * 1.45;
            const d = [rl(0, -py, px, 0, rng), rl(px, 0, 0, py, rng), rl(0, py, -px, 0, rng), rl(-px, 0, 0, -py, rng)].join(' ');
            return { d, fill: `M0 ${f(-py)} L${f(px)} 0 L0 ${f(py)} L${f(-px)} 0 Z`, hw: px + 6, hh: py + 6, label, labelY: labelStart, noteY: py + 18 };
        }
        case 'db': {
            const ry = 9;
            const top = blob(hw, ry, rng, { steps: 20, jitter: 0.03, cy: -hh + ry });
            const bottomPts = [];
            for (let i = 0; i <= 10; i++) {
                const th = (i / 10) * Math.PI;
                bottomPts.push(`${i === 0 ? 'M' : 'L'}${f(Math.cos(th) * -hw)} ${f(hh - ry + Math.sin(th) * ry + (rng() - 0.5))}`);
            }
            const sides = rl(-hw, -hh + ry, -hw, hh - ry, rng, 1.2) + ' ' + rl(hw, -hh + ry, hw, hh - ry, rng, 1.2);
            return {
                d: top.d + ' ' + sides + ' ' + bottomPts.join(' '),
                fill: `M${f(-hw)} ${f(-hh + ry)} L${f(hw)} ${f(-hh + ry)} L${f(hw)} ${f(hh - ry)} L${f(-hw)} ${f(hh - ry)} Z`,
                hw: hw + 6,
                hh: hh + 6,
                label,
                labelY: labelStart + ry / 2,
                noteY: hh + 18,
            };
        }
        case 'note': {
            const c = 14;
            const d = [
                rl(-hw, -hh, hw - c, -hh, rng, 1.4),
                rl(hw - c, -hh, hw, -hh + c, rng, 1),
                rl(hw, -hh + c, hw, hh, rng, 1.4),
                rl(hw, hh, -hw, hh, rng, 1.4),
                rl(-hw, hh, -hw, -hh, rng, 1.4),
                rl(hw - c, -hh, hw - c, -hh + c, rng, 0.8),
                rl(hw - c, -hh + c, hw, -hh + c, rng, 0.8),
            ].join(' ');
            return { d, fill: `M${f(-hw)} ${f(-hh)} L${f(hw - c)} ${f(-hh)} L${f(hw)} ${f(-hh + c)} L${f(hw)} ${f(hh)} L${f(-hw)} ${f(hh)} Z`, hw: hw + 6, hh: hh + 6, label, labelY: labelStart, noteY: hh + 18 };
        }
        case 'server':
        case 'laptop':
        case 'bulb':
        case 'lock':
        case 'doc':
        case 'star':
        case 'gear': {
            const p = pictogram(n.shape, rng);
            const lw = (Math.max(...label.map(l => l.length)) * 8.4) / 2;
            return { d: p.d, fill: p.fill, hw: Math.max(36, lw + 6), hh: 54, label, labelY: 54, noteY: 54 + label.length * 19 + 4 };
        }
        case 'person': {
            const head = blob(11, 11, rng, { steps: 14, jitter: 0.06, cy: -30 });
            const body = [
                rl(0, -19, 0, 12, rng, 1),
                rl(-17, -8, 17, -8, rng, 1.2),
                rl(0, 12, -13, 33, rng, 1),
                rl(0, 12, 13, 33, rng, 1),
            ].join(' ');
            const lw = Math.max(...label.map(l => l.length)) * 8.4 / 2;
            return { d: head.d + ' ' + body, fill: head.fill, hw: Math.max(34, lw + 6), hh: 54, label, labelY: 54, noteY: 54 + label.length * 19 + 4 };
        }
        default: {
            const d = rect(-hw, -hh, hw, hh);
            return { d, fill: `M${f(-hw)} ${f(-hh)} L${f(hw)} ${f(-hh)} L${f(hw)} ${f(hh)} L${f(-hw)} ${f(hh)} Z`, hw: hw + 6, hh: hh + 6, label, labelY: labelStart, noteY: hh + 18 };
        }
    }
}
function layout(spec, capH) {
    var _a;
    const n = spec.nodes.length;
    const idx = new Map(spec.nodes.map((nd, i) => [nd.id, i]));
    const out = spec.nodes.map(() => []);
    const indeg = spec.nodes.map(() => 0);
    for (const e of spec.edges) {
        out[idx.get(e.from)].push(idx.get(e.to));
        indeg[idx.get(e.to)]++;
    }
    const depth = new Array(n).fill(-1);
    const bfs = (s) => {
        depth[s] = 0;
        const q = [s];
        while (q.length) {
            const c = q.shift();
            for (const t of out[c])
                if (depth[t] < 0) {
                    depth[t] = depth[c] + 1;
                    q.push(t);
                }
        }
    };
    const roots = spec.nodes.map((_, i) => i).filter(i => indeg[i] === 0);
    for (const r of roots.length ? roots : [0])
        if (depth[r] < 0)
            bfs(r);
    for (let i = 0; i < n; i++)
        if (depth[i] < 0)
            bfs(i);
    // Longest-path layers: the edges BFS saw going forward form a DAG, and pushing each
    // target past its source puts dead ends (a "Failed" box) at the end instead of the middle.
    const fwd = spec.edges.map(e => [idx.get(e.from), idx.get(e.to)]).filter(([u, v]) => depth[v] > depth[u]);
    for (let pass = 0; pass < n; pass++) {
        let moved = false;
        for (const [u, v] of fwd)
            if (depth[v] < depth[u] + 1) {
                depth[v] = depth[u] + 1;
                moved = true;
            }
        if (!moved)
            break;
    }
    const hasNotes = spec.nodes.some(nd => nd.note || PICTOS.includes(nd.shape));
    const pitchY = hasNotes ? 140 : 108;
    const order = spec.nodes.map((_, i) => i);
    if (n && spec.nodes.every(nd => nd.col !== undefined && nd.row !== undefined)) {
        const maxCol = Math.max(...spec.nodes.map(nd => nd.col));
        const maxRow = Math.max(...spec.nodes.map(nd => nd.row));
        const W = Math.max(520, (maxCol + 1) * PITCH_X + 2 * PAD);
        const left = (W - (maxCol + 1) * PITCH_X) / 2;
        const pos = spec.nodes.map(nd => ({ x: left + (nd.col + 0.5) * PITCH_X, y: TITLE_H + pitchY / 2 + nd.row * pitchY }));
        // grid scenes draw in the order the story lists its parts
        return { pos, order, W, H: TITLE_H + (maxRow + 1) * pitchY + 10 + capH };
    }
    if (spec.layout === 'cycle') {
        const rx = 250;
        const ry = n > 6 ? 170 : 130;
        const W = Math.max(640, 2 * rx + 2 * PAD + 170);
        const H = 2 * ry + 150;
        const pos = spec.nodes.map((_, i) => {
            const th = -Math.PI / 2 + (i / n) * Math.PI * 2;
            return { x: W / 2 + Math.cos(th) * rx, y: TITLE_H + H / 2 + Math.sin(th) * ry };
        });
        return { pos, order, W, H: H + TITLE_H + capH };
    }
    // Auto layout: the longest path through the scene is the spine, drawn as one straight row.
    // Everything else sits on rows below, next to the spine steps it belongs to: a dead end
    // ("Failed") under the steps that lead to it, an extra starter just before the step it feeds.
    order.sort((a, b) => depth[a] - depth[b] || a - b);
    const ins = spec.nodes.map(() => []);
    for (const [u, v] of fwd)
        ins[v].push(u);
    let end = 0;
    for (let i = 0; i < n; i++)
        if (depth[i] > depth[end])
            end = i;
    const spine = [end];
    while (true) {
        const cur = spine[0];
        const prev = ins[cur].filter(u => depth[u] === depth[cur] - 1).sort((a, b) => a - b)[0];
        if (prev === undefined)
            break;
        spine.unshift(prev);
    }
    // A long spine folds like a snake: left to right, then right to left one band lower,
    // so every fold continues right under where the last one ended. Each band keeps its
    // side parts in the rows just below it.
    const PER = spine.length <= 7 ? Math.max(1, spine.length) : 6;
    const band = new Array(n).fill(-1);
    const col = new Array(n).fill(-1);
    const sub = new Array(n).fill(-1);
    spine.forEach((ni, k) => {
        const b = Math.floor(k / PER);
        band[ni] = b;
        col[ni] = b % 2 === 0 ? k % PER : PER - 1 - (k % PER);
        sub[ni] = 0;
    });
    const taken = new Set(spine.map(ni => `${band[ni]},${col[ni]},0`));
    // keep clear the column where a fold drops down to the next band
    const drops = new Set();
    for (let k = PER - 1; k < spine.length - 1; k += PER)
        drops.add(`${band[spine[k]]},${col[spine[k]]}`);
    const maxCol = PER;    // one spare column at the edge for side parts
    // a free spot near column c of band b: the row below first, sideways before going deeper
    const place = (ni, b, c) => {
        for (let r = 1; r < 20; r++)
            for (const dc of [0, 1, -1, 2, -2]) {
                const cc = c + dc;
                if (cc < 0 || cc > maxCol || taken.has(`${b},${cc},${r}`) || drops.has(`${b},${cc}`))
                    continue;
                band[ni] = b;
                col[ni] = cc;
                sub[ni] = r;
                taken.add(`${b},${cc},${r}`);
                return;
            }
        band[ni] = b;
        col[ni] = c;
        sub[ni] = 20;
    };
    // repeat so parts hanging off other placed parts find their spot too
    for (let pass = 0; pass < n && band.includes(-1); pass++) {
        for (const ni of order) {
            if (band[ni] >= 0)
                continue;
            const parents = spec.edges.filter(e => idx.get(e.to) === ni).map(e => idx.get(e.from)).filter(u => band[u] >= 0);
            const kids = spec.edges.filter(e => idx.get(e.from) === ni).map(e => idx.get(e.to)).filter(v => band[v] >= 0);
            if (parents.length) {
                const b = band[parents[0]];
                const same = parents.filter(u => band[u] === b);
                place(ni, b, Math.round(same.reduce((t, u) => t + col[u], 0) / same.length));
            }
            else if (kids.length)
                place(ni, band[kids[0]], col[kids[0]]);
            else if (pass === n - 1 || !spec.edges.some(e => idx.get(e.to) === ni || idx.get(e.from) === ni))
                place(ni, 0, 0);
        }
    }
    for (let i = 0; i < n; i++)
        if (band[i] < 0)
            place(i, 0, 0);
    const bands = Math.max(...band) + 1;
    const height = Array.from({ length: bands }, (_, b) => 1 + Math.max(0, ...sub.filter((_, i) => band[i] === b)));
    const base = height.map((_, b) => height.slice(0, b).reduce((t, h) => t + h, 0));
    const row = sub.map((r, i) => base[band[i]] + r);
    const cols = Math.max(...col) + 1;
    const rows = Math.max(...row) + 1;
    if (spec.layout === 'down') {
        // the same picture turned: the spine runs top to bottom, side parts to its right
        const W = Math.max(520, rows * PITCH_X + 2 * PAD);
        const left = (W - rows * PITCH_X) / 2;
        const pos = spec.nodes.map((_, i) => ({ x: left + (row[i] + 0.5) * PITCH_X, y: TITLE_H + 50 + col[i] * pitchY }));
        return { pos, order, W, H: TITLE_H + 50 + (cols - 1) * pitchY + 80 + capH };
    }
    const W = Math.max(520, cols * PITCH_X + 2 * PAD);
    const left = (W - cols * PITCH_X) / 2;
    const pos = spec.nodes.map((_, i) => ({ x: left + (col[i] + 0.5) * PITCH_X, y: TITLE_H + pitchY / 2 + row[i] * pitchY }));
    return { pos, order, W, H: TITLE_H + rows * pitchY + 10 + capH };
}
function textLines(lines, y0, size, fill, extra = '') {
    return lines
        .map((l, i) => `<text x="0" y="${f(y0 + i * (size + 4))}" text-anchor="middle" font-size="${size}" fill="${fill}" ${extra}>${esc(l)}</text>`)
        .join('');
}
function fade(begin, dur = 0.35) {
    return `<animate attributeName="opacity" from="0" to="1" begin="${f(begin)}s" dur="${dur}s" fill="freeze"/>`;
}
function drawIn(d, begin, dur, attrs) {
    return `<path d="${d}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" fill="none" ${attrs}><animate attributeName="stroke-dashoffset" from="1" to="0" begin="${f(begin)}s" dur="${f(dur)}s" fill="freeze"/></path>`;
}
const RED = '#e5383b';
// Static (settled) form of a scene: everything already drawn, no animation.
function staticize(svg) {
    return svg
        .replace(/<animate [^>]*\/>/g, '')
        .replace(/opacity="0" transform="translate\(3 3\)"/g, 'opacity="0.75" transform="translate(3 3)"')
        .replace(/ opacity="0"/g, '')
        .replace(/stroke-dashoffset="1"/g, 'stroke-dashoffset="0"');
}
// A curved connector between two boxes ({ x, y, hw, hh }), clipped to their outlines; returns the path and its arrow head.
function link(A, B, bend, jitter) {
    const dx = B.x - A.x;
    const dy = B.y - A.y;
    const len = Math.hypot(dx, dy) || 1;
    const sA = Math.min(A.hw / Math.abs(dx || 1e-6), A.hh / Math.abs(dy || 1e-6), 0.5);
    const sB = Math.min(B.hw / Math.abs(dx || 1e-6), B.hh / Math.abs(dy || 1e-6), 0.5);
    const s = { x: A.x + dx * sA, y: A.y + dy * sA };
    const t = { x: B.x - dx * sB, y: B.y - dy * sB };
    const bd = bend * len;
    const c = { x: (s.x + t.x) / 2 - (dy / len) * bd + (jitter() - 0.5) * 6, y: (s.y + t.y) / 2 + (dx / len) * bd + (jitter() - 0.5) * 6 };
    const tx = t.x - c.x;
    const ty = t.y - c.y;
    const tl = Math.hypot(tx, ty) || 1;
    const ux = -tx / tl;
    const uy = -ty / tl;
    const hp = (ang) => {
        const cs = Math.cos(ang);
        const sn = Math.sin(ang);
        return `${f(t.x + (ux * cs - uy * sn) * 12)} ${f(t.y + (ux * sn + uy * cs) * 12)}`;
    };
    return {
        d: `M${f(s.x)} ${f(s.y)} Q${f(c.x)} ${f(c.y)} ${f(t.x)} ${f(t.y)}`,
        head: `M${hp(0.5)} L${f(t.x)} ${f(t.y)} L${hp(-0.5)}`,
        mid: { x: 0.25 * s.x + 0.5 * c.x + 0.25 * t.x, y: 0.25 * s.y + 0.5 * c.y + 0.25 * t.y },
    };
}
// The box a reader added with "+ Add box", in scene coordinates.
export function addedBox(m, W, H) {
    const lines = wrap(m.text || '', 14, 2);
    const w = Math.max(96, Math.max(...lines.map(x => x.length)) * 8.6 + 26);
    const h = lines.length * 19 + 22;
    return { id: m.id, label: m.text, x: (m.x ?? 0.5) * W, y: (m.y ?? 0.5) * H, hw: w / 2 + 4, hh: h / 2 + 4, w, h, lines };
}
// What the person drew on this scene, in red marker over the doodle. Only the newest mark animates.
function marksLayer(geo, marks, fresh) {
    const rng = mulberry32(7);
    const pen = (d, isFresh, w) => isFresh
        ? drawIn(d, 0, 0.5, `stroke="${RED}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`)
        : `<path d="${d}" fill="none" stroke="${RED}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
    const out = [];
    const added = new Map(marks.filter(m => m.kind === 'add' && m.id).map(m => [m.id, addedBox(m, geo.W, geo.H)]));
    const boxOf = (id) => {
        const i = geo.idx.get(id);
        if (i !== undefined)
            return { x: geo.pos[i].x, y: geo.pos[i].y, hw: geo.drawn[i].hw, hh: geo.drawn[i].hh };
        return added.get(id);
    };
    marks.forEach((m, k) => {
        const isFresh = k === fresh;
        if (m.kind === 'free') {
            if (m.pts && m.pts.length >= 4)
                out.push(pen(strokePath(m.pts, geo.W, geo.H), isFresh, 3));
            return;
        }
        if (m.kind === 'add' && m.text) {
            // a proposed new part: a dashed green box where the person clicked
            const GREEN = '#2a9d8f';
            const { lines, w, h, x, y } = addedBox(m, geo.W, geo.H);
            const box = [rl(-w / 2, -h / 2, w / 2, -h / 2, rng), rl(w / 2, -h / 2, w / 2, h / 2, rng), rl(w / 2, h / 2, -w / 2, h / 2, rng), rl(-w / 2, h / 2, -w / 2, -h / 2, rng)].join(' ');
            out.push(`<g transform="translate(${f(x)} ${f(y)})"><path d="M${f(-w / 2)} ${f(-h / 2)} H${f(w / 2)} V${f(h / 2)} H${f(-w / 2)} Z" fill="#d8f3ee" opacity="0.85"/><path d="${box}" fill="none" stroke="${GREEN}" stroke-width="2.6" stroke-dasharray="7 5" stroke-linecap="round"/><text x="${f(-w / 2 + 4)}" y="${f(-h / 2 - 6)}" font-size="12" font-weight="bold" fill="${GREEN}">NEW</text>${lines
                .map((t, i) => `<text x="0" y="${f(-((lines.length - 1) * 9.5) + 5 + i * 19)}" text-anchor="middle" font-size="15" font-weight="bold" fill="${GREEN}">${esc(t)}</text>`)
                .join('')}</g>`);
            return;
        }
        const box = boxOf(m.a);
        if (!box)
            return;
        const P = box;
        const dr = box;
        if (m.kind === 'cross' && m.b !== undefined) {
            // an arrow crossed out: an X on the middle of that connection
            const other = boxOf(m.b);
            if (!other)
                return;
            const mid = link(box, other, geo.bend, () => 0.5).mid;
            out.push(pen(rl(mid.x - 13, mid.y - 13, mid.x + 13, mid.y + 13, rng, 2), isFresh, 4) + pen(rl(mid.x + 13, mid.y - 13, mid.x - 13, mid.y + 13, rng, 2), isFresh, 4));
            return;
        }
        if (m.kind === 'circle') {
            const b = blob(dr.hw + 10, dr.hh + 8, rng, { steps: 30, jitter: 0.03 });
            out.push(`<g transform="translate(${f(P.x)} ${f(P.y)})">${pen(b.d, isFresh, 3.4)}</g>`);
        }
        else if (m.kind === 'cross') {
            const x = (P.x - dr.hw - 4), y = (P.y - dr.hh - 4), X = (P.x + dr.hw + 4), Y = (P.y + dr.hh + 4);
            out.push(pen(rl(x, y, X, Y, rng, 3), isFresh, 4) + pen(rl(X, y, x, Y, rng, 3), isFresh, 4));
        }
        else if (m.kind === 'question') {
            out.push(`<g transform="translate(${f(P.x + dr.hw - 2)} ${f(P.y - dr.hh - 2)})"><circle r="15" fill="#fff" stroke="${RED}" stroke-width="2.4"/><text y="8" text-anchor="middle" font-size="22" font-weight="bold" fill="${RED}">?</text></g>`);
        }
        else if (m.kind === 'arrow') {
            const other = m.b === undefined ? undefined : boxOf(m.b);
            if (!other)
                return;
            const l = link(box, other, 0.3, rng);
            out.push(pen(l.d, isFresh, 3.2) + pen(l.head, false, 3.2));
        }
        else if (m.kind === 'note' && m.text) {
            const lines = wrap(m.text, 18, 3);
            const w = Math.max(...lines.map(x => x.length)) * 7.4 + 18;
            const h = lines.length * 15 + 14;
            const ny = P.y - dr.hh - h / 2 - 16 < 76 ? P.y + dr.hh + h / 2 + 30 : P.y - dr.hh - h / 2 - 16;
            out.push(`<g transform="translate(${f(P.x + dr.hw * 0.3)} ${f(ny)}) rotate(-3)"><rect x="${f(-w / 2)}" y="${f(-h / 2)}" width="${f(w)}" height="${f(h)}" rx="2" fill="#fff59d" stroke="#c9a400" stroke-width="1.4"/>${lines
                .map((x, i) => `<text x="${f(-w / 2 + 9)}" y="${f(-h / 2 + 18 + i * 15)}" font-size="12" fill="#7a1f1f">${esc(x)}</text>`)
                .join('')}</g>`);
        }
    });
    return out.join('');
}
export function renderScene(spec, o) {
    const rng = mulberry32(hash(JSON.stringify(spec)));
    const cap = spec.caption ? wrap(spec.caption, 76, 3) : [];
    const capH = cap.length ? 28 + cap.length * 19 : 22;
    const { pos, order, W, H } = layout(spec, capH);
    const idx = new Map(spec.nodes.map((nd, i) => [nd.id, i]));
    const rank = [];
    order.forEach((ni, r) => (rank[ni] = r));
    const T = (i) => 0.55 + rank[i] * 0.9;
    const drawn = spec.nodes.map(nd => outline(nd, rng));
    const parts = [];
    const pid = `dots${o.run}`;
    parts.push(`<defs><pattern id="${pid}" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="3" cy="3" r="1" fill="#e6dfca"/></pattern></defs>`);
    parts.push(`<rect width="${W}" height="${H}" rx="14" fill="${PAPER}"/><rect width="${W}" height="${H}" rx="14" fill="url(#${pid})"/>`);
    if (o.total > 1)
        parts.push(`<text x="18" y="26" font-size="12" fill="#9a8f7a">scene ${o.index + 1} of ${o.total}</text>`);
    // title with a pen underline
    const tw = Math.min(W - 60, spec.title.length * 13);
    parts.push(`<g opacity="0">${fade(0, 0.5)}<text x="${W / 2}" y="40" text-anchor="middle" font-size="24" font-weight="bold" fill="${INK}">${esc(spec.title)}</text></g>`);
    parts.push(drawIn(rl(W / 2 - tw / 2, 50, W / 2 + tw / 2, 51, rng, 2.5), 0.2, 0.5, `stroke="#d97757" stroke-width="3" stroke-linecap="round"`));
    const bend = spec.layout === 'cycle' ? 0.18 : 0.1;
    const geo = { pos, drawn, idx, W, H, bend };
    const boxAt = (i) => ({ x: pos[i].x, y: pos[i].y, hw: drawn[i].hw, hh: drawn[i].hh });
    // zones: dashed areas that say where parts live (browser, server, database...)
    (spec.zones || []).forEach((z, k) => {
        const ids = z.nodes.map(id => idx.get(id)).filter(i => i !== undefined);
        if (!ids.length)
            return;
        const x0 = Math.min(...ids.map(i => pos[i].x - drawn[i].hw)) - 16;
        const x1 = Math.max(...ids.map(i => pos[i].x + drawn[i].hw)) + 16;
        const y0 = Math.min(...ids.map(i => pos[i].y - drawn[i].hh)) - 26;
        const y1 = Math.max(...ids.map(i => pos[i].y + Math.max(drawn[i].hh, spec.nodes[i].note ? drawn[i].noteY + 8 : 0))) + 12;
        const tint = ['#f3ead7', '#e3eef6', '#e5f2e1', '#f6e3ea', '#efe6f7', '#e2f1f0', '#f7ecd9', '#e9edf2'][k % 8];
        const d = [rl(x0, y0, x1, y0, rng, 2), rl(x1, y0, x1, y1, rng, 2), rl(x1, y1, x0, y1, rng, 2), rl(x0, y1, x0, y0, rng, 2)].join(' ');
        parts.push(`<g opacity="0">${fade(0.3, 0.6)}<rect x="${f(x0)}" y="${f(y0)}" width="${f(x1 - x0)}" height="${f(y1 - y0)}" rx="16" fill="${tint}" opacity="0.6"/><path d="${d}" fill="none" stroke="#b9ae98" stroke-width="1.6" stroke-dasharray="6 6" stroke-linecap="round"/><text x="${f(x0 + 12)}" y="${f(y0 + 17)}" font-size="12.5" font-weight="bold" fill="#8a7f6a" letter-spacing="1">${esc(z.label.toUpperCase())}</text></g>`);
    });
    // edges (under the nodes)
    spec.edges.forEach(e => {
        const a = idx.get(e.from);
        const b = idx.get(e.to);
        const l = link(boxAt(a), boxAt(b), bend, rng);
        const forward = T(b) > T(a);
        const begin = forward ? Math.max(0.3, T(b) - 0.5) : T(a) + 0.8;
        parts.push(drawIn(l.d, begin, 0.5, `stroke="${INK}" stroke-width="2.4" stroke-linecap="round"`));
        parts.push(`<path d="${l.head}" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity="0">${fade(begin + 0.45, 0.15)}</path>`);
        if (e.label) {
            parts.push(`<text x="${f(l.mid.x)}" y="${f(l.mid.y - 8)}" text-anchor="middle" font-size="13" fill="#b0482a" stroke="${PAPER}" stroke-width="5" paint-order="stroke" stroke-linejoin="round" opacity="0">${fade(begin + 0.35)}${esc(e.label)}</text>`);
        }
    });
    // nodes
    spec.nodes.forEach((nd, i) => {
        const dr = drawn[i];
        const t0 = T(i);
        const fill = FILLS[rank[i] % FILLS.length];
        const second = outline(nd, mulberry32(hash(nd.id + i))).d;
        const noteLines = nd.note ? wrap(nd.note, 24, 2) : [];
        parts.push(`<g transform="translate(${f(pos[i].x)} ${f(pos[i].y)})">` +
            `<path d="${dr.fill}" fill="${fill}" opacity="0" transform="translate(3 3)">${fade(t0 + 0.4, 0.4).replace('to="1"', 'to="0.75"')}</path>` +
            drawIn(dr.d, t0, 0.7, `stroke="${INK}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"`) +
            drawIn(second, t0 + 0.1, 0.7, `stroke="${INK}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" opacity="0.55"`) +
            (spec.style === 'rich'
                ? `<g opacity="0">${fade(t0 + 0.3, 0.3)}<circle cx="${f(-dr.hw + 4)}" cy="${f(-dr.hh + 4)}" r="11" fill="#d97757" stroke="${INK}" stroke-width="1.6"/><text x="${f(-dr.hw + 4)}" y="${f(-dr.hh + 9)}" text-anchor="middle" font-size="13" font-weight="bold" fill="#fff">${rank[i] + 1}</text></g>`
                : '') +
            `<g opacity="0">${fade(t0 + 0.45)}${textLines(dr.label, dr.labelY, 15, INK, 'font-weight="bold"')}${noteLines.length ? textLines(noteLines, dr.noteY, 11.5, '#6b6258', 'font-style="italic"') : ''}${nd.zoom ? `<g transform="translate(${f(dr.hw - 2)} ${f(dr.labelY > 40 ? -dr.hh + 18 : dr.hh - 2)})"><title>A deeper story: ${esc(nd.zoom)}</title><circle r="10" fill="#fff" stroke="${INK}" stroke-width="1.6" stroke-dasharray="3 2"/><path d="M-4 0 H4 M0 -4 V4" stroke="${INK}" stroke-width="2" stroke-linecap="round"/></g>` : ''}</g>` +
            `</g>`);
    });
    if (spec.style === 'rich') {
        const end = T(order[order.length - 1]) + 1.2;
        const spark = (x, y, k, dly) => `<path transform="translate(${x} ${y}) scale(${k})" d="M0 -7 Q0 0 7 0 Q0 0 0 7 Q0 0 -7 0 Q0 0 0 -7Z" fill="#f0b429" stroke="${INK}" stroke-width="1" opacity="0">${fade(end + dly, 0.3)}</path>`;
        parts.push(spark(W - 28, 30, 1.6, 0) + spark(W - 52, 52, 0.9, 0.15) + spark(26, H - capH - 20, 1.2, 0.3) + spark(46, H - capH - 40, 0.7, 0.45));
    }
    // the narrator, storybook style, speaking as the scene starts
    if (cap.length) {
        parts.push(`<g transform="translate(${W / 2} ${H - capH + 26})" opacity="0">${fade(0.35, 0.6)}${textLines(cap, 0, 14, '#8a3b1f', 'font-style="italic"')}</g>`);
    }
    const body = o.animate ? parts.join('') : staticize(parts.join(''));
    const marks = marksLayer(geo, o.marks, o.fresh);
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">${body}${marks}</svg>`;
}
// A smooth path through normalized points [x0, y0, x1, y1, ...].
function strokePath(flat, W, H) {
    const p = [];
    for (let i = 0; i + 1 < flat.length; i += 2)
        p.push({ x: flat[i] * W, y: flat[i + 1] * H });
    if (p.length === 1)
        return `M${f(p[0].x)} ${f(p[0].y)} l0.1 0`;
    let d = `M${f(p[0].x)} ${f(p[0].y)}`;
    for (let i = 1; i < p.length - 1; i++) {
        d += ` Q${f(p[i].x)} ${f(p[i].y)} ${f((p[i].x + p[i + 1].x) / 2)} ${f((p[i].y + p[i + 1].y) / 2)}`;
    }
    const last = p[p.length - 1];
    return d + ` L${f(last.x)} ${f(last.y)}`;
}
// When each part and each connection appears in the animation, in seconds, so captions can follow the pen.
export function timeline(spec) {
    const cap = spec.caption ? wrap(spec.caption, 76, 3) : [];
    const capH = cap.length ? 28 + cap.length * 19 : 22;
    const { order } = layout(spec, capH);
    const rank = [];
    order.forEach((ni, r) => (rank[ni] = r));
    const idx = new Map(spec.nodes.map((nd, i) => [nd.id, i]));
    const T = (i) => 0.55 + rank[i] * 0.9;
    const nodes = spec.nodes.map((nd, i) => ({ id: nd.id, t: T(i) + 0.5 }));
    const edges = spec.edges.map(e => {
        const a = idx.get(e.from);
        const b = idx.get(e.to);
        const begin = T(b) > T(a) ? Math.max(0.3, T(b) - 0.5) : T(a) + 0.8;
        return { from: e.from, to: e.to, t: begin + 0.3 };
    });
    const end = Math.max(...nodes.map(n => n.t), ...edges.map(e => e.t), 0) + 0.6;
    return { nodes, edges, end };
}
// Where each node sits, as renderScene lays it out (same seed, same order of draws).
export function geometry(spec) {
    const rng = mulberry32(hash(JSON.stringify(spec)));
    const cap = spec.caption ? wrap(spec.caption, 76, 3) : [];
    const capH = cap.length ? 28 + cap.length * 19 : 22;
    const { pos, W, H } = layout(spec, capH);
    const drawn = spec.nodes.map(nd => outline(nd, rng));
    return { W, H, nodes: spec.nodes.map((nd, i) => ({ id: nd.id, label: nd.label, x: pos[i].x, y: pos[i].y, hw: drawn[i].hw, hh: drawn[i].hh })) };
}
// What a freehand stroke means: a loop around boxes, a line from one box to another, or a mark on/near one.
export function interpret(spec, flat, extra = []) {
    const g0 = geometry(spec);
    const g = { ...g0, nodes: [...g0.nodes, ...extra] };
    const P = [];
    for (let i = 0; i + 1 < flat.length; i += 2)
        P.push({ x: flat[i] * g.W, y: flat[i + 1] * g.H });
    if (!P.length)
        return { shape: 'mark', hits: [] };
    const reach = (n, p) => Math.max(0, Math.abs(p.x - n.x) - n.hw) + Math.max(0, Math.abs(p.y - n.y) - n.hh);
    const nearest = (p, limit = 60) => {
        let best;
        let bd = limit;
        for (const n of g.nodes) {
            const dd = reach(n, p);
            if (dd <= bd) {
                bd = dd;
                best = n;
            }
        }
        return best;
    };
    const xs = P.map(p => p.x);
    const ys = P.map(p => p.y);
    const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
    const first = P[0];
    const last = P[P.length - 1];
    const gap = Math.hypot(last.x - first.x, last.y - first.y);
    const centroid = { x: xs.reduce((a, b) => a + b, 0) / P.length, y: ys.reduce((a, b) => a + b, 0) / P.length };
    if (span > 40 && gap < span * 0.35 && P.length >= 6) {
        const inside = (q) => {
            let c = false;
            for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
                if (P[i].y > q.y !== P[j].y > q.y && q.x < ((P[j].x - P[i].x) * (q.y - P[i].y)) / (P[j].y - P[i].y || 1e-6) + P[i].x)
                    c = !c;
            }
            return c;
        };
        const hits = g.nodes.filter(n => inside(n)).map(n => n.id);
        if (hits.length)
            return { shape: 'loop', hits };
        const n = nearest(centroid, 80);
        return { shape: 'loop', hits: n ? [n.id] : [], empty: true };
    }
    if (span > 40) {
        const a = nearest(first);
        const b = nearest(last);
        if (a && b && a.id !== b.id)
            return { shape: 'line', hits: [a.id, b.id] };
    }
    const touched = [];
    for (const p of P) {
        for (const n of g.nodes)
            if (reach(n, p) < 8 && !touched.includes(n.id))
                touched.push(n.id);
    }
    if (touched.length)
        return { shape: 'mark', hits: touched };
    const n = nearest(centroid);
    return { shape: 'mark', hits: n ? [n.id] : [] };
}
