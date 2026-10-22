# -*- coding: utf-8 -*-
$ErrorActionPreference = 'Stop'
$env:SWC_NATIVE_BINDING_CACHE = "C:\Users\COLORFIRE\.swc-cache"
$env:PYTHONIOENCODING = "utf-8"

$Root = "E:\program\GIT\Agent\multi\Agent-Architecture-Hub\ppt_4pages"
$V2S  = "$Root\主线\v2_simple"
$Slidep = "C:\Users\COLORFIRE\.workbuddy\binaries\node\versions\22.22.2-6\slidep.cmd"
$CheckPy = "C:\Users\COLORFIRE\.claude\skills\slide-zh-plain\check.py"
$DensityPy = "C:\Users\COLORFIRE\.claude\skills\slide-zh-plain\density.py"
$Out  = "Agent_Architecture_Hub_介绍_简化版_6页.pptx"
$Out10 = "Agent_Architecture_Hub_介绍_主讲6页+补充4页.pptx"

Set-Location $Root

# Clean up obsolete legacy PPTX variants so only 简化版 and 补充页 remain
Remove-Item "Agent_Architecture_Hub_介绍_4页.pptx", "Agent_Architecture_Hub_介绍_详细版_4页.pptx", "Agent_Architecture_Hub_介绍_技术卡片版_6页.pptx", "Agent_Architecture_Hub_介绍_简化版_5页.pptx", "Agent_Architecture_Hub_介绍_主讲5页+补充3页.pptx", "Agent_Architecture_Hub_介绍_主讲5页+补充4页.pptx", "Agent_Architecture_Hub_介绍_主讲6页+补充3页.pptx" -ErrorAction SilentlyContinue

Write-Host "=== 1. Generate .body and assemble .slide ==="
Remove-Item "$V2S\body\*.body" -ErrorAction SilentlyContinue
Remove-Item "$V2S\*.slide" -ErrorAction SilentlyContinue
uv run python "$V2S\gen_bodies.py"
uv run python "$V2S\make.py" 6

Write-Host "=== 2. Run slide-zh-plain check.py & density.py ==="
uv run python $CheckPy "$V2S\body"
uv run python $DensityPy "$V2S\body"

Write-Host "=== 3. Build 6-Page Main PPTX via slidep ==="
if (Test-Path $Out) { Remove-Item $Out -Force }
& $Slidep create $Out | Out-Null
$pages6 = @(
    "主线\v2_simple\01_立题与路线.slide",
    "主线\v2_simple\02_能力单元与渠道体系.slide",
    "主线\v2_simple\03_协作拓扑与契约编排.slide",
    "主线\v2_simple\04_跨产品接入与宿主分工.slide",
    "主线\v2_simple\05_轨迹追溯与受控恢复.slide",
    "主线\v2_simple\06_实机协同界面.slide"
)
for ($i = 0; $i -lt $pages6.Count; $i++) {
    Write-Host ("[{0}/{1}] {2}" -f ($i + 1), $pages6.Count, $pages6[$i])
    for ($try = 1; $try -le 6; $try++) {
        Start-Sleep -Milliseconds 300
        $r = & $Slidep upsert-dsl $Out --page-index $i --dsl-file $pages6[$i] 2>&1 | Select-Object -Last 1
        if ($r -match '"ok":true') { break }
        Start-Sleep -Milliseconds 1500
    }
    if ($r -notmatch '"ok":true') { throw "第 $($i+1) 页写入失败：$r" }
}

Write-Host "=== 4. Apply speaker notes & native crops (6-Page Main) ==="
uv run --with python-pptx --with lxml python "$V2S\apply_notes.py" $Out "$V2S\notes.json"
Write-Host "DONE -> $Root\$Out"

Write-Host "=== 5. Build 10-Page Main+Backup (6主讲 + 4补充深潜) PPTX ==="
uv run python "$V2S\make.py" 10
if (Test-Path $Out10) { Remove-Item $Out10 -Force }
& $Slidep create $Out10 | Out-Null
$pages10 = @(
    "主线\v2_simple\01_立题与路线.slide",
    "主线\v2_simple\02_能力单元与渠道体系.slide",
    "主线\v2_simple\03_协作拓扑与契约编排.slide",
    "主线\v2_simple\04_跨产品接入与宿主分工.slide",
    "主线\v2_simple\05_轨迹追溯与受控恢复.slide",
    "主线\v2_simple\06_实机协同界面.slide",
    "主线\v2_simple\07_补充B1_开源对比.slide",
    "主线\v2_simple\08_补充B2_能力矩阵与状态机.slide",
    "主线\v2_simple\09_补充B3_原语与排障详单.slide",
    "主线\v2_simple\10_补充B4_复合拓扑与交接契约.slide"
)
for ($i = 0; $i -lt $pages10.Count; $i++) {
    Write-Host ("[{0}/{1}] {2}" -f ($i + 1), $pages10.Count, $pages10[$i])
    for ($try = 1; $try -le 6; $try++) {
        Start-Sleep -Milliseconds 300
        $r = & $Slidep upsert-dsl $Out10 --page-index $i --dsl-file $pages10[$i] 2>&1 | Select-Object -Last 1
        if ($r -match '"ok":true') { break }
        Start-Sleep -Milliseconds 1500
    }
    if ($r -notmatch '"ok":true') { throw "第 $($i+1) 页写入失败：$r" }
}
uv run --with python-pptx --with lxml python "$V2S\apply_notes.py" $Out10 "$V2S\notes.json"
Remove-Item "$V2S\shots\p*.png" -ErrorAction SilentlyContinue
uv run --with pillow --with pywin32 python "$Root\主线\ppt_export.py" $Out10 "$V2S\shots"
uv run python "$V2S\make.py" 6
Write-Host "DONE -> $Root\$Out10"

