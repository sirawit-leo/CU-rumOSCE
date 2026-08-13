/* ============================================================================
   DS — charts and page behaviours for self-contained analytical HTML
   ----------------------------------------------------------------------------
   Load with a plain classic script tag — no modules, no build, no dependencies —
   so it works from file:// and off a USB stick. Everything hangs off one global
   `DS`.

   NOTE: this file deliberately contains no literal script-closing sequence
   anywhere, not even in a comment or a string. That keeps it safe to INLINE into
   a single self-contained HTML file, where such a sequence would end the block
   early and produce a syntax error far from its cause.

   Charts are inline SVG drawn in viewBox units and scaled by CSS
   (`width:100%;height:auto`). Two consequences to remember:
     - all geometry is in viewBox units, so pointer coordinates must be divided
       by (renderedWidth / DS.W) before they can be compared with a mark
     - decorative marks get pointer-events:none, and ONE overlay rect owns
       hovering; per-mark listeners are for a handful of irregular marks only

   API
     DS.el / DS.ticks / DS.frame          low-level SVG
     DS.bar / DS.stack / DS.line
     DS.scatter / DS.histogram            chart builders
     DS.tip.show / .hide / .row / .head   tooltip
     DS.legend / DS.onLegendToggle        legends, incl. click-to-hide a series
     DS.table                             table markup with optional sorting
     DS.sortRows                          the comparator behind it
     DS.notes / DS.tabs / DS.theme
     DS.search                            debounce-free filter that keeps focus
   ========================================================================= */
(function (global) {
  'use strict';

  const NS = 'http://www.w3.org/2000/svg';

  const DS = {
    /* Plot geometry. Set DS.W / DS.H before drawing to change chart size;
       PAD is mutated by charts that need room for a right-hand axis and is
       always restored. */
    W: 680,
    H: 300,
    PAD: { t: 14, r: 20, b: 40, l: 52 },
    /* The default series ramp, in the order you should consume it. */
    SERIES: ['var(--ds-s1)', 'var(--ds-s2)', 'var(--ds-s3)',
             'var(--ds-s4)', 'var(--ds-s5)', 'var(--ds-s6)'],
  };

  /* -------------------------------------------------------------- utilities */
  DS.el = function (tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const k in (attrs || {})) e.setAttribute(k, attrs[k]);
    return e;
  };

  DS.esc = s => String(s == null ? '' : s)
    .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  DS.fmt = function (v, dec) {
    if (v == null || !isFinite(v)) return '—';
    return (+v).toLocaleString(undefined,
      { minimumFractionDigits: dec == null ? 0 : dec, maximumFractionDigits: dec == null ? 0 : dec });
  };

  DS.pct = (a, b, dec) => b ? (100 * a / b).toFixed(dec == null ? 1 : dec) + '%' : '—';

  /* "Nice" axis ticks. Always extends past the data so the top mark is covered. */
  DS.ticks = function (lo, hi, n) {
    n = n || 5;
    if (!isFinite(lo) || !isFinite(hi)) return [0, 1];
    if (lo === hi) { lo -= 1; hi += 1; }
    const raw = (hi - lo) / n, mag = Math.pow(10, Math.floor(Math.log10(raw))), norm = raw / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag;
    const out = [];
    for (let v = Math.floor(lo / step) * step; v <= hi + step * 0.5; v += step) out.push(+v.toFixed(10));
    while (out[out.length - 1] < hi) out.push(+(out[out.length - 1] + step).toFixed(10));
    return out;
  };

  DS.svg = function (host) {
    host.innerHTML = '';
    const svg = DS.el('svg', { viewBox: `0 0 ${DS.W} ${DS.H}`, role: 'img' });
    host.appendChild(svg);
    return svg;
  };

  /* Axes, gridlines and scales.
     band=true centres categories in a slot (bars); band=false puts them on the
     slot edges (lines). Returns the scale functions and the snapped extent. */
  DS.frame = function (svg, cats, yl, yh, yfmt, band) {
    const P = DS.PAD;
    const tk = DS.ticks(yl, yh), lo = tk[0], hi = tk[tk.length - 1];
    const IW = DS.W - P.l - P.r, IH = DS.H - P.t - P.b;
    const X = band
      ? (i => P.l + (i + 0.5) * IW / Math.max(cats.length, 1))
      : (i => P.l + (cats.length < 2 ? IW / 2 : i * IW / (cats.length - 1)));
    const Y = v => P.t + IH - (v - lo) / (hi - lo || 1) * IH;

    tk.forEach(t => {
      svg.appendChild(DS.el('line', { x1: P.l, x2: DS.W - P.r, y1: Y(t), y2: Y(t), stroke: 'var(--ds-grid)' }));
      const lab = DS.el('text', {
        x: P.l - 9, y: Y(t) + 4, 'text-anchor': 'end', fill: 'var(--ds-muted)',
        'font-size': 11, style: 'font-variant-numeric:tabular-nums',
      });
      lab.textContent = yfmt ? yfmt(t) : DS.fmt(t, 0);
      svg.appendChild(lab);
    });
    svg.appendChild(DS.el('line', {
      x1: P.l, x2: DS.W - P.r, y1: DS.H - P.b, y2: DS.H - P.b, stroke: 'var(--ds-axis)' }));

    const skip = cats.length > 9 ? Math.ceil(cats.length / 9) : 1;
    cats.forEach((c, i) => {
      if (i % skip) return;
      const t = DS.el('text', {
        x: X(i), y: DS.H - P.b + 17, 'text-anchor': 'middle',
        fill: 'var(--ds-muted)', 'font-size': 11 });
      t.textContent = c;
      svg.appendChild(t);
    });
    return { X, Y, lo, hi };
  };

  /* A dashed horizontal reference line — a target, a threshold, a limit.
     idx offsets the label so several can share one chart. */
  DS.refLine = function (svg, Y, v, label, idx, color) {
    svg.appendChild(DS.el('line', {
      x1: DS.PAD.l, x2: DS.W - DS.PAD.r, y1: Y(v), y2: Y(v),
      stroke: color || 'var(--ds-muted)', 'stroke-dasharray': '4 4', 'pointer-events': 'none' }));
    const t = DS.el('text', {
      x: DS.PAD.l + 4 + (idx || 0) * 90, y: Y(v) - 5,
      fill: color || 'var(--ds-muted)', 'font-size': 10.5 });
    t.textContent = label;
    svg.appendChild(t);
  };

  /* -------------------------------------------------------------- tooltip */
  let tipEl = null;
  function tipNode() {
    if (!tipEl) {
      tipEl = document.querySelector('.ds-tip');
      if (!tipEl) {
        tipEl = document.createElement('div');
        tipEl.className = 'ds-tip';
        document.body.appendChild(tipEl);
      }
    }
    return tipEl;
  }
  DS.tip = {
    /* Positions 14px down-right of the cursor, flipping at the viewport edge. */
    show(e, html) {
      const t = tipNode();
      t.innerHTML = html;
      t.style.opacity = 1;
      const r = t.getBoundingClientRect();
      let x = e.clientX + 14, y = e.clientY + 14;
      if (x + r.width > innerWidth - 8) x = e.clientX - r.width - 14;
      if (y + r.height > innerHeight - 8) y = e.clientY - r.height - 14;
      t.style.left = x + 'px';
      t.style.top = y + 'px';
    },
    hide() { tipNode().style.opacity = 0; },
    head: t => `<b>${t}</b>`,
    row: (k, v, color) => `<div class="ds-row"><span>${
      color ? `<span style="color:${color}">■</span> ` : ''}${k}</span><b>${v}</b></div>`,
  };
  document.addEventListener('scroll', () => DS.tip.hide(), true);

  /* -------------------------------------------------------------- legend */
  DS.swatch = (color, name) => `<span class="ds-lgi"><i class="ds-sw" style="background:${color}"></i>${name}</span>`;

  /* Togglable legend. `key` scopes the hidden set so several charts can coexist. */
  const hidden = new Map();
  DS.hiddenOf = k => hidden.get(k) || new Set();
  DS.legend = function (key, items, togglable) {
    const h = DS.hiddenOf(key);
    const on = togglable !== false && items.length > 1;
    return items.map((it, i) => `<span class="ds-lgi${on ? ' ds-togglable' : ''}"
      data-ds-legend="${key}" data-ds-i="${i}"
      ${on ? `role="button" tabindex="0" aria-pressed="${!h.has(i)}"` : ''}
      style="${h.has(i) ? 'opacity:.4' : ''}"><i class="ds-sw" style="background:${it.color}"></i>${it.name}</span>`).join('')
      + (on ? '<span class="ds-mutedtext">click a series to hide it</span>' : '');
  };
  /* One delegated listener for the whole page rather than one per card. */
  DS.onLegendToggle = function (redraw) {
    const handle = b => {
      const k = b.dataset.dsLegend, i = +b.dataset.dsI;
      const h = new Set(DS.hiddenOf(k));
      h.has(i) ? h.delete(i) : h.add(i);
      hidden.set(k, h);
      const y = scrollY; redraw(); scrollTo(0, y);
    };
    document.addEventListener('click', e => {
      const b = e.target.closest('.ds-lgi.ds-togglable');
      if (b) handle(b);
    });
    document.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      const b = e.target.closest && e.target.closest('.ds-lgi.ds-togglable');
      if (b) { e.preventDefault(); handle(b); }
    });
  };

  /* -------------------------------------------------------------- charts */

  /* Vertical bars. opts: {dec, color(v,i)|color, refs:[{v,label}], max,
     yfmt, tip(i,v), click(i), labels:false, nullLabel} */
  DS.bar = function (host, cats, data, opts) {
    opts = opts || {};
    const svg = DS.svg(host);
    const vals = data.filter(v => v != null);
    const top = opts.max != null ? opts.max
      : Math.max(...vals, ...(opts.refs || []).map(r => r.v), 1) * 1.14;
    const { X, Y } = DS.frame(svg, cats, 0, top, opts.yfmt, true);
    const IW = DS.W - DS.PAD.l - DS.PAD.r;
    const bw = Math.min(46, IW / Math.max(cats.length, 1) * 0.62);
    (opts.refs || []).forEach((r, i) => DS.refLine(svg, Y, r.v, r.label, i, 'var(--ds-critical)'));

    data.forEach((v, i) => {
      if (v == null) {
        const t = DS.el('text', { x: X(i), y: Y(0) - 8, 'text-anchor': 'middle',
          fill: 'var(--ds-muted)', 'font-size': 10.5 });
        t.textContent = opts.nullLabel || 'no data';
        svg.appendChild(t);
        return;
      }
      const col = typeof opts.color === 'function' ? opts.color(v, i) : (opts.color || 'var(--ds-s1)');
      svg.appendChild(DS.el('rect', { x: X(i) - bw / 2, y: Y(v), width: bw,
        height: Math.max(1, Y(0) - Y(v)), rx: 4, fill: col, class: 'ds-bar', 'pointer-events': 'none' }));
      if (opts.labels !== false) {
        const lab = DS.el('text', { x: X(i), y: Y(v) - 6, 'text-anchor': 'middle',
          fill: 'var(--ds-text-2)', 'font-size': 11, style: 'font-variant-numeric:tabular-nums',
          'pointer-events': 'none' });
        lab.textContent = opts.barLabel ? opts.barLabel(i, v) : DS.fmt(v, opts.dec == null ? 1 : opts.dec);
        svg.appendChild(lab);
      }
    });
    hitColumns(svg, cats, X, i => opts.tip
      ? opts.tip(i, data[i])
      : DS.tip.head(cats[i]) + DS.tip.row('value', DS.fmt(data[i], opts.dec == null ? 1 : opts.dec)),
      opts.click);
    return svg;
  };

  /* One transparent hit rect per category. The single cleanest hover idiom:
     the pointer never has to land on a thin mark. */
  function hitColumns(svg, cats, X, tipHtml, onClick) {
    const w = (DS.W - DS.PAD.l - DS.PAD.r) / Math.max(cats.length, 1);
    cats.forEach((_, i) => {
      const r = DS.el('rect', { x: X(i) - w / 2, y: DS.PAD.t, width: w,
        height: DS.H - DS.PAD.t - DS.PAD.b, fill: 'transparent',
        class: 'ds-hit', style: onClick ? 'cursor:pointer' : 'cursor:default' });
      r.addEventListener('mousemove', e => DS.tip.show(e, tipHtml(i)));
      r.addEventListener('mouseleave', () => DS.tip.hide());
      if (onClick) r.addEventListener('click', () => { DS.tip.hide(); onClick(i); });
      svg.appendChild(r);
    });
  }
  DS.hitColumns = hitColumns;

  /* Stacked bars. series: [{name, color, data:[]}]
     opts: {dec, refs, totalFmt(i,total), pctOf, hideZero, click(i, seriesIdx), yfmt}

     pctOf matters: without it, a bar carried by a single series always reports
     100% of its own column, which is true and useless. Pass the population. */
  DS.stack = function (host, cats, series, opts) {
    opts = opts || {};
    const svg = DS.svg(host);
    const totals = cats.map((_, i) => series.reduce((s, x) => s + (x.data[i] || 0), 0));
    const dec = opts.dec || 0;
    const top = Math.max(...totals, ...(opts.refs || []).map(r => r.v), 1) * 1.12;
    const { X, Y } = DS.frame(svg, cats, 0, top, opts.yfmt || (v => DS.fmt(v, dec)), true);
    const bw = Math.min(42, (DS.W - DS.PAD.l - DS.PAD.r) / Math.max(cats.length, 1) - 6);
    (opts.refs || []).forEach((r, i) => DS.refLine(svg, Y, r.v, r.label, i, 'var(--ds-critical)'));

    cats.forEach((_, i) => {
      let acc = 0;
      const bands = [];
      series.forEach((s, si) => {
        const v = s.data[i] || 0;
        if (!v) return;
        const y0 = Y(acc), y1 = Y(acc + v);
        svg.appendChild(DS.el('rect', { x: X(i) - bw / 2, y: y1, width: bw,
          height: Math.max(y0 - y1 - 2, 1), rx: 3, fill: s.color, class: 'ds-bar',
          'pointer-events': 'none' }));
        bands.push([y1, y0, si]);
        acc += v;
      });
      const hit = DS.el('rect', { x: X(i) - Math.max(bw, 24) / 2, y: DS.PAD.t,
        width: Math.max(bw, 24), height: DS.H - DS.PAD.t - DS.PAD.b, fill: 'transparent', class: 'ds-hit' });
      if (opts.click) {
        hit.setAttribute('style', 'cursor:pointer');
        /* resolve the clicked segment from the pointer's y instead of putting a
           listener on every slice */
        hit.addEventListener('click', e => {
          const rc = svg.getBoundingClientRect(), sc = rc.width / DS.W;
          const my = (e.clientY - rc.top) / sc;
          const b = bands.find(([a, z]) => my >= a - 1.5 && my <= z + 1.5);
          if (b) opts.click(i, b[2]);
        });
      }
      hit.addEventListener('mousemove', e => DS.tip.show(e,
        DS.tip.head(cats[i])
        + series.map(s => {
            const v = s.data[i] || 0;
            if (opts.hideZero && !v) return '';
            const den = opts.pctOf || totals[i];
            return DS.tip.row(s.name,
              `${DS.fmt(v, 0)} <span class="ds-mutedtext">(${DS.pct(v, den)})</span>`, s.color);
          }).join('')
        + `<div class="ds-row" style="border-top:1px solid var(--ds-grid);margin-top:4px;padding-top:4px">
             <span>Total</span><b>${DS.fmt(totals[i], dec)}${
               opts.totalFmt ? ` <span class="ds-mutedtext">(${opts.totalFmt(i, totals[i])})</span>` : ''}</b></div>`));
      hit.addEventListener('mouseleave', () => DS.tip.hide());
      svg.appendChild(hit);

      const t = DS.el('text', { x: X(i), y: Y(totals[i]) - 6, 'text-anchor': 'middle',
        fill: 'var(--ds-text-2)', 'font-size': 10.5, 'pointer-events': 'none' });
      t.textContent = opts.totalFmt ? opts.totalFmt(i, totals[i]) : DS.fmt(totals[i], dec);
      svg.appendChild(t);
    });
    return svg;
  };

  /* Multi-series lines. A guide line tracks the nearest category and the tooltip
     reports every visible series at once — one read, not one per line.
     opts: {dec, hidden:Set, refs, click(i), full:[], yfmt, extra(i)} */
  DS.line = function (host, cats, series, opts) {
    opts = opts || {};
    const svg = DS.svg(host);
    const hid = opts.hidden || new Set();
    const vis = series.filter((s, i) => !hid.has(i));
    const all = vis.flatMap(s => s.data).filter(v => v != null);
    const top = Math.max(...all, ...(opts.refs || []).map(r => r.v), 1) * 1.12;
    const { X, Y } = DS.frame(svg, cats, 0, top, opts.yfmt, false);
    (opts.refs || []).forEach((r, i) => DS.refLine(svg, Y, r.v, r.label, i));

    series.forEach((s, si) => {
      if (hid.has(si)) return;
      const pts = s.data.map((v, i) => v == null ? null : [X(i), Y(v)]).filter(Boolean);
      if (pts.length > 1) {
        svg.appendChild(DS.el('path', { d: 'M' + pts.map(q => q.join(' ')).join(' L '),
          fill: 'none', stroke: s.color, 'stroke-width': 2.2, 'stroke-linejoin': 'round',
          class: 'ds-series', 'pointer-events': 'none' }));
      }
      pts.forEach(q => svg.appendChild(DS.el('circle', { cx: q[0], cy: q[1], r: 3, fill: s.color,
        stroke: 'var(--ds-surface)', 'stroke-width': 1.5, 'pointer-events': 'none' })));
    });

    const guide = DS.el('line', { y1: DS.PAD.t, y2: DS.H - DS.PAD.b, stroke: 'var(--ds-axis)',
      'stroke-dasharray': '3 3', opacity: 0, 'pointer-events': 'none' });
    svg.appendChild(guide);
    const dots = vis.map(s => DS.el('circle', { r: 5, fill: 'none', stroke: s.color,
      'stroke-width': 2, opacity: 0, 'pointer-events': 'none' }));
    dots.forEach(d => svg.appendChild(d));

    const ov = DS.el('rect', { x: DS.PAD.l - 6, y: DS.PAD.t - 6,
      width: DS.W - DS.PAD.l - DS.PAD.r + 12, height: DS.H - DS.PAD.t - DS.PAD.b + 12,
      fill: 'transparent', class: 'ds-hit', style: opts.click ? 'cursor:pointer' : 'cursor:crosshair' });
    let at = -1;
    ov.addEventListener('mousemove', e => {
      const rc = svg.getBoundingClientRect(), k = rc.width / DS.W;
      const mx = (e.clientX - rc.left) / k;
      const step = (DS.W - DS.PAD.l - DS.PAD.r) / Math.max(cats.length - 1, 1);
      at = Math.max(0, Math.min(cats.length - 1, Math.round((mx - DS.PAD.l) / step)));
      guide.setAttribute('x1', X(at)); guide.setAttribute('x2', X(at)); guide.setAttribute('opacity', 1);
      vis.forEach((s, j) => {
        const v = s.data[at];
        if (v == null) { dots[j].setAttribute('opacity', 0); return; }
        dots[j].setAttribute('cx', X(at)); dots[j].setAttribute('cy', Y(v)); dots[j].setAttribute('opacity', 1);
      });
      DS.tip.show(e, DS.tip.head(opts.full ? opts.full[at] : cats[at])
        + vis.map(s => DS.tip.row(s.name,
            s.data[at] == null ? '—' : DS.fmt(s.data[at], opts.dec == null ? 0 : opts.dec), s.color)).join('')
        + (opts.extra ? opts.extra(at) : ''));
    });
    ov.addEventListener('mouseleave', () => {
      guide.setAttribute('opacity', 0);
      dots.forEach(d => d.setAttribute('opacity', 0));
      DS.tip.hide();
    });
    if (opts.click) ov.addEventListener('click', () => { if (at >= 0) { DS.tip.hide(); opts.click(at); } });
    svg.appendChild(ov);
    return svg;
  };

  /* Scatter. points: [{x, y, color, label, ...}]
     Nearest-point hit test within 9 viewBox units, with a ring as the affordance.
     opts: {xref, yref, xrefLabel, yrefLabel, xlab, ylab, tip(p), click(p)} */
  DS.scatter = function (host, points, opts) {
    opts = opts || {};
    const svg = DS.svg(host);
    const P = DS.PAD;
    const xhi = Math.max(...points.map(p => p.x), opts.xref || 0, 1) * 1.1;
    const yhi = Math.max(...points.map(p => p.y), opts.yref || 0, 1) * 1.1;
    const tk = DS.ticks(0, xhi), xtop = tk[tk.length - 1];
    const { Y } = DS.frame(svg, [], 0, yhi, opts.yfmt, false);
    const IW = DS.W - P.l - P.r;
    const X = v => P.l + v / xtop * IW;

    tk.forEach(t => {
      const lab = DS.el('text', { x: X(t), y: DS.H - P.b + 17, 'text-anchor': 'middle',
        fill: 'var(--ds-muted)', 'font-size': 11 });
      lab.textContent = DS.fmt(t, 0);
      svg.appendChild(lab);
    });
    if (opts.xlab) {
      const t = DS.el('text', { x: P.l + IW / 2, y: DS.H - 4, 'text-anchor': 'middle',
        fill: 'var(--ds-muted)', 'font-size': 11 });
      t.textContent = opts.xlab; svg.appendChild(t);
    }
    if (opts.ylab) {
      const t = DS.el('text', { x: 10, y: P.t + 10, fill: 'var(--ds-muted)', 'font-size': 11 });
      t.textContent = opts.ylab; svg.appendChild(t);
    }
    if (opts.xref) {
      svg.appendChild(DS.el('line', { x1: X(opts.xref), x2: X(opts.xref), y1: P.t, y2: DS.H - P.b,
        stroke: 'var(--ds-critical)', 'stroke-dasharray': '4 4', 'pointer-events': 'none' }));
      const t = DS.el('text', { x: X(opts.xref) + 4, y: P.t + 12, fill: 'var(--ds-critical)', 'font-size': 10.5 });
      t.textContent = opts.xrefLabel || ''; svg.appendChild(t);
    }
    if (opts.yref) {
      svg.appendChild(DS.el('line', { x1: P.l, x2: DS.W - P.r, y1: Y(opts.yref), y2: Y(opts.yref),
        stroke: 'var(--ds-critical)', 'stroke-dasharray': '4 4', 'pointer-events': 'none' }));
      const t = DS.el('text', { x: DS.W - P.r - 4, y: Y(opts.yref) - 5, 'text-anchor': 'end',
        fill: 'var(--ds-critical)', 'font-size': 10.5 });
      t.textContent = opts.yrefLabel || ''; svg.appendChild(t);
    }

    const pts = points.map(p => Object.assign({}, p, { px: X(p.x), py: Y(p.y) }));
    pts.forEach(p => svg.appendChild(DS.el('circle', { cx: p.px, cy: p.py, r: 4,
      fill: p.color || 'var(--ds-s1)', opacity: .8, stroke: 'var(--ds-surface)',
      'stroke-width': 1.2, 'pointer-events': 'none' })));

    const ring = DS.el('circle', { r: 7, fill: 'none', stroke: 'var(--ds-text)',
      'stroke-width': 1.6, opacity: 0, 'pointer-events': 'none' });
    svg.appendChild(ring);
    const ov = DS.el('rect', { x: P.l - 6, y: P.t - 6, width: IW + 12,
      height: DS.H - P.t - P.b + 12, fill: 'transparent', class: 'ds-hit' });
    let hover = null;
    ov.addEventListener('mousemove', e => {
      const rc = svg.getBoundingClientRect(), k = rc.width / DS.W;
      const mx = (e.clientX - rc.left) / k, my = (e.clientY - rc.top) / k;
      let best = null, bd = 1e9;
      for (const p of pts) {
        const dx = p.px - mx, dy = p.py - my, d2 = dx * dx + dy * dy;
        if (d2 < bd) { bd = d2; best = p; }
      }
      if (best && bd <= 81) {           /* 9 viewBox units */
        hover = best;
        ov.style.cursor = opts.click ? 'pointer' : 'default';
        ring.setAttribute('cx', best.px); ring.setAttribute('cy', best.py); ring.setAttribute('opacity', 1);
        DS.tip.show(e, opts.tip ? opts.tip(best)
          : DS.tip.head(best.label || '') + DS.tip.row('x', DS.fmt(best.x, 1)) + DS.tip.row('y', DS.fmt(best.y, 1)));
        return;
      }
      hover = null; ov.style.cursor = 'default'; ring.setAttribute('opacity', 0); DS.tip.hide();
    });
    ov.addEventListener('mouseleave', () => { hover = null; ring.setAttribute('opacity', 0); DS.tip.hide(); });
    ov.addEventListener('click', () => { if (hover && opts.click) { DS.tip.hide(); opts.click(hover); } });
    svg.appendChild(ov);
    return svg;
  };

  /* Histogram with the distribution made readable: each bar labelled with its
     share, a cumulative curve on a right-hand 0-100% axis, and median/mean drawn
     where they fall so skew is visible.
     opts: {bin, refs:[{v,label}], color, unit, suffix}
     Returns {total, mean, median, overTarget}. */
  DS.histogram = function (host, values, opts) {
    opts = opts || {};
    const vals = values.filter(v => v != null).sort((a, b) => a - b);
    if (!vals.length) { host.innerHTML = '<div class="ds-empty">No data</div>'; return null; }
    const savedR = DS.PAD.r;
    DS.PAD.r = 44;
    const svg = DS.svg(host);
    const bin = opts.bin || 10;
    const hi = Math.ceil((vals[vals.length - 1] + 1) / bin) * bin;
    const bins = [], cats = [];
    for (let b = 0; b < hi; b += bin) {
      bins.push(vals.filter(v => v >= b && v < b + bin).length);
      cats.push(b + '–' + (b + bin));
    }
    const total = vals.length;
    const { X, Y } = DS.frame(svg, cats, 0, Math.max(...bins) * 1.18 || 1, null, true);
    const IW = DS.W - DS.PAD.l - DS.PAD.r;
    const bw = Math.min(54, IW / cats.length * 0.74);
    const YC = p => DS.PAD.t + (DS.H - DS.PAD.t - DS.PAD.b) * (1 - p / 100);

    [0, 25, 50, 75, 100].forEach(p => {
      const t = DS.el('text', { x: DS.W - DS.PAD.r + 8, y: YC(p) + 4, fill: 'var(--ds-muted)',
        'font-size': 10.5, style: 'font-variant-numeric:tabular-nums' });
      t.textContent = p + '%'; svg.appendChild(t);
    });

    const mean = vals.reduce((a, b) => a + b, 0) / total;
    const mid = total >> 1;
    const median = total % 2 ? vals[mid] : (vals[mid - 1] + vals[mid]) / 2;
    const atX = v => DS.PAD.l + Math.min(1, v / hi) * IW;
    const marker = (v, label, color, dy) => {
      if (v == null || v > hi) return;
      svg.appendChild(DS.el('line', { x1: atX(v), x2: atX(v), y1: DS.PAD.t, y2: DS.H - DS.PAD.b,
        stroke: color, 'stroke-dasharray': '4 4', 'pointer-events': 'none' }));
      const t = DS.el('text', { x: atX(v) + 4, y: DS.PAD.t + dy, fill: color, 'font-size': 10.5, 'font-weight': 600 });
      t.textContent = label; svg.appendChild(t);
    };
    (opts.refs || []).forEach(r => marker(r.v, r.label, 'var(--ds-critical)', 12));
    marker(median, 'median ' + Math.round(median), 'var(--ds-s4)', 26);
    marker(mean, 'mean ' + Math.round(mean), 'var(--ds-muted)', 40);

    const target = (opts.refs || [])[0] ? opts.refs[0].v : null;
    const cum = [];
    let run = 0;
    bins.forEach((n, i) => {
      run += n; cum.push(run);
      if (!n) return;
      const past = target != null && i * bin >= target;
      svg.appendChild(DS.el('rect', { x: X(i) - bw / 2, y: Y(n), width: bw, height: Y(0) - Y(n), rx: 3,
        fill: past ? 'var(--ds-critical)' : (opts.color || 'var(--ds-s1)'),
        opacity: past ? .85 : 1, class: 'ds-bar', 'pointer-events': 'none' }));
      const lab = DS.el('text', { x: X(i), y: Y(n) - 6, 'text-anchor': 'middle',
        fill: 'var(--ds-text-2)', 'font-size': 10.5,
        style: 'font-variant-numeric:tabular-nums', 'pointer-events': 'none' });
      lab.textContent = DS.pct(n, total, n / total < .1 ? 1 : 0); svg.appendChild(lab);
    });

    const line = cum.map((c, i) => [X(i), YC(100 * c / total)]);
    svg.appendChild(DS.el('path', { d: 'M' + line.map(p => p.join(' ')).join(' L '), fill: 'none',
      stroke: 'var(--ds-s2)', 'stroke-width': 1.8, 'stroke-dasharray': '5 3', 'pointer-events': 'none' }));
    line.forEach(p => svg.appendChild(DS.el('circle', { cx: p[0], cy: p[1], r: 2.6,
      fill: 'var(--ds-s2)', 'pointer-events': 'none' })));

    const past = target == null ? null : vals.filter(v => v >= target).length;
    hitColumns(svg, cats, X, i => DS.tip.head(cats[i] + (opts.suffix == null ? '' : ' ' + opts.suffix))
      + DS.tip.row('in this band', `${bins[i]} of ${total} (${DS.pct(bins[i], total)})`)
      + DS.tip.row('up to here', DS.pct(cum[i], total))
      + (target != null ? DS.tip.row(`past the ${target} target`, `${past} (${DS.pct(past, total)})`) : ''));

    DS.PAD.r = savedR;
    return { total, mean, median, overTarget: past };
  };

  /* -------------------------------------------------------------- tables */
  /* Markup only — no state. Pass sortKey/sortDir to draw the caret. */
  DS.table = function (cols, rows, opts) {
    opts = opts || {};
    if (!rows.length) return `<div class="ds-empty">${opts.empty || 'Nothing to show'}</div>`;
    const head = cols.map((c, i) => `<th${opts.sortable ? ` class="ds-sortable" data-ds-col="${i}"` : ''}>${
      DS.esc(c)}${opts.sortable && opts.sortKey === i ? (opts.sortDir > 0 ? ' ▲' : ' ▼') : ''}</th>`).join('');
    const body = rows.map(r => `<tr>${r.map(v => `<td>${v == null ? '—' : v}</td>`).join('')}</tr>`).join('');
    return `<table class="ds-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
  };

  /* Comparator that sinks blanks to the bottom in both directions — a missing
     value is not "smallest", it is unknown. */
  DS.sortRows = function (rows, get, dir) {
    return [...rows].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      return (typeof va === 'string' ? String(va).localeCompare(String(vb)) : va - vb) * dir;
    });
  };

  /* -------------------------------------------------------------- behaviours */

  /* Collapsible card descriptions. Finds each card's own .ds-csub (direct child
     only, so nested notes are untouched), hides it, and grafts a Notes button
     into the header. State is keyed by card TITLE so it survives a re-render. */
  const openNotes = new Set();
  DS.notes = function (root) {
    (root || document).querySelectorAll('.ds-card').forEach(c => {
      const sub = [...c.children].find(x => x.classList && x.classList.contains('ds-csub'));
      if (!sub || sub.dataset.dsBound) return;
      const head = c.querySelector('.ds-chead');
      if (!head) return;
      sub.dataset.dsBound = '1';
      const key = ((c.querySelector('.ds-ctitle') || {}).textContent || '').trim();
      const label = o => o ? 'ⓘ Hide notes' : 'ⓘ Notes';
      let open = openNotes.has(key);
      sub.style.display = open ? '' : 'none';
      let btns = head.querySelector('.ds-cbtns');
      if (!btns) { btns = document.createElement('div'); btns.className = 'ds-cbtns'; head.appendChild(btns); }
      const b = document.createElement('button');
      b.className = 'ds-tgl'; b.type = 'button'; b.textContent = label(open);
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
      b.addEventListener('click', () => {
        open = !open;
        sub.style.display = open ? '' : 'none';
        open ? openNotes.add(key) : openNotes.delete(key);
        b.textContent = label(open);
        b.setAttribute('aria-expanded', open ? 'true' : 'false');
      });
      btns.insertBefore(b, btns.firstChild);
    });
  };

  /* Card factory. Returns a detached .ds-card with the fixed child order that
     DS.notes depends on: .ds-chead, [.ds-views], .ds-csub, .ds-plot, .ds-legend, .ds-tv */
  DS.card = function (o) {
    const c = document.createElement('div');
    c.className = 'ds-card' + (o.wide ? ' ds-wide' : '') + (o.expanded ? ' ds-expanded' : '');
    const views = (o.views && o.views.length > 1)
      ? `<div class="ds-views" role="group">${o.views.map((v, i) =>
          `<button class="ds-vchip" data-ds-view="${i}" aria-pressed="${i === (o.view || 0)}">${v}</button>`).join('')}</div>`
      : '';
    c.innerHTML = `<div class="ds-chead"><h2 class="ds-ctitle">${o.title}</h2><div class="ds-cbtns">
        ${o.table === false ? '' : '<button class="ds-tgl ds-tablebtn">Table</button>'}
        ${o.zoom ? `<button class="ds-tgl ds-zoombtn">${o.expanded ? '⤡ Close' : '⤢ Zoom'}</button>` : ''}
      </div></div>${views}
      <p class="ds-csub">${o.note || ''}</p>
      <div class="ds-plot"></div><div class="ds-legend">${o.legend || ''}</div><div class="ds-tv"></div>`;
    const tb = c.querySelector('.ds-tablebtn');
    if (tb) tb.addEventListener('click', () => c.classList.toggle('ds-table-on'));
    if (o.onZoom) { const z = c.querySelector('.ds-zoombtn'); if (z) z.addEventListener('click', o.onZoom); }
    if (o.onView) c.querySelectorAll('.ds-vchip').forEach(b =>
      b.addEventListener('click', () => o.onView(+b.dataset.dsView)));
    return c;
  };

  /* Tabs. Calls back with the key; you re-render. */
  DS.tabs = function (host, items, active, onChange) {
    host.innerHTML = items.map(([k, label]) =>
      `<button class="ds-tab" role="tab" data-ds-tab="${k}" aria-selected="${k === active}">${label}</button>`).join('');
    host.querySelectorAll('.ds-tab').forEach(b =>
      b.addEventListener('click', () => onChange(b.dataset.dsTab)));
  };

  /* A search box that re-renders the page and puts the caret back. Re-rendering
     destroys the input, so focus must be restored explicitly or typing stops
     after one character. */
  DS.search = function (input, onInput) {
    input.addEventListener('input', e => {
      const id = input.id, y = scrollY;
      onInput(e.target.value.trim());
      scrollTo(0, y);
      const n = id && document.getElementById(id);
      if (n) { n.focus(); n.setSelectionRange(n.value.length, n.value.length); }
    });
  };

  /* Theme toggle. Three-state: no attribute means follow the system. */
  DS.theme = {
    current() {
      const a = document.documentElement.getAttribute('data-theme');
      if (a) return a;
      return matchMedia && matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    },
    set(mode) { document.documentElement.setAttribute('data-theme', mode); },
    toggle() { const next = DS.theme.current() === 'dark' ? 'light' : 'dark'; DS.theme.set(next); return next; },
    /* Wire a button; its label always names what you would switch TO. */
    bind(btn) {
      const paint = () => { btn.textContent = DS.theme.current() === 'dark' ? 'Light' : 'Dark'; };
      paint();
      btn.addEventListener('click', () => { DS.theme.toggle(); paint(); btn.dispatchEvent(new CustomEvent('ds:theme', { bubbles: true })); });
    },
  };

  global.DS = DS;
})(window);
