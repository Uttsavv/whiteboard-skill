# whiteboard

An agent skill that draws a feature's system design as an interactive whiteboard page before any code is written: architecture, flows, schema, APIs, UI wireframes and plan on one page that doubles as the spec.

Developers read it in a couple of minutes, tag any part with a question or a change, and paste the notes back to the agent, which revises the page.

## How it works

1. The agent reads the code the feature touches and writes `board.html`: a hero plus a column of boards.
2. If the app has a design system, the agent derives a `theme.css` from it so wireframes look native. Otherwise the built-in design system applies.
3. `scripts/build.py` checks the board and inlines the kit into a single `index.html` with no build step or server.
4. On the page: hover anything and press its tag, or press `N` and click, to leave a question, a change or an approval. Open questions are answered by clicking an option. "review & copy" puts every note on the clipboard as text for the agent.
5. The agent applies the notes, bumps the revision and marks what changed.

## Layout

```
skills/whiteboard/
├─ SKILL.md            the process the agent follows
├─ COMPONENTS.md       markup for every board part
├─ DESIGN-SYSTEM.md    tokens, and how to theme from an app
├─ kit/                board.css, board.js, shell.html (inlined into every board)
├─ scripts/build.py    board.html (+ theme.css) -> index.html, with checks
└─ example/            a complete small whiteboard
```

## Install

In Claude Code:

```
/plugin marketplace add Uttsavv/whiteboard-skill
/plugin install whiteboard@whiteboard-skill
```

Update later with `/plugin marketplace update whiteboard-skill`.

Any other agent (Codex, Cursor, …), via the [skills CLI](https://skills.sh):

```bash
npx skills add Uttsavv/whiteboard-skill
```

Then ask for it: "whiteboard the saved-filters feature".

## Try the example

```bash
python3 skills/whiteboard/scripts/build.py skills/whiteboard/example
open skills/whiteboard/example/index.html
```

Requires Python 3.8+. Diagrams load Mermaid from a CDN; everything else is inline.
