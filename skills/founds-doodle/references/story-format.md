# Story format

One JSON object. The script (`scripts/doodle.mjs`) validates it, drops what it cannot draw, and prints a warning for each drop.

```jsonc
{
  "id": "file-name-safe id",                // optional; defaults to the JSON file's name
  "up": "id of the parent story",           // optional; set on zoomed-in and concept stories
  "kind": "concept",                        // optional; a "What is X?" explainer
  "term": "API",                            // with kind: the word it explains
  "title": "string, up to 44 chars",
  "style": "simple | normal | rich",        // optional, default "normal"
  "scenes": [                               // as many as the story needs (safety limit 60)
    {
      "title": "string",
      "narration": "1-2 storybook sentences", // optional, shown under the scene
      "layout": "flow | down | cycle",        // optional, default "flow"
      "nodes": [                              // at least 2 (safety limit 40; past ~10, split the scene)
        {
          "id": "unique within this scene",
          "label": "up to 20 chars (longer is cut)",
          "shape": "box | round | diamond | db | person | cloud | note | server | laptop | bulb | lock | doc | star | gear",
          "note": "optional small caption under the part",
          "zoom": "optional id of a deeper story about this part",
          "step": "one sentence said as the pen reaches this part (up to 160 chars)",
          "details": "2-3 plain sentences shown when the part is clicked (up to 700)",
          "file": "real path(s) for this part",
          "code": "a real excerpt, up to 30 lines (keep it short)",
          "col": 0, "row": 0                    // optional grid position: give it to every node or to none
        }
      ],
      "edges": [
        { "from": "node id", "to": "node id", "label": "optional verb, up to 14 chars", "step": "optional caption" }
      ],
      "zones": [{ "label": "Server", "nodes": ["node id"] }],   // up to 8 dashed areas
      "points": ["1-3 Remember lines shown after the scene"],
      "quiz": [                               // 2-3 "why" questions for the end-of-story quiz
        { "q": "Why does Snip ask Redis first?", "choices": ["It answers from memory", "Postgres is read-only", "Redis makes the codes"], "answer": 0, "why": "Redis is a fast copy; Postgres is the source of truth." }
      ],
      "notes": ["what the user and the agent settled, one short line each (up to 12)"]
    }
  ]
}
```

A single scene can also be given on its own (an object with `nodes` and `edges` and no `scenes`).

## The library

`node scripts/doodle.mjs <story.json>` rebuilds every story in the same folder and writes `index.html`, which lists them with deeper stories nested under the story they zoom in from (by `up`, or by a node's `zoom`). `node scripts/doodle.mjs <folder>` rebuilds the folder without picking one story.

The reader's drawings and own notes live in their browser, keyed by the story `id`, so rebuilding a story keeps them. **Save my copy** downloads a single HTML file with them baked in.

## How it is drawn

- **flow**: the longest path through the scene runs along one row; a long one folds back and forth like a snake (6 per row). Side exits, dead ends and extra starters sit just below the step they belong to.
- **grid**: when every node has `col` and `row`, they are placed exactly there, and drawn in the order listed. Use it for scenes that branch.
- **down**: the same layers, top to bottom.
- **cycle**: nodes on a ring, in the order given.
- Nodes appear one by one in story order (layer, then position in the list), each edge drawing itself in just before the node it points to.
- `rich` adds numbered step badges and a few sparkles.
- The **quiz** (★ Quiz, at the end of the story) mixes the scene's `quiz` questions with questions made from the drawing: which part does this, what comes next, put the steps in order, name the hidden part. Every answer is a tap; nothing is typed.
- Each node's and edge's `step` appears under the drawing, numbered, as the pen reaches that part; `points` appear last in a Remember box. Clicking a part opens its `details`, `file` and `code`.

## Tips for good stories

- Keep 4-7 nodes per scene even in `rich`; split a crowded scene in two.
- Put the actor (`person`) first in a flow so the story reads left to right.
- Use `diamond` for real branches in the code (`if`, validation, auth checks) and label both edges ("yes" / "no").
- Use the same node ids for the same part across scenes; it keeps your follow-up answers consistent.
