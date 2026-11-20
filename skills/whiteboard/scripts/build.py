#!/usr/bin/env python3
"""Build a whiteboard: <dir>/board.html (+ optional <dir>/theme.css) -> <dir>/index.html.

Inlines the kit so the result is one self-contained file, and checks the board
against the rules the notes layer and the rail depend on. Standard library only.

    python3 build.py path/to/board-folder
"""
import re
import sys
from html.parser import HTMLParser
from pathlib import Path

KIT = Path(__file__).resolve().parent.parent / "kit"
MERMAID = '<script src="https://cdn.jsdelivr.net/npm/mermaid@11.4.1/dist/mermaid.min.js"></script>'
VOID = {"area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"}
PLACEHOLDER = re.compile(r"\b(TODO|TBD|lorem ipsum|xxx+)\b", re.I)
MAX_NODES = 14


# Taste rules from DESIGN-SYSTEM.md "Restraint". Applied to board.html, and to theme.css
# unless it is derived from the app's design system (a "derived from <file>" header).
VIOLET_NAMES = re.compile(r"(?<![\w-])(purple|violet|indigo|lavender|orchid|plum|magenta|fuchsia|blueviolet|mediumpurple|rebeccapurple)(?![\w-])", re.I)
GRADIENT = re.compile(r"(?:repeating-)?(?:linear|radial|conic)-gradient\(", re.I)
STRIPE = re.compile(r"border-(?:left|inline-start)(?:-width)?\s*:\s*[2-9]px|box-shadow\s*:\s*inset\s+[2-9]px\s+0", re.I)
HEX = re.compile(r"#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b")
RGB = re.compile(r"rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)")


def is_violet(r, g, b):
    import colorsys
    h, l, sat = colorsys.rgb_to_hls(r / 255, g / 255, b / 255)
    return 255 <= h * 360 <= 330 and sat >= 0.2 and 0.08 < l < 0.96


def taste(text, where):
    found = []
    css = re.sub(r"<pre class=\"(?:code|tree)\".*?</pre>", "", text, flags=re.S)  # code samples may show anything
    css = re.sub(r"(?s)>[^<]*<", "><", css) if where.endswith(".html") else css     # attributes and tags only, not prose
    for m in HEX.finditer(css):
        v = m.group(1)
        v = "".join(c * 2 for c in v) if len(v) == 3 else v
        if is_violet(*(int(v[i:i + 2], 16) for i in (0, 2, 4))):
            found.append(f"{where}: violet colour #{m.group(1)}; pick a non-violet accent (DESIGN-SYSTEM.md, Restraint)")
    for m in RGB.finditer(css):
        if is_violet(*map(int, m.groups())):
            found.append(f"{where}: violet colour {m.group(0)})")
    for m in VIOLET_NAMES.finditer(re.sub(r"(?s)/\*.*?\*/", "", css)):
        found.append(f"{where}: violet colour name \"{m.group(1)}\"")
    if GRADIENT.search(css):
        found.append(f"{where}: gradient; use flat fills (DESIGN-SYSTEM.md, Restraint)")
    if STRIPE.search(css):
        found.append(f"{where}: coloured stripe on one edge; use a full 1px border, a tint or a chip")
    return found


class Check(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.errors, self.warnings = [], []
        self.stack = []            # open tags
        self.board = None          # (id, depth) of the open board
        self.ids, self.tags = set(), {}
        self.h1 = ""
        self.rev = None
        self.grab = None           # collecting text for: 'h1' | 'mermaid'
        self.buf = []
        self.boards = 0
        self.questions = 0

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        cls = (a.get("class") or "").split()
        if tag not in VOID:
            self.stack.append(tag)
        if tag in ("section", "header") and "board" in cls:
            bid = a.get("id") or ("top" if tag == "header" else None)
            if tag == "header":
                self.rev = a.get("data-rev")
            else:
                self.boards += 1
                if not bid:
                    self.errors.append(f"board {self.boards}: <section class=\"board\"> needs an id (the tag readers cite)")
                elif not re.fullmatch(r"[a-z][a-z0-9-]*", bid):
                    self.errors.append(f"board id \"{bid}\": use lowercase-kebab, it is typed into chat")
                elif bid in self.ids:
                    self.errors.append(f"board id \"{bid}\" is used twice")
                self.ids.add(bid)
            self.board = (bid or f"board-{self.boards}", len(self.stack))
        if "data-tag" in a:
            key = (self.board[0] if self.board else "top", a["data-tag"])
            if not re.fullmatch(r"[a-z0-9][a-z0-9-]*", a["data-tag"] or ""):
                self.errors.append(f"data-tag \"{a['data-tag']}\" in #{key[0]}: use lowercase-kebab")
            if key in self.tags:
                self.errors.append(f"data-tag \"{a['data-tag']}\" appears twice in #{key[0]}")
            self.tags[key] = True
        if "question" in cls:
            self.questions += 1
            if "data-tag" not in a:
                self.errors.append("a .question needs a data-tag so its answer can be matched")
        if tag == "h1":
            self.grab, self.buf = "h1", []
        if tag == "pre" and "mermaid" in cls:
            self.grab, self.buf = "mermaid", []
        if tag == "script" and a.get("src"):
            self.errors.append(f"external script {a['src']}: the build adds the only script a board needs")

    def handle_endtag(self, tag):
        if self.grab == "h1" and tag == "h1":
            self.h1, self.grab = " ".join("".join(self.buf).split()), None
        if self.grab == "mermaid" and tag == "pre":
            self.check_diagram("".join(self.buf))
            self.grab = None
        if tag in self.stack:
            while self.stack and self.stack.pop() != tag:
                pass
        if self.board and len(self.stack) < self.board[1]:
            self.board = None

    def handle_data(self, data):
        if self.grab:
            self.buf.append(data)
        m = PLACEHOLDER.search(data)
        if m and self.grab != "mermaid":
            where = self.board[0] if self.board else "top"
            self.errors.append(f"placeholder text \"{m.group(0)}\" in #{where}: resolve it or turn it into an open question")

    def check_diagram(self, src):
        where = self.board[0] if self.board else "top"
        if not re.match(r"\s*(flowchart|graph)\b", src):
            return
        nodes = set(re.findall(r"(?m)(?:^|[\s>|&-])([A-Za-z][\w]*)\s*(?:\[|\(|\{|>)", src))
        nodes -= {"subgraph", "end", "flowchart", "graph", "classDef", "class", "style"}
        if len(nodes) > MAX_NODES:
            self.warnings.append(f"#{where}: flowchart has ~{len(nodes)} nodes; split it so each diagram answers one question (max {MAX_NODES})")
        if ":::new" not in src and ":::ext" not in src:
            self.warnings.append(f"#{where}: flowchart marks nothing :::new or :::ext; show what this feature adds versus what already exists")


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    folder = Path(sys.argv[1]).expanduser().resolve()
    src = folder / "board.html"
    if not src.is_file():
        sys.exit(f"no board.html in {folder}")
    content = src.read_text(encoding="utf-8")
    theme_file = folder / "theme.css"
    theme = theme_file.read_text(encoding="utf-8") if theme_file.is_file() else ""

    c = Check()
    c.feed(content)
    c.errors += taste(content, "board.html")
    if theme and not re.search(r"derived from\s+\S", theme):
        c.errors += taste(theme, "theme.css")
    if not c.h1:
        c.errors.append("no <h1>: the hero needs the feature name")
    if not c.rev:
        c.errors.append('hero needs data-rev: <header class="board hero" data-rev="1" data-date="YYYY-MM-DD">')
    if re.search(r"<(html|body|head)\b", content, re.I):
        c.errors.append("board.html holds only the hero and the boards; the build supplies <html>, <head> and <body>")
    if re.search(r"style=\"[^\"]*(#[0-9a-fA-F]{3,8}\b|rgba?\()", content):
        c.warnings.append("board.html has literal colours; use tokens (var(--accent) …) so both themes and the app theme apply")
    for sec in re.findall(r"<section\b[^>]*\bdata-fold\b[^>]*>.*?</section>", content, flags=re.S):
        if 'class="mermaid"' in sec:
            c.errors.append("a data-fold board holds a diagram; diagrams cannot draw while collapsed, so move it to an open board")
    for sec in re.findall(r'<section\b[^>]*\bid="(?:build|plan)"[^>]*>.*?</section>', content, flags=re.S):
        sec = sec.split('class="phase"')[0]  # rollout steps may carry real waits (a soak, a deploy window)
        m = re.search(r"~?\b\d+(?:\.\d+)?\s*(?:-\s*\d+\s*)?(?:days?|weeks?|wks?|sprints?|months?)\b", re.sub(r"<[^>]+>", " ", sec), re.I)
        if m:
            c.warnings.append(f"build order has a duration (\"{m.group(0).strip()}\"); agents build it, so size slices by review effort instead; durations belong only on rollout steps")
    if c.boards > 12:
        c.warnings.append(f"{c.boards} boards: fold detail into <details class=\"more\"> or merge boards; aim for 12 or fewer")

    for w in c.warnings:
        print(f"warn   {w}")
    for e in c.errors:
        print(f"ERROR  {e}")
    if c.errors:
        sys.exit(f"\n{len(c.errors)} error(s); index.html not written")

    imports = "\n".join(re.findall(r"(?m)^\s*@import[^;]+;", theme))
    theme = re.sub(r"(?m)^\s*@import[^;]+;\s*", "", theme)
    out = (KIT / "shell.html").read_text(encoding="utf-8")
    parts = {
        "TITLE": c.h1.replace("<", "&lt;") + " · whiteboard",
        "IMPORTS": imports,
        "CSS": (KIT / "board.css").read_text(encoding="utf-8"),
        "THEME": theme,
        "CONTENT": content,
        "MERMAID": MERMAID if 'class="mermaid"' in content else "",
        "JS": (KIT / "board.js").read_text(encoding="utf-8"),
    }
    out = re.sub(r"\{\{(\w+)\}\}", lambda m: parts[m.group(1)], out)
    dest = folder / "index.html"
    dest.write_text(out, encoding="utf-8")
    print(f"ok     {dest}  ({len(out) // 1024} KB, rev {c.rev}, {c.boards} boards, {c.questions} open question(s), {len(c.warnings)} warning(s))")


if __name__ == "__main__":
    main()
