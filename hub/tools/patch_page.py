"""patch_page.py - adds the observation-mode hooks to the original page (index.html at the repo root).

Every change is marked /* hub */ (or <!-- hub -->) and the script is idempotent: running it again
only refreshes the script list at the end of the body.
Usage: python hub/tools/patch_page.py
"""
import io
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
PAGE = os.path.join(ROOT, 'index.html')

SCRIPTS = [
    'hub/data/base.js', 'hub/data/zh.js',
    # hub/data/cases/*.js (archived v41 curated overrides) are no longer loaded:
    # the hub/cases/ Markdown source owns those case ids via HUB.model.addSource('docs')
    'hub/js/core/util.js', 'hub/js/core/store.js', 'hub/js/core/casedef.js', 'hub/js/core/sim.js',
    'hub/js/core/analysis.js', 'hub/js/core/model.js', 'hub/js/core/from-docs.js', 'hub/js/core/from-hub-graph.js',
    'hub/js/core/to-trace.js', 'hub/js/core/from-trace.js', 'hub/js/core/views.js',
    'hub/js/obs/cards.js', 'hub/js/obs/stage.js', 'hub/js/obs/scene-org.js',
    'hub/js/obs/scene-process.js', 'hub/vendor/hub-trace.js',
    'hub/js/panels/panels.js', 'hub/js/obs/panel.js', 'hub/js/obs/side.js', 'hub/js/obs/timeline.js',
    'hub/js/obs/guide.js', 'hub/js/obs/sessions.js', 'hub/js/obs/trace.js', 'hub/js/obs/main.js',
]
STYLES = ['hub/css/obs.css', 'hub/css/panels.css']

HOOKS = [
    # keep the observation layer under the same pan and zoom as the editor's canvas
    ("function zastTransf(){cvT.style.transform='translate('+panX+'px,'+panY+'px) scale('+scale+')';",
     "function zastTransf(){cvT.style.transform='translate('+panX+'px,'+panY+'px) scale('+scale+')';"
     "/* hub */var obT=G('obsT');if(obT)obT.style.transform=cvT.style.transform;"),
    # a preset picked in the list becomes the observed case; no splash screen while observing
    ("if(pid==='deep_five_minds')pokazHero(pid)}",
     "/* hub */if(window.HUB&&HUB.obs)HUB.obs.onPreset(pid);"
     "if(pid==='deep_five_minds'&&!document.body.classList.contains('obs-on'))pokazHero(pid)}"),
    # the guided tour points at editor controls, so it does not start by itself while observing
    ("function tutAutoDozwolony(){",
     "function tutAutoDozwolony(){/* hub */if(document.body.classList.contains('obs-on'))return false;"),
    # v41 defaults non-zh browsers to Polish; this derivative ships to Chinese users - default to zh.
    # A stored choice (from the language toggle) is still honoured; only the fallback changes.
    ("return v})() || (function(){\n  try{\n    var n=(navigator.languages&&navigator.languages[0])||navigator.language||'';\n    return /^zh/i.test(n)?'zh':'pl';\n  }catch(e){return 'zh'}\n})();",
     "return v})() || 'zh'; /* hub: 中文用户的衍生版，缺省一律中文，原版非 zh 浏览器会落到波兰语 */"),
    # locally auto-discovered cases (hub/cases/ dirs + hub/graph/*.json) are not among the 62
    # presets, so rPresety never lists them; append a section of their own to the preset list.
    ("if(_items===0){",
     "/* hub */if(window.HUB&&HUB.obs&&HUB.obs.localCases){h+=HUB.obs.localCases(prSearch,prCatFilter.size===0);}\n  if(_items===0){"),
]


def main():
    src = io.open(PAGE, encoding='utf-8').read()
    for old, new in HOOKS:
        if new in src:
            continue
        if src.count(old) != 1:
            raise SystemExit('hook anchor not found exactly once: ' + old[:60])
        src = src.replace(old, new)
    block = ['<!-- hub: observation mode, see hub/SPEC.md -->']
    block += ['<link rel="stylesheet" href="%s">' % s for s in STYLES if os.path.exists(os.path.join(ROOT, s))]
    block += ['<script src="%s"></script>' % s for s in SCRIPTS if os.path.exists(os.path.join(ROOT, s))]
    block.append('<!-- /hub -->')
    nl = '\r\n' if '\r\n' in src[:400] else '\n'   # the page uses CRLF; keep it that way
    text = nl.join(block) + nl
    src = re.sub(r'<!-- hub: observation mode.*?<!-- /hub -->\r?\n', '', src, flags=re.S)
    idx = src.rindex('</body>')
    src = src[:idx] + text + src[idx:]
    io.open(PAGE, 'w', encoding='utf-8', newline='').write(src)
    print('patched %s: %d hooks, %d styles, %d scripts' % (PAGE, len(HOOKS), text.count('<link'), text.count('<script')))


if __name__ == '__main__':
    main()
