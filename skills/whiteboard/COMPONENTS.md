# Whiteboard components

`board.html` holds one `<header class="board hero">` followed by `<section class="board">` elements. The build supplies `<html>`, the rail, numbering, theming and notes. Every class below is defined in `kit/board.css`; [`example/board.html`](example/board.html) shows each one in use.

## Tags

A reader cites any part of the page as `#<board id>.<data-tag>`.

- Board `id`: lowercase-kebab, short, stable across revisions (`flow`, `data`, `api`).
- `data-tag`: lowercase-kebab, unique within its board, named for the thing (`eligibility-rules`, `phase-2`), so it still fits after a reorder.
- Untagged cards, rows, list items and diagram nodes are still taggable; the note then quotes their text. Tag whatever you expect discussion on, so the reference survives rewording.

## Hero

```html
<header class="board hero" data-rev="1" data-date="2026-11-20">
  <h1>Feature name</h1>
  <p>What it is and why, in one sentence.</p>
  <div class="meta"><span>rev 1 · 2026-11-20</span><span class="chip accent">Draft</span><span class="chip warn">2 open questions</span></div>
  <ul class="changes"><li><a href="#data">Data</a>: what changed.</li></ul>   <!-- rev 2 onward -->
  <dl class="facts">
    <div data-tag="storage"><dt>Storage</dt><dd>The choice<span class="muted">why, in a few words</span></dd><dd class="st"><span class="chip ok">Decided</span></dd></div>
  </dl>
</header>
```

Keep it to that. No eyebrow, tagline, hero cards or illustration: the hero orients a developer in five seconds and the boards carry the substance.

Status chips: `chip ok` Decided, `chip accent` Proposed, `chip warn` Open, `chip bad` Rejected or Out.

## Board

```html
<section class="board" id="flow" data-nav="Flow">
  <div class="board-head">
    <span class="eyebrow">Runtime flow</span>      <!-- numbered automatically -->
    <h2>The board's conclusion as a sentence</h2>
    <p class="muted">One or two lines of context.</p>
  </div>
  ...
</section>
```

`data-nav` is the one- or two-word rail label. Layout inside a board: `grid g2`, `grid g3`, `grid g4` (auto-fitting columns), `card`, `chips`, `ul.clean`.

## Open question

```html
<div class="question" data-tag="pin-limit">
  <h3>The question, answerable by picking an option?</h3>
  <p class="muted">The fact that makes it a real trade-off.</p>
  <div class="options">
    <button type="button" class="opt" data-rec>Option A <small>Its consequence.</small></button>
    <button type="button" class="opt">Option B <small>Its consequence.</small></button>
  </div>
</div>
```

Clicking an option records an `answer` note. `data-rec` marks your recommendation; give one per question. A settled decision is `<p class="q" data-tag="…"><b>Topic.</b> What was decided.</p>`.

## Diagrams

```html
<div class="diagram" data-tag="map">
  <pre class="mermaid">
flowchart LR
  A["Existing page"]:::ext --> B["New tabs"]:::new
  B --> C[("new_table")]:::new
  </pre>
  <div class="legend"><span><i class="new"></i>New in this feature</span><span><i class="ext"></i>Exists today</span></div>
</div>
```

- Mermaid `flowchart`, `sequenceDiagram` (use `autonumber`, so readers can cite step numbers) and `stateDiagram-v2`. The kit themes them from the tokens and redraws on theme change.
- Flowchart classes supplied by the kit: `:::new`, `:::ext`, `:::risk`. Add the matching `.legend`.
- Quote every label (`A["text"]`); unquoted punctuation breaks the parse.
- Each diagram node, actor and message is individually taggable by the reader.

## Tables, code, trees

```html
<div class="tbl"><table>
  <thead><tr><th>Method · path</th><th>Who</th><th>Does</th></tr></thead>
  <tbody><tr data-tag="create"><td><code>POST /things</code></td><td>owner</td><td>…</td></tr></tbody>
</table></div>

<pre class="code"><span class="c">// comment</span> <span class="k">keyword</span> <span class="s">"string"</span></pre>

<pre class="tree" data-tag="backend">app/
├─ <span class="new">new_file.py</span>      what it holds
└─ <span class="chg">changed_file.py</span>  what changes</pre>
```

Escape `&`, `<`, `>` inside `pre`. `.new` green, `.chg` amber, `.del` struck through.

## Wireframes

```html
<figure class="mock" data-tag="list-desktop">
  <div class="desk">
    <div class="desk-top"><i></i><i></i><i></i><span>app / page</span></div>
    <div class="desk-body">
      <div class="m-side"><span>Home</span><span class="on">Leads</span></div>
      <div class="m-main">
        <div class="m-row m-new" data-tag="tab-row"><span class="m-pill">All</span><span class="m-btn">Selected</span></div>
        <div class="m-row m-col"><span class="sk"></span><span class="sk"></span></div>
      </div>
    </div>
  </div>
  <figcaption>What state this shows.</figcaption>
</figure>
```

Phone frame: `<div class="phone"><div class="screen"> <div class="m-bar">Title</div> … </div></div>`; put several in a `.mock-row`. Parts: `m-row` (add `m-col` to stack), `sk` skeleton line, `m-btn` (`ghost`), `m-pill`, `sp` spacer, `m-new` outlines what the feature adds. Real labels on the new parts, skeletons for everything unchanged. For a part the kit lacks, add a small scoped `<style>` in `board.html` built from tokens.

## Numbered layers, plan phases, depth

```html
<div class="layer"><span class="n">1</span><div><h3>Name</h3><p class="muted">What it does.</p></div></div>

<div class="phase" data-tag="phase-1">
  <div><span class="chip accent">Phase 1</span></div>
  <div><h3>What ships</h3>
    <ul class="clean"><li>Work item.</li></ul>
    <p class="accept">The observable check that proves this phase is done.</p></div>
</div>

<details class="more"><summary>Full field list</summary> … </details>
```

`details.more` holds reference detail a first read can skip.

## Revision marks

`data-changed` on any unit draws an amber edge and puts a dot on that board in the rail. Pair every mark with a line in the hero's `.changes` list.
