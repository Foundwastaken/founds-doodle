---
name: founds-doodle
description: Founds Doodle, a doodle way of learning. Explains a codebase, project, flow or idea as an animated, hand-drawn storybook the user can replay, draw on, take notes in, get quizzed on and use to propose code changes. Use when the user asks for a doodle, a story, a storybook, a visual walkthrough, a sketch or a "how does this work" picture, at any depth from a one-scene overview to a function-level deep dive. Also use when the user pastes a message starting with [doodle].
---

# Founds Doodle: a doodle way of learning

Turn "how does my code work?" into a short animated story the user can learn from with you. The story is a few scenes of hand-drawn boxes and arrows, each with one storybook narrator line. The bundled script draws it into a single HTML page, so no image model or API key is needed. On that page the user:

- plays the story and draws on it (pen, circle, arrow, "?", note, add box, cross out),
- keeps a notebook per scene: their own notes, plus "What we figured out", which you write,
- talks back to you with a copied message: **Ask**, **Check my understanding**, **Quiz me** or **Propose a change**,
- saves a copy with their drawings and notes, and browses a library of stories that link from overview to detail.

## 1. Pick the depth

Read it from the user's words. Default to `normal`.

| Level | They say | What to make |
| --- | --- | --- |
| 0. Elevator pitch | "in a nutshell", "ELI5", "one picture" | `simple`, 1 scene, 3-5 nodes |
| 1. Overview | "high level", "quick", "simple" | `simple`, 2 scenes: the big picture and the main flow |
| 2. Walkthrough | "explain", "walk me through" (default) | `normal`, 3-5 scenes |
| 3. Deep dive | "in depth", "detailed", "everything" | `rich`, 5-10 scenes, notes on most nodes |
| 4. Part story | "zoom into X", "go deeper on X" | a new story about X only, linked from its parent (see 6) |
| 5. Function level | "step by step", "line by line", "what exactly happens in f()" | `rich`, one scene per function or branch; nodes are the real steps, checks, data shapes and error paths |

Go wider with more stories rather than more boxes: one story holds up to 10 scenes of up to 12 nodes each, but the library can hold as many linked stories as the project needs. If they name an audience ("for a kid", "for a new hire"), match the narration voice to it.

## 2. Explore before you draw

Read only what the depth needs: the README and manifests, the entry points and the main folders, then follow one real path through the code (a request, a command, a job). Every label must be a real file, function or folder name. Never guess one.

## 3. Write the story JSON

Save stories in `.doodle/` at the project root. Ask once whether to commit it (a shared learning library for the team) or add it to `.gitignore`. The file name is the story `id`: `.doodle/overview.json` has `"id": "overview"`. The full format is in [references/story-format.md](references/story-format.md).

```json
{
  "id": "overview",
  "title": "The Tale of a Tiny Link",
  "style": "normal",
  "scenes": [
    {
      "title": "Meet the cast",
      "narration": "Snip turns long web addresses into tiny ones. Our hero is one long link about to become snip.dev/Ab3x9Qz.",
      "layout": "flow",
      "zones": [{ "label": "API server", "nodes": ["server"] }],
      "nodes": [
        { "id": "you", "label": "You", "shape": "person", "step": "You have a long link to share." },
        {
          "id": "server", "label": "src/server.ts", "shape": "server", "note": "the front desk", "zoom": "overview-server",
          "step": "The API server is the front desk: it makes short links and sends visitors on.",
          "details": "An Express app with two routes: POST /links and GET /:code.",
          "file": "src/server.ts",
          "code": "app.post('/links', createLink)
app.get('/:code', followLink)"
        }
      ],
      "edges": [{ "from": "you", "to": "server", "label": "POST /links" }],
      "points": ["Fast path: Redis. Source of truth: Postgres."],
      "notes": []
    }
  ]
}
```

Storytelling rules. A story is not a diagram with captions: it follows someone or something through the code.

- **Pick a hero** and follow it through every scene: one request, one file, one order, one job (for example "our hero is order #1042, placed at 9:14 on a Monday"). Each scene is the next leg of its journey.
- **Scene order** for a codebase: 1) meet the cast (the parts and where they live), 2) what starts the journey (a click, a schedule, a request), 3+) each leg in order, including what happens when things go wrong, then any after-work (reports, cleanup), last) where to start reading and the gotchas.
- `narration`: 1-2 storybook sentences that set the scene. Give parts personalities ("the queue is a single ticket counter") and keep everything true to the code.
- `step` on each node (and on edges that matter): one sentence, said as the pen reaches that part, that moves the hero along. Steps are the real story: read in order, they should explain the scene on their own.
- `details` (2-3 plain sentences: what it does and why it is built that way), `file` (real path) and `code` (a real excerpt of up to ~8 lines, copied from the file, never invented) on the parts a reader will click. In `simple` stories skip `code` and keep `details` short.
- `zones` group parts by where they live ("Browser", "Server", "Database"). Keep each zone's parts next to each other.
- `points`: 1-3 "Remember" lines per scene: the rule, the gotcha or the design decision worth keeping.
- **Layout:** a straight path of up to 6 parts is laid out automatically. For a scene that branches (decisions with a reject path, a fan-out, a loop back), give every node `col` and `row` (0-based grid): main path on row 0, left to right; side exits and dead ends on row 1 under the step they leave from; loops come back along row 1. Prefer wide and short (up to 6 columns) over tall.
- Labels up to 20 characters (real file, function or folder names); ids unique within a scene and reused for the same part across scenes; every node has at least one edge.
- `shape`: `box`, `round` (idea or state), `diamond` (decision), `db` (storage), `person` (user or actor), `cloud` (external service), `note`, `server`, `laptop`, `bulb` (idea), `lock` (security or a hard stop), `doc` (file or data), `star` (goal or happy ending), `gear` (process or engine). Pictures help: use them.
- Edge labels are short verbs or outcomes, up to 14 characters. Plain ASCII, no emojis.
- Leave `notes` empty on a new story: they record what the user and you settle later.

**Before you draw, check:** Does every scene move the hero? Read only the `step` lines: do they tell the story without the picture? Is every label, path and code line real? Does a `simple` story stay at 1-2 scenes with no code? Does each branching scene have a grid?

**A word the user may not know** (a "What is X?" request, or the Explain a term message): make a small concept story with `"kind": "concept"`, `"term": "X"` and `"up": "<the story it came from>"`, saved as `<that id>-<x>.json`. 1-2 scenes explain X from zero with an everyday comparison, and a last scene "How X fits in our story" uses the real parts from the scene it came up in. The parent page then links to it.

## 4. Draw it

```bash
node <this skill's folder>/scripts/doodle.mjs .doodle/<id>.json --open
```

This builds `.doodle/<id>.html`, rebuilds every other story in `.doodle/` and its `index.html` library, then opens the story. It needs Node 18 or newer and nothing else. If it warns that it dropped scenes or edges, fix the JSON and run it again. If no browser can be opened (a remote or sandboxed session), give the user the path instead.

Then reply in one or two sentences: where the page is, and that they can play it, draw on it, and use the Talk panel to ask, check their understanding, get quizzed or propose a change. Do not retell the story in chat.

## 5. Learn together: answering a `[doodle]` message

The user pastes a message that starts with `[doodle]`. It names the story, the scene, what they drew (circles, loops, lines, arrows, "?" marks, notes, new boxes, crossed-out boxes) and the JSON file it came from. Treat each mark as a precise pointer to the named parts. Then act on its mode:

- **Ask**: answer in plain words, reading the code where needed.
- **Check my understanding**: say what is right first, then correct what is wrong (quote the code that shows it), then add the one thing they missed. Be warm and specific; it is fine to say "you're right and I was wrong" if their reading beats the story. Fix the story too in that case.
- **Quiz me**: ask 3 short questions, one at a time, and wait for each answer. Mix "what happens next", "why is it built this way" and "draw the path of X on the doodle, then paste it back". Say what they got right and wrong.
- **Propose a change**: read their drawing as a design change: a crossed-out part goes away, a NEW box is something to add, arrows and lines are connections to add or reroute. Check it against the code, then lay out what it would really take (files, risks, what they missed) and **wait for their OK before editing any code**. After the change, update the story to the new flow and add a note saying what changed and why.

**Record what you settle.** When the two of you agree on something, add a short line (under 280 characters) to that scene's `notes` in the story JSON, then rebuild with the script. That is the user's review sheet: it shows under "What we figured out" for that scene. Correct the scene itself (labels, edges, narration) if the talk showed it was wrong.

## 6. Zoom in and the library

For "Zoom in please" on a part, make a new story `.doodle/<parent-id>-<part>.json` with `"up": "<parent-id>"`, set `"zoom": "<new id>"` on that node in the parent story, and rebuild. The parent then shows a ⊕ badge on that box, its page offers "Open deeper story", and `index.html` nests the new story under its parent. Build `node <skill>/scripts/doodle.mjs .doodle --open` to open the library itself.

## If Node is not available

Tell the story as numbered scenes in chat instead: the narration line, then a small Mermaid `flowchart` per scene. Keep the learning loop (ask, check, quiz, change) the same.
