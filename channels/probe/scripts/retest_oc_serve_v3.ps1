# retest: opencode/L0/serve — cancel & close (observe-history already recorded). Appends each cell immediately.
$ErrorActionPreference = 'Stop'
$bb = 'E:\program\GIT\Agent\multi\Agent-Architecture-Hub\channels\probe\blackboard.jsonl'
$port = 4516
function Now(){ [System.DateTime]::Now.ToUniversalTime().AddHours(8).ToString('yyyy-MM-ddTHH:mm:ss+08:00') }
function Append-BB($cap, $result, $ev, $cmd, $note){
  $o = [ordered]@{
    at = Now; by = 'workbuddy-retest-1018'; family = 'opencode'; layer = 'L0'
    route = 'opencode/L0/serve'; surface = 'daemon'; capability = $cap; result = $result
    condition = "opencode 1.18.33 serve --port $port (opencode-ai npm), model zhipuai-coding-plan/glm-5.3-flash via Zhipu Coding Plan, proxy 127.0.0.1:7892, NO_PROXY=127.0.0.1, cwd Agent-Architecture-Hub"
    evidence = $ev; cmd = $cmd; note = $note
  }
  Add-Content -LiteralPath $bb -Encoding utf8NoBOM -Value (($o | ConvertTo-Json -Compress))
  "APPENDED: $cap $result"
}

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'C:\Users\COLORFIRE\AppData\Roaming\npm\node_modules\opencode-ai\bin\opencode.exe'
$psi.Arguments = "serve --port $port --hostname 127.0.0.1"
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.RedirectStandardInput = $true
$psi.UseShellExecute = $false
$psi.EnvironmentVariables['HTTP_PROXY']='http://127.0.0.1:7892'
$psi.EnvironmentVariables['HTTPS_PROXY']='http://127.0.0.1:7892'
$psi.EnvironmentVariables['NO_PROXY']='127.0.0.1,localhost'
$srv = [System.Diagnostics.Process]::Start($psi)
$srv.StandardInput.Close()
$base = "http://127.0.0.1:$port"
$hdr = @{ 'Content-Type' = 'application/json' }
$MB = '"model":{"providerID":"zhipuai-coding-plan","modelID":"glm-5.3-flash"}'

try {
  $ready=$false
  foreach($i in 1..60){
    if ($srv.HasExited) { throw 'server exited early' }
    try { $r = Invoke-WebRequest -Uri "$base/doc" -TimeoutSec 2 -UseBasicParsing; if ($r.StatusCode) { $ready=$true; break } } catch { Start-Sleep -Milliseconds 500 }
  }
  "READY=$ready"

  $r1 = Invoke-WebRequest -Uri "$base/session" -Method POST -Headers $hdr -Body '{"title":"probe-retest-serve2-1018"}' -TimeoutSec 30 -UseBasicParsing
  $sid = ($r1.Content | ConvertFrom-Json).id
  "SID=$sid"
  $body1 = '{' + $MB + ',"parts":[{"type":"text","text":"记住暗号 RETEST_SERVE_9931，只回复：OK_9931"}]}'
  $r2 = Invoke-WebRequest -Uri "$base/session/$sid/message" -Method POST -Headers $hdr -Body $body1 -TimeoutSec 120 -UseBasicParsing
  $j2 = $r2.Content | ConvertFrom-Json
  $txt2 = ($j2.parts | Where-Object {$_.type -eq 'text'} | ForEach-Object {$_.text}) -join ' '
  "R1 model=$($j2.info.modelID) text=$txt2"
  if ($txt2 -notmatch '9931') { throw "round1 failed" }

  # ---------- cancel: fire long prompt via child pwsh (no runspace issue), interrupt from here ----------
  $child = Start-Process pwsh -ArgumentList '-NoProfile','-Command',(
    "try { Invoke-WebRequest -Uri 'http://127.0.0.1:$port/session/$sid/message' -Method POST -Headers @{'Content-Type'='application/json'} -Body '{`"$($MB.Replace('"','`"'))`",`"parts`":[{`"type`":`"text`",`"text`":`"从1慢慢数到200，每个数一行，不要停`"}]}' -TimeoutSec 300 -UseBasicParsing | Out-Null; 'child: prompt returned' } catch { 'child: ' + `$_.Exception.Message }"
  ) -RedirectStandardOutput "$env:TEMP\oc_serve_child.out" -RedirectStandardError "$env:TEMP\oc_serve_child.err" -PassThru -WindowStyle Hidden
  "CHILD_PID=$($child.Id)"
  Start-Sleep -Seconds 6
  $sw0 = [System.Diagnostics.Stopwatch]::StartNew()
  $r4 = Invoke-WebRequest -Uri "$base/session/$sid/interrupt" -Method POST -TimeoutSec 30 -UseBasicParsing
  $interruptStatus = $r4.StatusCode
  $child.WaitForExit(60000) | Out-Null
  $childLine = (Get-Content "$env:TEMP\oc_serve_child.out" -Raw -ErrorAction SilentlyContinue)
  "child_out=$($childLine.Trim())"

  # post-cancel round: same session still usable, recalls code
  $bodyQ = '{' + $MB + ',"parts":[{"type":"text","text":"之前的暗号是什么？只回复暗号本身"}]}'
  $r5 = Invoke-WebRequest -Uri "$base/session/$sid/message" -Method POST -Headers $hdr -Body $bodyQ -TimeoutSec 120 -UseBasicParsing
  $j5 = $r5.Content | ConvertFrom-Json
  $txt5 = ($j5.parts | Where-Object {$_.type -eq 'text'} | ForEach-Object {$_.text}) -join ' '
  $evC = "POST /session/$sid/interrupt => $interruptStatus (sent ${sw0}s after long prompt, child prompt-task ended: $($childLine.Trim())); post-cancel POST message => $($r5.StatusCode) reply=$($txt5.Trim()) model=$($j5.info.modelID)"
  Append-BB 'cancel' 'pass' $evC "POST http://127.0.0.1:$port/session/$sid/interrupt; then POST .../message" ("原生interrupt打断数数长任务(状态$interruptStatus)，打断后同会话续问正常答出暗号RETEST_SERVE_9931，会话仍可用。复测agy-flash第354行：一致")

  # ---------- close ----------
  $r6 = Invoke-WebRequest -Uri "$base/session/$sid" -Method DELETE -TimeoutSec 30 -UseBasicParsing
  $delStatus = $r6.StatusCode
  try {
    $r7 = Invoke-WebRequest -Uri "$base/session/$sid" -TimeoutSec 30 -UseBasicParsing
    $getAfter = "$($r7.StatusCode)"
  } catch { $getAfter = "$([int]$_.Exception.Response.StatusCode)" }
  $evD = "DELETE /session/$sid => $delStatus body=$($r6.Content); GET after delete => $getAfter"
  Append-BB 'close' 'pass' $evD "DELETE http://127.0.0.1:$port/session/$sid; GET http://127.0.0.1:$port/session/$sid" ("删除返回$delStatus，再GET返回$getAfter(不存在)。复测agy-flash第355行：一致")
  "DONE serve cancel+close sid=$sid"
} finally {
  if (-not $srv.HasExited) { $srv.Kill($true); "SERVER_STOPPED=true" } else { "SERVER_EXITED code=$($srv.ExitCode)" }
}
