/* Whiteboard kit runtime: rail nav, theme, themed mermaid, and notes (tag anything, copy for the agent). */
(function () {
  'use strict';
  var root = document.documentElement;
  var main = document.querySelector('main.wrap');
  if (!main) return;

  function $(s, c) { return (c || document).querySelector(s); }
  function $$(s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); }
  function el(tag, cls, html) { var n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function load(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function save(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* private mode: notes last for this visit only */ } }
  function token(name) { return getComputedStyle(root).getPropertyValue(name).trim(); }

  var hero = $('header.board', main);
  if (hero && !hero.id) hero.id = 'top';
  var title = clean(($('h1', main) || {}).textContent) || document.title;
  var rev = (hero && hero.dataset.rev) || '1';
  var boards = $$('section.board', main);

  /* ---------- rail ---------- */
  var rail = $('nav.rail');
  if (rail) {
    var h = '<div class="rail-top"><a class="rail-title" href="#top">' + esc(title) + '</a><span class="rail-rev">rev ' + esc(rev) +
      (hero && hero.dataset.date ? ' · ' + esc(hero.dataset.date) : '') + '</span></div><ol>';
    boards.forEach(function (b, i) {
      var label = b.dataset.nav || clean(($('.eyebrow', b) || $('h2', b) || {}).textContent) || b.id;
      var changed = b.hasAttribute('data-changed') || b.querySelector('[data-changed]');
      h += '<li><a href="#' + esc(b.id) + '"><span class="n">' + (i < 9 ? '0' : '') + (i + 1) + '</span>' + esc(label) +
        (changed ? '<i class="dot" title="Changed in this revision"></i>' : '') + '</a></li>';
    });
    h += '</ol><div class="rail-foot"><button type="button" data-act="theme"></button></div>';
    rail.innerHTML = h;
    var themeBtn = $('[data-act="theme"]', rail);
    var paintTheme = function () { themeBtn.textContent = root.dataset.theme === 'dark' ? 'Light mode' : 'Dark mode'; };
    paintTheme();
    themeBtn.addEventListener('click', function () {
      root.dataset.theme = root.dataset.theme === 'dark' ? 'light' : 'dark';
      save('wb-theme', root.dataset.theme);
      paintTheme();
      drawDiagrams();
    });
    if ('IntersectionObserver' in window) {
      var links = {};
      $$('ol a', rail).forEach(function (a) { links[a.getAttribute('href').slice(1)] = a; });
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (!en.isIntersecting) return;
          for (var k in links) links[k].classList.toggle('on', k === en.target.id);
        });
      }, { rootMargin: '-15% 0px -75% 0px' });
      boards.forEach(function (b) { io.observe(b); });
    }
  }

  /* ---------- folding boards (data-fold): collapsed by default, with a question count ---------- */
  var folds = $$('section.board[data-fold]', main);
  folds.forEach(function (b) {
    var head = $('.board-head', b);
    if (!head) return;
    var body = el('div', 'fold-body');
    $$(':scope > *', b).forEach(function (n) { if (n !== head) body.appendChild(n); });
    b.appendChild(body);
    var side = el('span', 'fold-side', '<span class="chip warn fold-count"></span><span class="fold-chev" aria-hidden="true"></span>');
    head.appendChild(side);
    head.setAttribute('role', 'button');
    head.tabIndex = 0;
    var toggle = function () { setFold(b, !b.classList.contains('folded')); };
    head.addEventListener('click', function (e) { if (!(e.target.closest && e.target.closest('a'))) toggle(); });
    head.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
    setFold(b, true);
  });
  function setFold(b, folded) {
    b.classList.toggle('folded', folded);
    $('.fold-body', b).hidden = folded;
    $('.board-head', b).setAttribute('aria-expanded', String(!folded));
  }
  function reveal(node) {
    var b = node && node.closest && node.closest('section.board[data-fold]');
    if (b && b.classList.contains('folded')) setFold(b, false);
  }
  function revealHash() {
    var id = decodeURIComponent(location.hash.slice(1));
    var t = id && document.getElementById(id);
    if (t) reveal(t);
  }
  window.addEventListener('hashchange', revealHash);
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a) return;
    var t = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
    if (t) reveal(t);
  });
  revealHash();
  function paintFolds() {
    folds.forEach(function (b) {
      var qs = $$('.question', b), c = $('.fold-count', b), link = rail && $('a[href="#' + b.id + '"]', rail);
      if (!c) return;
      var answered = qs.filter(function (q) { return notes.some(function (n) { return n.kind === 'answer' && byRef[n.ref] === q; }); }).length;
      var open = qs.length - answered;
      c.hidden = !qs.length;
      c.className = 'chip fold-count ' + (open ? 'warn' : 'ok');
      c.textContent = open ? open + ' open' + (answered ? ' · ' + answered + ' answered' : '') : 'All answered';
      if (link) {
        var badge = $('.count', link) || link.appendChild(el('span', 'count'));
        badge.textContent = qs.length ? String(open) : '';
        badge.hidden = !open;
      }
    });
  }

  /* ---------- diagrams: mermaid drawn with the page tokens ---------- */
  var diagrams = $$('pre.mermaid', main);
  diagrams.forEach(function (d) { d.dataset.src = d.textContent; });
  function drawDiagrams() {
    if (!window.mermaid || !diagrams.length) { indexUnits(); return; }
    var t = {};
    ['board', 'ink', 'soft', 'line', 'accent', 'accent-tint', 'accent-ink', 'code-bg', 'warn-tint', 'bad', 'bad-tint', 'sans'].forEach(function (k) { t[k] = token('--' + k); });
    var classDefs = '\n  classDef new fill:' + t['accent-tint'] + ',stroke:' + t.accent + ',color:' + t.ink +
      '\n  classDef ext fill:' + t.board + ',stroke:' + t.soft + ',color:' + t.soft + ',stroke-dasharray:4 3' +
      '\n  classDef risk fill:' + t['bad-tint'] + ',stroke:' + t.bad + ',color:' + t.ink + '\n';
    diagrams.forEach(function (d) {
      var src = d.dataset.src;
      d.removeAttribute('data-processed');
      d.textContent = /^\s*(flowchart|graph)\b/.test(src) ? src + classDefs : src;
    });
    window.mermaid.initialize({
      startOnLoad: false, securityLevel: 'strict', theme: 'base',
      themeVariables: {
        fontFamily: t.sans, fontSize: '14px', background: t.board,
        primaryColor: t['code-bg'], primaryTextColor: t.ink, primaryBorderColor: t.soft, lineColor: t.soft,
        secondaryColor: t['accent-tint'], tertiaryColor: t.board, clusterBkg: t.board, clusterBorder: t.line,
        edgeLabelBackground: t.board, noteBkgColor: t['warn-tint'], noteTextColor: t.ink, noteBorderColor: t.line,
        actorBkg: t['code-bg'], actorBorder: t.soft, actorTextColor: t.ink, signalColor: t.soft, signalTextColor: t.ink,
        labelBoxBkgColor: t['code-bg'], labelBoxBorderColor: t.line, labelTextColor: t.ink, loopTextColor: t.ink,
        activationBkgColor: t['accent-tint'], activationBorderColor: t.accent, sequenceNumberColor: t.board
      }
    });
    window.mermaid.run({ nodes: diagrams }).then(indexUnits, indexUnits);
  }

  /* ---------- units: everything a reader can tag ---------- */
  var HTML_UNITS = '[data-tag], section.board, header.board, .card, .question, .q, .phase, .layer, .diagram, figure.mock, .desk, pre.code, pre.tree, .tbl tbody tr, ul.clean > li';
  var SVG_UNITS = 'g.node, g.cluster, g.actor, text.actor, text.messageText, g.statediagram-state, g.edgeLabel, g.note';
  var byRef = {};

  function unitFrom(target) {
    if (!target || !target.closest || !main.contains(target)) return null;
    var mock = target.closest('figure.mock') || target.closest('.desk');
    if (mock) return target.closest('[data-tag]') && mock.contains(target.closest('[data-tag]')) ? target.closest('[data-tag]') : mock;
    return target.closest(SVG_UNITS) || target.closest(HTML_UNITS);
  }
  function labelOf(u) {
    if (u instanceof SVGElement) return clean(u.textContent);
    var head = $('h2, h3, h4, b, td, code', u);
    return clean((head || u).textContent);
  }
  function refOf(u) {
    var sec = u.closest('section.board, header.board');
    var ref = '#' + ((sec && sec.id) || 'top');
    if (u === sec) return ref;
    var isSvg = u instanceof SVGElement;
    var host = isSvg ? u.closest('[data-tag]') : u;
    if (host && host.dataset && host.dataset.tag) ref += '.' + host.dataset.tag;
    if (isSvg || !u.dataset.tag) ref += ' › "' + labelOf(u).slice(0, 60) + '"';
    return ref;
  }
  function indexUnits() {
    byRef = {};
    $$(HTML_UNITS + ',' + SVG_UNITS, main).forEach(function (u) { var r = refOf(u); if (!byRef[r]) byRef[r] = u; });
    paintMarks();
  }

  /* ---------- notes ---------- */
  var KEY = 'wb-notes:' + location.pathname + ':' + title;
  var notes = [];
  try { notes = JSON.parse(load(KEY) || '[]') || []; } catch (e) { notes = []; }
  var KINDS = { question: 'Question', change: 'Change', approve: 'Looks good', answer: 'Answer' };
  function newId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
  var current = null;   // unit being annotated
  var kind = 'question';

  var add = el('button', 'wb-add'); add.type = 'button';
  var dock = el('div', 'wb-dock', '<button type="button" data-act="pick" aria-pressed="false" title="Then click any part of the board (shortcut: N)">+ Note</button><button type="button" class="primary" data-act="tray"></button>');
  var composer = el('div', 'wb-panel');
  var tray = el('div', 'wb-panel');
  document.body.appendChild(add); document.body.appendChild(composer); document.body.appendChild(tray); document.body.appendChild(dock);

  function persist() { save(KEY, JSON.stringify(notes)); paintMarks(); paintDock(); if (tray.classList.contains('show')) paintTray(); }
  function paintDock() { $('[data-act="tray"]', dock).textContent = notes.length ? notes.length + (notes.length === 1 ? ' note' : ' notes') + ' · review & copy' : 'No notes yet'; }
  function paintMarks() {
    if (typeof paintFolds === 'function') setTimeout(paintFolds);
    $$('.has-note', main).forEach(function (n) { n.classList.remove('has-note'); });
    $$('.opt[aria-pressed="true"]', main).forEach(function (o) { o.setAttribute('aria-pressed', 'false'); });
    notes.forEach(function (n) {
      var u = byRef[n.ref]; if (!u) return;
      if (n.kind === 'answer') {
        $$('.opt', u).forEach(function (o) { if (optLabel(o) === n.text) o.setAttribute('aria-pressed', 'true'); });
      } else u.classList.add('has-note');
    });
  }
  function optLabel(o) { var c = o.cloneNode(true); $$('small', c).forEach(function (s) { s.remove(); }); return clean(c.textContent); }

  function setPick(on) {
    document.body.classList.toggle('wb-pick', on);
    $('[data-act="pick"]', dock).setAttribute('aria-pressed', on ? 'true' : 'false');
    $('[data-act="pick"]', dock).textContent = on ? 'Click something…' : '+ Note';
  }
  function clearTarget() { $$('.wb-target', main).forEach(function (n) { n.classList.remove('wb-target'); }); }

  function openComposer(u) {
    current = u; clearTarget(); u.classList.add('wb-target');
    tray.classList.remove('show'); add.classList.remove('show'); setPick(false);
    var ref = refOf(u);
    composer.innerHTML = '<h4>Note on <span class="wb-ref">' + esc(ref) + '</span></h4>' +
      '<div class="wb-kinds">' + ['question', 'change', 'approve'].map(function (k) {
        return '<button type="button" data-kind="' + k + '" aria-pressed="' + (k === kind) + '">' + KINDS[k] + '</button>';
      }).join('') + '</div>' +
      '<textarea placeholder="Ask a question or describe the change…"></textarea>' +
      '<div class="row"><span class="hint">⌘/Ctrl + Enter to save</span><button type="button" data-act="cancel">Cancel</button><button type="button" class="primary" data-act="save">Save note</button></div>';
    composer.classList.add('show');
    $('textarea', composer).focus();
  }
  function closeComposer() { composer.classList.remove('show'); clearTarget(); current = null; }
  function saveNote() {
    if (!current) return;
    var text = $('textarea', composer).value.trim();
    if (!text && kind !== 'approve') { $('textarea', composer).focus(); return; }
    notes.push({ id: newId(), ref: refOf(current), kind: kind, text: text, quote: labelOf(current).slice(0, 140) });
    closeComposer(); persist();
  }

  function paintTray() {
    var h = '<h4>Notes for the agent</h4>';
    if (!notes.length) h += '<p class="muted">Hover any card, row, diagram node or section and press the “+” tag, or use “+ Note” and click. Notes stay in this browser until you copy them into the chat.</p>';
    notes.forEach(function (n) {
      h += '<div class="wb-note"><div class="top"><span class="chip ' + (n.kind === 'change' ? 'warn' : n.kind === 'approve' ? 'ok' : 'accent') + '">' + KINDS[n.kind] + '</span>' +
        '<a class="wb-ref" href="#" data-goto="' + esc(n.ref) + '">' + esc(n.ref) + '</a><button type="button" data-del="' + n.id + '">Remove</button></div>' +
        (n.text ? '<p>' + esc(n.text) + '</p>' : '') + '</div>';
    });
    if (notes.length) h += '<div class="row"><span class="hint" data-status>Paste the copied text into the chat.</span><button type="button" data-act="clear">Clear all</button><button type="button" class="primary" data-act="copy">Copy for agent</button></div>';
    tray.innerHTML = h;
  }
  function exportText() {
    var out = ['Whiteboard feedback: ' + title + ' (rev ' + rev + ')', ''];
    notes.forEach(function (n, i) {
      out.push((i + 1) + '. [' + n.kind + '] ' + n.ref + (n.text ? ': ' + n.text.replace(/\n+/g, ' / ') : ''));
      if (n.quote && n.ref.indexOf('"') < 0 && n.kind !== 'answer') out.push('   on: "' + n.quote + '"');
    });
    return out.join('\n');
  }
  function copy(text, done) {
    var fallback = function () {
      var ta = el('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      ta.remove(); done(ok);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(function () { done(true); }, fallback);
    else fallback();
  }

  /* hover tag */
  var hoverUnit = null, hideTimer = null;
  main.addEventListener('mouseover', function (e) {
    if (composer.classList.contains('show')) return;
    var u = unitFrom(e.target); if (!u) return;
    clearTimeout(hideTimer); hoverUnit = u;
    var r = u.getBoundingClientRect();
    add.textContent = '+ ' + refOf(u);
    add.classList.add('show');
    add.style.top = Math.max(6, r.top - 11) + 'px';
    add.style.left = Math.max(6, Math.min(window.innerWidth - add.offsetWidth - 6, r.right - add.offsetWidth - 8)) + 'px';
  });
  main.addEventListener('mouseleave', function () { hideTimer = setTimeout(function () { add.classList.remove('show'); }, 400); });
  add.addEventListener('mouseenter', function () { clearTimeout(hideTimer); });
  add.addEventListener('click', function () { if (hoverUnit) openComposer(hoverUnit); });
  window.addEventListener('scroll', function () { add.classList.remove('show'); }, { passive: true });

  /* clicks */
  main.addEventListener('click', function (e) {
    if (document.body.classList.contains('wb-pick')) {
      var u = unitFrom(e.target);
      if (u) { e.preventDefault(); e.stopPropagation(); openComposer(u); }
      return;
    }
    var opt = e.target.closest && e.target.closest('.question .opt');
    if (opt) {
      var q = opt.closest('.question'), ref = refOf(q), label = optLabel(opt);
      var was = opt.getAttribute('aria-pressed') === 'true';
      notes = notes.filter(function (n) { return !(n.kind === 'answer' && n.ref === ref); });
      if (!was) notes.push({ id: newId(), ref: ref, kind: 'answer', text: label, quote: '' });
      persist();
    }
  }, true);
  dock.addEventListener('click', function (e) {
    var act = e.target.dataset.act;
    if (act === 'pick') { closeComposer(); setPick(!document.body.classList.contains('wb-pick')); }
    if (act === 'tray') { closeComposer(); setPick(false); paintTray(); tray.classList.toggle('show'); }
  });
  composer.addEventListener('click', function (e) {
    var k = e.target.dataset.kind, act = e.target.dataset.act;
    if (k) { kind = k; $$('[data-kind]', composer).forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.kind === k)); }); $('textarea', composer).focus(); }
    if (act === 'cancel') closeComposer();
    if (act === 'save') saveNote();
  });
  composer.addEventListener('keydown', function (e) { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) saveNote(); });
  tray.addEventListener('click', function (e) {
    var t = e.target;
    if (t.dataset.del) { notes = notes.filter(function (n) { return n.id !== t.dataset.del; }); persist(); }
    if (t.dataset.goto) { e.preventDefault(); var u = byRef[t.dataset.goto]; if (u) { reveal(u); u.scrollIntoView({ block: 'center' }); clearTarget(); u.classList.add('wb-target'); setTimeout(clearTarget, 1600); } }
    if (t.dataset.act === 'clear') { notes = []; persist(); }
    if (t.dataset.act === 'copy') copy(exportText(), function (ok) { var s = $('[data-status]', tray); if (s) s.textContent = ok ? 'Copied. Paste it into the chat.' : 'Copy failed; select the text manually.'; if (!ok) window.prompt('Copy this into the chat', exportText()); });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') { closeComposer(); setPick(false); tray.classList.remove('show'); return; }
    if (/^(INPUT|TEXTAREA|SELECT)$/.test((e.target.tagName || '')) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'n' || e.key === 'N') { closeComposer(); setPick(!document.body.classList.contains('wb-pick')); }
  });

  paintDock();
  drawDiagrams();
})();
