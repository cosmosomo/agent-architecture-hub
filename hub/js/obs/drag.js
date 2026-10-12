/* HUB.obsDrag: move cards and frames by hand.
   The scene builders keep laying the graph out; a move is an offset on top of that layout, remembered per case and subject
   in this browser, and undone with one button.  A card moves by its own offset and by those of the frames it sits in, so
   dragging a department's frame carries its members.  The offsets are plain data ({key: [dx, dy]}), so an edit that writes
   a layout back to the case's documents can read them from here. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});

  var MOVABLE = { org: 1, process: 1 };       // the subjects the stage draws; the trace and trajectory layers have their own
  var PREFIX = 'hub.layout.';
  var slots = {};                              // "<case>|<subject>" -> {key: [dx, dy]}
  var raw = null;                              // the last scene as its builder made it
  var at = { caseId: null, subject: null };
  var onRedraw = null, onChange = null;

  function id(caseId, subject) { return caseId + '|' + subject; }
  function slot(caseId, subject) {
    var k = id(caseId, subject);
    if (!slots[k]) {
      try { slots[k] = JSON.parse(localStorage.getItem(PREFIX + k) || '{}'); } catch (e) { slots[k] = {}; }
    }
    return slots[k];
  }
  function save(caseId, subject) {
    var k = id(caseId, subject), m = slots[k] || {};
    try {
      if (Object.keys(m).length) localStorage.setItem(PREFIX + k, JSON.stringify(m)); else localStorage.removeItem(PREFIX + k);
    } catch (e) { /* storage blocked: the moves last for this visit */ }
  }

  /* the scene with this case's moves on top.  The bounding box stays the builder's: a move must not make the camera jump. */
  function apply(scene, caseId, subject) {
    raw = scene; at = { caseId: caseId, subject: subject };
    var moves = MOVABLE[subject] ? slot(caseId, subject) : null;
    if (!moves || !Object.keys(moves).length) return scene;
    var shift = function (o) {
      var dx = 0, dy = 0;
      [o.key].concat(o.anchor || []).forEach(function (k) { var v = moves[k]; if (v) { dx += v[0]; dy += v[1]; } });
      return dx || dy ? Object.assign({}, o, { x: o.x + dx, y: o.y + dy }) : o;
    };
    return Object.assign({}, scene, { cards: scene.cards.map(shift), frames: scene.frames.map(shift) });
  }

  function count(caseId, subject) { return MOVABLE[subject] ? Object.keys(slot(caseId, subject)).length : 0; }
  function reset() {
    if (!MOVABLE[at.subject]) return;
    slots[id(at.caseId, at.subject)] = {};
    save(at.caseId, at.subject);
    if (onRedraw) onRedraw(apply(raw, at.caseId, at.subject));
    if (onChange) onChange();
  }

  /* root: the element the cards and frames are in; hooks.redraw(scene): draw this scene now; hooks.changed(): a move was made or undone */
  function mount(root, hooks) {
    onRedraw = hooks.redraw; onChange = hooks.changed;
    var drag = null, swallow = false, frame = null;
    root.addEventListener('mousedown', function (e) {
      if (e.button !== 0 || !MOVABLE[at.subject] || !raw) return;
      if (e.target.closest('button, a, input, select')) return;        // the fold buttons keep their click
      var grip = e.target.closest('.ob-card, .ob-fh');
      var host = grip && grip.closest('[data-key]');
      if (!host) return;
      var key = host.getAttribute('data-key'), cur = slot(at.caseId, at.subject)[key] || [0, 0];
      drag = { key: key, x: e.clientX, y: e.clientY, k: HUB.camera.get().k, base: cur.slice(), moved: false };
    });
    document.addEventListener('mousemove', function (e) {
      if (!drag) return;
      var px = e.clientX - drag.x, py = e.clientY - drag.y;
      if (!drag.moved && Math.abs(px) + Math.abs(py) < 5) return;       // a click is not a move
      if (!drag.moved) { drag.moved = true; document.body.classList.add('ob-dragging'); }
      slot(at.caseId, at.subject)[drag.key] = [Math.round(drag.base[0] + px / drag.k), Math.round(drag.base[1] + py / drag.k)];
      if (frame === null) frame = requestAnimationFrame(function () { frame = null; if (raw) onRedraw(apply(raw, at.caseId, at.subject)); });
    });
    document.addEventListener('mouseup', function () {
      if (!drag) return;
      var moved = drag.moved;
      drag = null;
      document.body.classList.remove('ob-dragging');
      if (!moved) return;
      if (frame !== null) { cancelAnimationFrame(frame); frame = null; }
      if (raw) onRedraw(apply(raw, at.caseId, at.subject));          // the last position, whether or not a frame came
      save(at.caseId, at.subject);
      swallow = true; setTimeout(function () { swallow = false; }, 0);   // the click that ends a drag selects nothing
      if (onChange) onChange();
    });
    root.addEventListener('click', function (e) { if (swallow) { e.stopPropagation(); e.preventDefault(); } }, true);
    root.addEventListener('dblclick', function (e) { if (swallow) { e.stopPropagation(); e.preventDefault(); } }, true);
  }

  // the offsets as data: what an edit that writes a layout back would read, and what a test sets
  function moves(caseId, subject) { return JSON.parse(JSON.stringify(slot(caseId, subject))); }
  function put(caseId, subject, key, dx, dy) { slot(caseId, subject)[key] = [dx, dy]; save(caseId, subject); }

  HUB.obsDrag = { mount: mount, apply: apply, count: count, reset: reset, moves: moves, put: put };
})();
