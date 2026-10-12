/* HUB.catalog: the cases that live on disk, found by walking the directory listings under hub/cases/.
   There is nothing to register: put a folder or a file there and it shows up.

   What an entry is (a folder of md files, a hub-graph .json, ...) is decided by recognizers; the source that
   loads that kind registers one. A new kind of local source = one recognizer + one HUB.model.addSource.

   A folder whose name starts with "_" is shelved (the reference corpus): it is listed closed and read only when
   someone opens it. A folder with very many sub-folders is taken to hold one kind of thing, so only its first
   sub-folder is looked into. */
(function () {
  'use strict';
  var HUB = (window.HUB = window.HUB || {});

  var ROOT = 'hub/cases/';
  var BULK = 24;
  var recognizers = [];
  var entries = new Map();   // id -> { id, kind, path, title, parent }
  var nodes = new Map();     // folder path -> folder
  var root = group(null, '', false);
  var started = null;

  /* a recognizer: test(name, isDir, childNames | null) says whether an entry of this kind is here;
     title(entry) -> Promise<string> is optional. */
  function recognize(kind, test, title) { recognizers.push({ kind: kind, test: test, title: title || null }); }
  function classify(name, isDir, kids) {
    for (var i = 0; i < recognizers.length; i++) if (recognizers[i].test(name, isDir, kids)) return recognizers[i];
    return null;
  }

  function group(parent, name, shelved) {
    var g = { name: name, path: parent ? parent.path + encodeURIComponent(name) + '/' : ROOT, parent: parent, groups: [], entries: [], shelved: shelved, loaded: false, loading: null };
    nodes.set(g.path, g);
    return g;
  }
  function addEntry(parent, rec, name, isDir) {
    var id = isDir ? name : name.replace(/\.[^.]+$/, '');
    if (entries.has(id)) return;
    var e = { id: id, kind: rec.kind, path: parent.path + encodeURIComponent(name) + (isDir ? '/' : ''), title: id, parent: parent, rec: rec };
    entries.set(id, e);
    parent.entries.push(e);
  }

  /* a directory listing as a static server writes it: <a href="name/"> for folders, <a href="name"> for files */
  function list(path) {
    return fetch(path, { cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : ''; }).catch(function () { return ''; }).then(function (html) {
      var out = [], re = /href="([^"?#]+)"/g, m;
      while ((m = re.exec(html))) {
        var h = m[1];
        if (h.charAt(0) === '/' || h.charAt(0) === '.' || h.indexOf(':') >= 0) continue;
        var dir = h.slice(-1) === '/';
        try { out.push({ name: decodeURIComponent(dir ? h.slice(0, -1) : h), dir: dir }); } catch (e) { /* not a name */ }
      }
      return out;
    });
  }
  function look(parent, name) {
    return list(parent.path + encodeURIComponent(name) + '/').then(function (kids) {
      return classify(name, true, kids.map(function (k) { return k.name; }));
    });
  }

  /* read one folder: files are classified by name, folders by what is inside them; shelved folders are only noted */
  function walk(node) {
    if (node.loaded) return Promise.resolve(node);
    if (node.loading) return node.loading;
    node.loading = list(node.path).then(function (items) {
      items.filter(function (i) { return !i.dir; }).forEach(function (f) { var r = classify(f.name, false, null); if (r) addEntry(node, r, f.name, false); });
      var dirs = items.filter(function (i) { return i.dir; });
      dirs.filter(function (d) { return d.name.charAt(0) === '_'; }).forEach(function (d) { node.groups.push(group(node, d.name, true)); });
      var open = dirs.filter(function (d) { return d.name.charAt(0) !== '_'; });
      var like = open.length > BULK ? look(node, open[0].name) : Promise.resolve(null);
      return like.then(function (rec) {
        return Promise.all(open.map(function (d) {
          if (rec) { addEntry(node, rec, d.name, true); return null; }
          return look(node, d.name).then(function (r) {
            if (r) addEntry(node, r, d.name, true);
            else { var g = group(node, d.name, false); node.groups.push(g); return walk(g); }
          });
        }));
      });
    }).then(function () {
      node.loaded = true; node.loading = null;
      HUB.bus.emit('catalog', { node: node });
      return node;
    });
    return node.loading;
  }

  /* titles are read for what is in view (not in shelved folders); the rest is shown by name */
  function titles(node) {
    var jobs = node.entries.filter(function (e) { return e.rec.title; }).map(function (e) {
      return e.rec.title(e).then(function (t) { if (t) e.title = t; }).catch(function () {});
    });
    node.groups.forEach(function (g) { if (!g.shelved) jobs.push(titles(g)); });
    return Promise.all(jobs);
  }

  function ready() {
    if (!started) started = walk(root).then(function () { return titles(root); }).then(function () { HUB.bus.emit('catalog', { node: root }); }).catch(function () {});
    return started;
  }

  function shelf(node) {
    for (var i = 0; i < node.groups.length; i++) {
      var g = node.groups[i];
      if (g.shelved && !g.loaded) return g;
      var deeper = g.loaded ? shelf(g) : null;
      if (deeper) return deeper;
    }
    return null;
  }
  /* an id that is not known yet (a link into the reference corpus): open the shelved folders one by one until it turns up */
  function find(id) {
    return ready().then(function seek() {
      if (entries.has(id)) return entries.get(id);
      var next = shelf(root);
      return next ? walk(next).then(seek) : null;
    });
  }
  function count(node) {
    var n = node.entries.length;
    node.groups.forEach(function (g) { n += count(g); });
    return n;
  }

  HUB.catalog = { recognize: recognize, ready: ready, entry: function (id) { return entries.get(id) || null; }, find: find, open: walk, root: function () { return root; }, node: function (path) { return nodes.get(path) || null; }, count: count, ROOT: ROOT };
})();
