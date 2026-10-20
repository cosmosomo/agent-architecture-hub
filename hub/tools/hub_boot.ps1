# Start, restart and watch the center (8899), and register it to start at logon.
# User 10-20: “然后系统可以有一些自检功能，然后做成开机自启吧”.
#
#   powershell -File hub/tools/hub_boot.ps1              start it if it is not running, self-check, then watch
#   powershell -File hub/tools/hub_boot.ps1 -Restart     wait until no turn is running, stop it, start it, self-check
#   powershell -File hub/tools/hub_boot.ps1 -Install     start at logon (a .vbs in the user's Startup folder)
#   powershell -File hub/tools/hub_boot.ps1 -Uninstall   stop starting at logon
#   -NoWatch   start (or restart) and self-check, then exit
#
# Watching: every 5 minutes; when nothing listens on 8899 two checks in a row, it starts the center again (at most
# 3 times in 30 minutes). A center that listens but does not answer is only logged: killing it would kill the turns
# it holds, so that stays a person's or the lead's call (selfcheck.js says what to do).
# It launches through WMI so the center is outside the job of whatever started this script (a terminal, an agent's
# shell): closing that does not take the center with it. Log: ~/.agent-hub/boot.log.
param([switch]$Restart, [switch]$Install, [switch]$Uninstall, [switch]$NoWatch)

$ErrorActionPreference = 'Continue'
# node writes UTF-8; Windows PowerShell would read it as the console code page.
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
# Local calls only, never through the system proxy. Windows PowerShell 5.1 has no -NoProxy (10-20: every probe
# failed on that and -Restart stopped waiting for running turns), so switch the default proxy off here.
[System.Net.WebRequest]::DefaultWebProxy = [System.Net.GlobalProxySelection]::GetEmptyWebProxy()
$root = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$hubHome = Join-Path $HOME '.agent-hub'
$port = 8899
$bootLog = Join-Path $hubHome 'boot.log'
$startup = Join-Path ([Environment]::GetFolderPath('Startup')) 'agent-hub-8899.vbs'
New-Item -ItemType Directory -Force $hubHome | Out-Null

function Log($msg) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $msg"
  Add-Content -Path $bootLog -Value $line -Encoding UTF8
  Write-Output $line
}

if ($Install) {
  $ps = "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""$root\hub\tools\hub_boot.ps1"""
  $vbsArg = $ps.Replace('"', '""')
  Set-Content -Path $startup -Value ('CreateObject("WScript.Shell").Run "' + $vbsArg + '", 0, False') -Encoding ASCII
  Log "已登记开机自启：$startup"
  # Start watching now too, outside this shell's job, instead of waiting for the next logon.
  $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $ps; CurrentDirectory = $root }
  Log "看守已在后台起来（进程 $($r.ProcessId)）"
  exit 0
}
if ($Uninstall) {
  if (Test-Path $startup) { Remove-Item $startup -Confirm:$false; Log "已取消开机自启：$startup" } else { Log '没有登记过开机自启' }
  exit 0
}

function Listener {
  $p = (Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue).OwningProcess | Select-Object -First 1
  if (-not $p) { return $null }
  $c = Get-CimInstance Win32_Process -Filter "ProcessId=$p"
  return [pscustomobject]@{ Id = $p; Ours = ($c.CommandLine -match 'main\.ts' -and $c.CommandLine -match "$port"); CommandLine = $c.CommandLine }
}

function Healthy([int]$timeoutSec = 5) {
  try { $null = Invoke-RestMethod "http://127.0.0.1:$port/api/health" -TimeoutSec $timeoutSec; return $true } catch { return $false }
}

function Start-Center {
  $node = (Get-Command node -ErrorAction SilentlyContinue).Source
  if (-not $node) { Log '启动失败：PATH 里找不到 node'; return $false }
  $lanFile = Join-Path $hubHome 'lan-host'
  $lan = if (Test-Path $lanFile) { (Get-Content $lanFile -Raw).Trim() } else { '' }
  $lanArg = if ($lan) { " --lan $lan" } else { '' }
  $out = Join-Path $hubHome "hub-$port.log"
  $err = Join-Path $hubHome "hub-$port.err.log"
  # A marker per start, so selfcheck.js counts only what this process wrote.
  $mark = "==== 启动 $(Get-Date -Format o) ===="
  Add-Content -Path $out -Value $mark -Encoding UTF8
  Add-Content -Path $err -Value $mark -Encoding UTF8
  $cmd = "cmd.exe /d /c `"`"$node`" --no-warnings=ExperimentalWarning `"$root\trace\apps\cli\src\main.ts`" serve --port $port$lanArg >> `"$out`" 2>> `"$err`"`""
  $r = Invoke-CimMethod -ClassName Win32_Process -MethodName Create -Arguments @{ CommandLine = $cmd; CurrentDirectory = $root }
  if ($r.ReturnValue -ne 0) { Log "启动失败：WMI 返回 $($r.ReturnValue)"; return $false }
  foreach ($i in 1..60) {
    Start-Sleep -Seconds 2
    if (Healthy 3) { Log "中心已起来（cmd 进程 $($r.ProcessId)$(if ($lan) { "，EasyTier 地址 $lan" })，用时 $($i * 2) 秒）"; return $true }
  }
  Log "启动失败：两分钟内 /api/health 没有回应，看 $err"
  return $false
}

function Self-Check {
  $r = & node "$root\hub\tools\selfcheck.js" 2>&1 | Select-Object -Last 1
  Log "$r"
}

if ($Restart) {
  # Wait (up to 2 hours) until no turn is running; Antigravity turns live in its desktop app and are picked up again.
  for ($i = 0; $i -lt 720; $i++) {
    try {
      $j = Invoke-RestMethod "http://127.0.0.1:$port/api/gateway/state" -TimeoutSec 10
      $busy = @($j.activeRuns.PSObject.Properties.Value | Where-Object { $_.status -eq 'running' -and $_.channel -ne 'antigravity' })
      if ($busy.Count -eq 0) { break }
      if ($i -eq 0) { Log "等 $($busy.Count) 个在跑的轮次结束再重启：$(($busy | ForEach-Object { "$($_.channel)/$($_.sessionName)" }) -join '，')" }
    } catch { break }
    Start-Sleep -Seconds 10
  }
  $l = Listener
  if ($l -and $l.Ours) { Stop-Process -Id $l.Id -Force; Log "已停掉旧的中心（进程 $($l.Id)）"; Start-Sleep -Seconds 2 }
  elseif ($l) { Log "端口 $port 被别的程序占着，没有动它：$($l.CommandLine)"; exit 1 }
  if (-not (Start-Center)) { exit 1 }
  Self-Check
} else {
  $l = Listener
  if ($l -and -not $l.Ours) { Log "端口 $port 被别的程序占着，没有启动：$($l.CommandLine)"; exit 1 }
  if ($l) { Log "中心已经在跑（进程 $($l.Id)），不重复启动" }
  elseif (-not (Start-Center)) { exit 1 }
  Self-Check
}
if ($NoWatch) { exit 0 }

# One watcher per machine: a second copy (a second logon, a manual run) just exits.
$created = $false
$mutex = [System.Threading.Mutex]::new($true, 'Local\agent-hub-8899-watch', [ref]$created)
if (-not $created) { exit 0 }
$missed = 0
$restarts = @()
$wasHung = $false
while ($true) {
  Start-Sleep -Seconds 300
  $l = Listener
  if (-not $l) {
    $missed++
    if ($missed -lt 2) { continue }
    $restarts = @($restarts | Where-Object { $_ -gt (Get-Date).AddMinutes(-30) })
    if ($restarts.Count -ge 3) { Log '中心 30 分钟内已经重新拉起 3 次还是不在，不再自动拉起，看 hub-8899.err.log'; break }
    Log '中心不在了（连续两次检查都没有进程在听 8899），重新拉起'
    $restarts += Get-Date
    $missed = 0
    if (Start-Center) { Self-Check }
    continue
  }
  $missed = 0
  if (-not $l.Ours) { continue }
  $ok = Healthy 20
  if (-not $ok -and -not $wasHung) { Log "中心在（进程 $($l.Id)）但 20 秒没回 /api/health：可能卡住，没有自动重启（会丢掉手上的轮次），跑 node hub/tools/selfcheck.js 看" }
  if ($ok -and $wasHung) { Log '中心恢复回应' }
  $wasHung = -not $ok
}
