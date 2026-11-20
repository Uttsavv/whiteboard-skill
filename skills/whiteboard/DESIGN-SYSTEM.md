# Whiteboard design system

The kit is built for reading: one accent, neutral surfaces, a dot-grid ground, system fonts, 15px body at 1.6 line height, lines capped at 72 characters. Everything visual is a token, so a board takes on an app's identity by overriding tokens in `theme.css` and nothing else.

## Restraint

The page is a working document for developers, so decoration that carries no information stays off it:

- Flat fills only: no gradients on backgrounds, text, buttons or borders.
- Emphasis through a full 1px border, a tint fill or a chip. Coloured stripes down one edge of a card, callout or row are left out.
- No glows, coloured shadows, glassmorphism or emoji icons. Shadows only on things that float (the notes dock and panel).
- One accent, and never violet, purple or lavender (hue 255° to 330°): not as accent, tint, ground or diagram colour. It is the colour every generated page reaches for.
- Status colours mean status and nothing else.

The exception is the app's own design system: if it uses any of these, `theme.css` carries them, because wireframes should look like the app. The build enforces these rules on `board.html` and on any `theme.css` without a `/* derived from <file> */` header, so an app-derived theme is the only way in. The dot grid on the ground is the one texture the kit keeps; it is what makes the page read as a whiteboard.

## Tokens

| Token | Role | Light default | Dark default |
|---|---|---|---|
| `--ground` | page behind the boards | `#f5f6f8` | `#131419` |
| `--dot` | dot grid on the ground | `#dcdfe6` | `#23252e` |
| `--board` | board and card surface | `#ffffff` | `#1b1d24` |
| `--ink` | primary text | `#171a21` | `#eceef3` |
| `--soft` | secondary text, diagram lines | `#5a6172` | `#a1a7b6` |
| `--line` | borders | `#e2e5eb` | `#2d3039` |
| `--accent` | the one brand colour: fills, focus, "new" | `#1f6feb` | `#4c9cf5` |
| `--accent-tint` | accent background | `#e9f2fe` | `#13253a` |
| `--accent-ink` | accent-coloured text on board or tint | `#1458c2` | `#8cc2fa` |
| `--ok` / `--ok-tint` | decided, new file, acceptance | `#18794e` / `#e4f5ec` | `#5fd39a` / `#16301f` |
| `--warn` / `--warn-tint` | open, changed | `#955800` / `#fdf1dc` | `#f0b061` / `#3a2a14` |
| `--bad` / `--bad-tint` | rejected, risk | `#b3261e` / `#fde8e6` | `#ff8a84` / `#3b1c1c` |
| `--code-bg` | code, table heads, diagram nodes | `#f5f6f9` | `#16181e` |
| `--sans`, `--mono` | font stacks | system UI | system mono |
| `--radius`, `--radius-sm` | board corners, inner corners | `16px`, `10px` | same |

Write token colours as hex: the diagrams read them directly.

## Deriving `theme.css` from the app

The goal is that wireframes look native to the app and the page still reads as a whiteboard. Take the app's **identity** (accent, fonts, corner radius, status colours); keep the kit's **neutrals** unless the app's own are clearly defined for both themes.

Where to look, in order, stopping at the first that yields an accent colour and a font:

1. A design-system doc the project instructions point at (`DESIGN.md`, a tokens README).
2. Global CSS custom properties: `:root { --primary … }` in `globals.css`, `app.css`, `index.css`, `theme.css`.
3. Tailwind: `@theme` blocks in CSS (v4) or `theme.extend` in `tailwind.config.*`.
4. A tokens module: `tokens.ts`, `theme.ts`, `colors.ts`, a `design-tokens` JSON, a component library's theme provider.
5. Native apps: the colour and typography theme file (`Color.kt`, `Theme.swift`, `colors.xml`).

Mapping:

- App primary / brand colour → `--accent`. Derive `--accent-tint` as that hue at roughly 8% over the board, and `--accent-ink` as a shade that reads on both `--board` and `--accent-tint`.
- App font family → `--sans` (keep the system stack as fallback); app code font → `--mono`. If the font is hosted, put its `@import` on the first line of `theme.css`; the build hoists it.
- App radius scale → `--radius` (its card radius) and `--radius-sm` (its input radius).
- App success / warning / danger → `--ok`, `--warn`, `--bad` and their tints.
- Convert `oklch()`, `hsl()` and channel-only values (`222 47% 11%`) to hex.

Write both themes. When the app has a single theme, derive the other: keep the hue, lighten the accent for dark (or deepen it for light).

```css
/* theme.css — derived from web/src/styles/globals.css */
@import url("https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap");
:root{
  --accent:#6a3df0; --accent-tint:#efeafe; --accent-ink:#4b22c9;
  --sans:"Plus Jakarta Sans",ui-sans-serif,system-ui,sans-serif;
  --radius:18px;
}
:root[data-theme="dark"]{
  --accent:#9a7bff; --accent-tint:#2a2346; --accent-ink:#c4b2ff;
}
```

Head the file with `/* derived from <path> */` naming the source file. The next revision re-derives from it, and the build reads it as proof the colours are the app's own.

**Done when** `--accent-ink` on `--board`, `--accent-ink` on `--accent-tint`, `--board` on `--accent` (button text) and `--soft` on `--board` each reach 4.5:1 contrast in both themes. Adjust the derived shade, never the app's brand colour, until they do.
