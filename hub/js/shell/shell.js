/* HUB.shell: the page around the canvas.
   The tabs of the left sidebar (each module adds its own page), the toast, the light/dark theme, the logo and the starfield
   behind the canvas.  Nothing in here knows what a case or a session is. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});
  var h = HUB.util.h;

  /* ---------- the sidebar's tabs ---------- */
  var pages = {}, order = [], current = null, listeners = [];
  var bar = null, host = null;

  function select(id) {
    if (!pages[id]) return;
    current = id;
    order.forEach(function (k) {
      var on = k === id;
      pages[k].tab.classList.toggle('on', on);
      pages[k].tab.setAttribute('aria-selected', on ? 'true' : 'false');
      pages[k].panel.classList.toggle('on', on);
    });
    listeners.forEach(function (fn) { fn(id); });
  }
  // add a tab and get its page; the first tab added is the one shown
  function addTab(spec) {
    var panel = h('div', { class: 'sl-pan' + (spec.cls ? ' ' + spec.cls : ''), id: 'pan-' + spec.id });
    var tab = h('button', { type: 'button', class: 'sl-tab', role: 'tab', 'aria-selected': 'false', title: spec.title || null, onClick: function () { select(spec.id); } }, spec.label);
    bar.appendChild(tab); host.appendChild(panel);
    pages[spec.id] = { tab: tab, panel: panel };
    order.push(spec.id);
    if (current === null) select(spec.id);
    return panel;
  }

  /* ---------- toast ---------- */
  var toastTimer = null;
  function toast(msg) {
    var el = document.getElementById('toast');
    el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 2500);
  }

  /* ---------- theme ---------- */
  function theme() { return document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark'; }
  // the button shows what a click gives: the sun in the dark theme, the moon in the light one
  function paintToggle() { document.getElementById('themeToggle').textContent = theme() === 'light' ? '☾' : '☀'; }
  function setTheme(t) {
    if (t === 'light') document.documentElement.setAttribute('data-theme', 'light'); else document.documentElement.removeAttribute('data-theme');
    paintToggle();
    try { localStorage.setItem('hub.theme', t); } catch (e) { /* private window */ }
    HUB.bus.emit('theme', { theme: t });
  }

  /* ---------- logo: six satellites around a warm centre, one colour each ---------- */
  function logoSVG(gid, viewBox) {
    var colors = ['#818CF8', '#06B6D4', '#A855F7', '#60A5FA', '#F87171', '#E879F9'], spokes = '', dots = '';
    for (var i = 0; i < 6; i++) {
      var a = (-90 + 60 * i) * Math.PI / 180, x = (24 + 15 * Math.cos(a)).toFixed(2), y = (24 + 15 * Math.sin(a)).toFixed(2);
      spokes += '<line x1="24" y1="24" x2="' + x + '" y2="' + y + '" stroke="' + colors[i] + '" stroke-width="2.1" stroke-linecap="round" opacity="0.5"/>';
      dots += '<circle cx="' + x + '" cy="' + y + '" r="3.5" fill="' + colors[i] + '"/>';
    }
    return '<svg viewBox="' + (viewBox || '0 0 48 48') + '" xmlns="http://www.w3.org/2000/svg"><defs><radialGradient id="' + gid + '" cx="40%" cy="35%"><stop offset="0" stop-color="#fff5db"/><stop offset="1" stop-color="#FBBF24"/></radialGradient></defs>' +
      spokes + dots + '<circle cx="24" cy="24" r="6.6" fill="url(#' + gid + ')"/></svg>';
  }
  function setFavicon() {
    var link = document.createElement('link');
    link.rel = 'icon'; link.type = 'image/svg+xml';
    link.href = 'data:image/svg+xml,' + encodeURIComponent(logoSVG('fav', '5 5 38 38'));
    document.head.appendChild(link);
  }

  /* ---------- starfield: a few hundred stars that twinkle behind the canvas ---------- */
  function starfield(canvas, area) {
    var ctx = canvas.getContext('2d'), stars = [], raf = null;
    var still = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function size() {
      canvas.width = area.offsetWidth; canvas.height = area.offsetHeight;
      stars = [];
      for (var i = Math.floor(canvas.width * canvas.height / 3500); i > 0; i--) stars.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: Math.random() * 1.3 + 0.2, a: Math.random() * 0.5 + 0.1, speed: Math.random() * 0.004 + 0.001, phase: Math.random() * Math.PI * 2 });
      if (still) draw(0);
    }
    function draw(t) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      stars.forEach(function (s) {
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(200,210,255,' + Math.max(0.03, still ? s.a : s.a + Math.sin(t * s.speed + s.phase) * 0.2) + ')';
        ctx.fill();
      });
      if (!still) raf = requestAnimationFrame(draw);
    }
    size();
    window.addEventListener('resize', size);
    if (still) return;
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) { if (raf) { cancelAnimationFrame(raf); raf = null; } } else if (!raf) raf = requestAnimationFrame(draw);
    });
    raf = requestAnimationFrame(draw);
  }

  function start() {
    var area = document.getElementById('cvA');
    bar = document.getElementById('slTabs'); host = document.getElementById('slPanels');
    document.getElementById('tbLogo').innerHTML = logoSVG('lgTop');
    setFavicon();
    document.getElementById('themeToggle').addEventListener('click', function () { setTheme(theme() === 'light' ? 'dark' : 'light'); });
    paintToggle();
    // opened from a plain static server (or from disk): there is no service behind the page, say so
    fetch('api/health', { cache: 'no-store' }).then(function (r) { if (!r.ok) throw new Error('no service'); })
      .catch(function () { document.getElementById('svcNote').hidden = false; });
    starfield(document.getElementById('starfield'), area);
    HUB.camera.mount(area, document.getElementById('cvT'), { ignore: '.ob-float, .ob-tl, .zm-ctrl, .ob-card, .ob-fh, .ob-hit, .ob-tog, .ob-trace, .ob-collab, .ob-panelhost' });
  }

  HUB.shell = {
    start: start, toast: toast, theme: theme,
    tabs: { add: addTab, show: select, current: function () { return current; }, onChange: function (fn) { listeners.push(fn); } }
  };
})();
