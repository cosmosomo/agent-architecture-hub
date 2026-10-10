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
    'hub/data/cases/deep_five_minds.js', 'hub/data/cases/feature_sprint.js',
    'hub/data/cases/incident_war_room.js', 'hub/data/cases/deep_research_v2.js',
    'hub/js/core/util.js', 'hub/js/core/store.js', 'hub/js/core/casedef.js', 'hub/js/core/sim.js',
    'hub/js/core/analysis.js', 'hub/js/core/model.js', 'hub/js/core/views.js',
    'hub/js/obs/cards.js', 'hub/js/obs/stage.js', 'hub/js/obs/scene-org.js',
    'hub/js/obs/scene-process.js', 'hub/js/obs/scene-run.js',
    'hub/js/panels/panels.js', 'hub/js/obs/panel.js', 'hub/js/obs/side.js', 'hub/js/obs/timeline.js',
    'hub/js/obs/guide.js', 'hub/js/obs/sessions.js', 'hub/js/obs/main.js',
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
