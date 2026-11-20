---
name: whiteboard
description: Draw a feature's system design as an interactive whiteboard page (architecture, flows, schema, APIs, UI wireframes, plan) that doubles as its spec. Use when the user asks to whiteboard, design or plan a feature visually, wants to see what you intend to build before you build it, or pastes "Whiteboard feedback".
---

# Whiteboard

A **whiteboard** is one self-contained HTML page that shows a developer what you plan to build: a column of **boards**, each answering one question about the feature. The reader skims it in two minutes, tags any part of it with a question or a change, and pastes those notes back to you. Once the notes run dry, the whiteboard is the spec.

The reader is a developer who knows the codebase and has not read your reasoning. Every board earns its place by letting them catch a wrong assumption before code exists.

You write only `board.html` (the hero and the boards). The kit in this skill's folder supplies the layout, the design system, themed diagrams and the notes layer; `scripts/build.py` inlines them into `index.html`.

- [`COMPONENTS.md`](COMPONENTS.md): the markup for every board part. Read it before writing `board.html`.
- [`DESIGN-SYSTEM.md`](DESIGN-SYSTEM.md): the tokens, and how to derive `theme.css` from the app's own design system. Read it at step 2.
- [`example/board.html`](example/board.html): a complete small whiteboard. Match its density and register.

## 1. Ground

Read the code the feature touches before drawing anything. The whiteboard is trusted because it names real things.

**Done when** every existing file, table, endpoint, permission and component you will name has been opened and confirmed, everything else is known to be new, and each thing you could not settle from the code is written down as an open question for the reader.

## 2. Place and theme

**Place.** Use the folder the project's instructions name for design pages. Otherwise create `../<repo-name>-whiteboards/<feature-slug>/`, beside the repo, so the working tree stays clean. Tell the user the path.

**Theme.** Look for the app's design system and write `theme.css` from it, following `DESIGN-SYSTEM.md`. With no app design system, write no `theme.css`: the kit defaults are the design.

**Done when** the folder exists and `theme.css` either carries the app's tokens or is deliberately absent.

## 3. Draw

Write `board.html`. Boards in this order, each included only when the feature has something to say there:

1. **Hero**: feature name, one sentence on what and why, a meta line (revision, date, status), and three to five key decisions as rows, each chipped `Decided`, `Proposed` or `Open`.
2. **Open questions**: each a `.question` with two to four options and one marked recommended. First board, because answers here change everything below.
3. **Scope**: what is in, what is out.
4. **System**: one flowchart of the parts, new ones marked `:::new`, existing ones `:::ext`.
5. **Flow**: a sequence or state diagram per behaviour, with its rules beside it.
6. **Data**: tables and fields, new or changed.
7. **Contracts**: endpoints, events, payload examples.
8. **Files**: a tree of where the change lands, new and changed files marked.
9. **UI**: wireframes of each new screen state, new parts outlined.
10. **Risks**: ranked, `Must handle` before `Noted`.
11. **Plan**: phases that each ship, each ending in an `.accept` line a reviewer can check.

Rules of the page:

- **Headline the conclusion.** Each `h2` states the board's answer ("One new table"), so the rail alone reads as a summary.
- **One question per diagram**, 14 nodes at most. Split a crowded diagram into two boards.
- **Tag what the reader will discuss.** Every board has an `id`; every card, diagram, table row, wireframe and phase worth a comment gets a short `data-tag`. The reader cites it as `#board.tag`.
- **Mark new against existing** everywhere: diagrams, file trees, wireframes.
- **State uncertainty as a question.** An unknown becomes a `.question`; a guess presented as fact costs the reader's trust in every other board.
- **Plan in checks, in the reader's units.** Phases carry acceptance lines. Add time estimates only when the user asks for them.
- **Colour through tokens.** Use the kit classes and `var(--token)` so both themes and the app theme apply; keep to the restraint rules in `DESIGN-SYSTEM.md` when adding any style of your own.
- **Keep the hero plain.** Title, one sentence on what and why, the meta line, and the key decisions as `dl.facts` rows. It orients a developer; it does not sell the feature.

**Done when** every claim on the page traces to step 1, and every board has an `id`, a conclusion headline and tags on its discussable parts.

## 4. Build and look

```bash
python3 ${CLAUDE_SKILL_DIR}/scripts/build.py <board-folder>
```

`${CLAUDE_SKILL_DIR}` is the folder holding this file; if your agent leaves it unexpanded, substitute that path.

Fix every `ERROR` and act on every `warn`, then open `index.html` and look at it: each diagram renders, nothing overflows its board, both themes read cleanly.

**Done when** the build prints `ok` with zero warnings you have not consciously accepted, and you have seen the page.

## 5. Hand over

Reply with the path to `index.html`, the open questions in one line each, and one sentence on how to respond: hover any part and press its tag (or press `N` and click), write the note, then "review & copy" and paste into the chat. Keep the reply short; the page carries the detail.

Publish the page to a URL only when the user asks, using the host they name, and confirm before the first publish of a board: a public URL exposes the design.

## 6. Revise

Triggered by a pasted `Whiteboard feedback:` block, or any message citing `#board.tag`.

Each note is `[kind] #ref: text`:

- `question`: answer it in the chat reply, then make the page answer it too, so the next reader does not ask again.
- `change`: apply it. If you disagree, apply nothing for that note and say why in the reply.
- `answer`: the reader chose an option. Turn the `.question` into a decision (`.q` in a Decisions board, or a hero card chipped `Decided`) and carry its consequences into every board it touches.
- `approve`: leave the unit alone in this and later revisions unless a later note reopens it.

Then bump `data-rev` on the hero, remove the previous revision's `data-changed` marks and `.changes` list, mark each unit you touched with `data-changed`, list the edits in a fresh `.changes` list, and rebuild.

**Done when** every note in the block has a matching edit or a stated reason, and the `.changes` list covers every `data-changed` mark.

## 7. Settle

When no open questions remain and the user calls the design settled, record it wherever the project keeps specs (follow the project's instructions; an issue tracker is the usual home): the decisions, scope, contracts and plan as text, with the whiteboard linked or attached. The whiteboard shows the design; the tracker is where the work is claimed.
