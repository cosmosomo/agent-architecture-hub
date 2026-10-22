# -*- coding: utf-8 -*-
$ErrorActionPreference = 'Stop'
$env:SWC_NATIVE_BINDING_CACHE = "C:\Users\COLORFIRE\.swc-cache"
$env:PYTHONIOENCODING = "utf-8"

$Root = "E:\program\GIT\Agent\multi\Agent-Architecture-Hub\ppt_4pages"
$V2   = "$Root\主线\v2"
$Slidep = "C:\Users\COLORFIRE\.workbuddy\binaries\node\versions\22.22.2-6\slidep.cmd"
$CheckPy = "C:\Users\COLORFIRE\.claude\skills\slide-zh-plain\check.py"
$DensityPy = "C:\Users\COLORFIRE\.claude\skills\slide-zh-plain\density.py"
$Out  = "Agent_Architecture_Hub_介绍_4页.pptx"

Set-Location $Root

Write-Host "=== 1. Check 3x high-DPI visual panels ==="
if (-not (Test-Path "$Root\主线\img\orig_m3_projects.png")) {
    uv run --with playwright --with pillow python "$V2\build_assets.py"
}

Write-Host "=== 2. Generate .body and assemble .slide ==="
Remove-Item "$V2\body\*.body" -ErrorAction SilentlyContinue
Remove-Item "$V2\*.slide" -ErrorAction SilentlyContinue
uv run python "$V2\gen_bodies.py"
uv run python "$V2\make.py" 4

Write-Host "=== 3. Run slide-zh-plain check.py & density.py ==="
uv run python $CheckPy "$V2\body"
uv run python $DensityPy "$V2\body"

Write-Host "=== 4. Build PPTX via slidep ==="
if (Test-Path $Out) { Remove-Item $Out -Force }
& $Slidep create $Out | Out-Null
$pages = @(
    "主线\v2\01_问题背景.slide",
    "主线\v2\02_能力渠道.slide",
    "主线\v2\03_核心认知.slide",
    "主线\v2\04_系统界面.slide"
)
for ($i = 0; $i -lt $pages.Count; $i++) {
    Write-Host ("[{0}/{1}] {2}" -f ($i + 1), $pages.Count, $pages[$i])
    for ($try = 1; $try -le 4; $try++) {
        Start-Sleep -Milliseconds 250
        $r = & $Slidep upsert-dsl $Out --page-index $i --dsl-file $pages[$i] 2>&1 | Select-Object -Last 1
        if ($r -match '"ok":true') { break }
        Start-Sleep -Milliseconds 500
    }
    if ($r -notmatch '"ok":true') { throw "第 $($i+1) 页写入失败：$r" }
}

Write-Host "=== 5. Apply speaker notes & export PNGs ==="
uv run --with python-pptx --with lxml python "$V2\apply_notes.py" $Out "$V2\notes.json"
Copy-Item $Out "Agent_Architecture_Hub_介绍_详细版_4页.pptx" -Force
uv run --with pillow --with pywin32 python "$Root\主线\ppt_export.py" $Out "$V2\shots"
Write-Host "DONE -> $Root\$Out & Agent_Architecture_Hub_介绍_详细版_4页.pptx"
