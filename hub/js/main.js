/* Boot: restore the observation state from the link, build the model, wire store -> shell. */
(function () {
  'use strict';
  var HUB = window.HUB;

  function start() {
    var patch = HUB.store.fromHash(location.hash || '');
    if (!patch.caseId || !HUB.base.presets[patch.caseId]) patch.caseId = HUB.store.DEFAULT.caseId;
    HUB.store.init(patch);
    var s = HUB.store.get();
    HUB.model.select(s.caseId);
    if (!patch.subject && !patch.depth) {
      // First visit: start from the department view of the flagship case.
      HUB.store.init(Object.assign({}, patch, HUB.views.get('v2').apply(s, HUB.model.current)));
    }
    HUB.shell.init(document.getElementById('app'));

    HUB.store.subscribe(function (state, prev) {
      if (!prev || state.caseId !== prev.caseId) HUB.model.select(state.caseId);
      HUB.shell.update(state, prev);
    });
    HUB.bus.on('model', function () {
      var st = HUB.store.get();
      HUB.shell.update(st, st);
    });
    var st0 = HUB.store.get();
    HUB.shell.update(st0, null);
    setTimeout(function () { HUB.shell.fit(); }, 60);
    window.addEventListener('resize', function () { clearTimeout(start._rz); start._rz = setTimeout(function () { HUB.shell.update(HUB.store.get(), HUB.store.get()); }, 150); });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
  else start();
})();
