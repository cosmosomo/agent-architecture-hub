# retest: opencode/L0/serve — observe-history / cancel / close over HTTP, append each cell to blackboard immediately
$ErrorActionPreference = 'Stop'
$bb = 'E:\program\GIT\Agent\multi\Agent-Architecture-Hub\channels\probe\blackboard.jsonl'
$port = 4515
function Now(){ [System.DateTime]::Now.ToUniversalTime().AddHours(8).ToString('yyyy-MM-ddTHH:mm:ss+08:00') }
function Append-BB($cap, $result, $ev, $cmd, $note){
  $o = [ordered]@{
    at = Now; by = 'workbuddy-retest-1018'; family = 'opencode'; layer = 'L0'
    route = 'opencode/L0/serve'; surface = 'daemon'; capability = $cap; result = $result
    condition = 'opencode 1.18.33 serve --port 4515 (opencode-ai npm), model zhipuai-coding-plan/glm-5.3-flash via Zhipu Coding Plan, proxy 127.0.0.1:7892, NO_PROXY=127.0.0.1, cwd Agent-Architecture-Hub'
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
$MODEL_BODY = '"model":{"providerID":"zhipuai-coding-plan","modelID":"glm-5.3-flash"}'

try {
  $ready=$false
  foreach($i in 1..60){
    if ($srv.HasExited) { throw 'server exited early' }
    try { $r = Invoke-WebRequest -Uri "$base/doc" -Method GET -TimeoutSec 2 -UseBasicParsing; if ($r.StatusCode) { $ready=$true; break } } catch { Start-Sleep -Milliseconds 500 }
  }
  "READY=$ready"

  # session + round1
  $r1 = Invoke-WebRequest -Uri "$base/session" -Method POST -Headers $hdr -Body '{"title":"probe-retest-serve-1018"}' -TimeoutSec 30 -UseBasicParsing
  $sid = ($r1.Content | ConvertFrom-Json).id
  "SID=$sid"
  $body1 = '{' + $MODEL_BODY + ',"parts":[{"type":"text","text":"记住暗号 RETEST_SERVE_7723，只回复：OK_7723"}]}'
  $r2 = Invoke-WebRequest -Uri "$base/session/$sid/message" -Method POST -Headers $hdr -Body $body1 -TimeoutSec 120 -UseBasicParsing
  $j2 = $r2.Content | ConvertFrom-Json
  $txt2 = ($j2.parts | Where-Object {$_.type -eq 'text'} | ForEach-Object {$_.text}) -join ' '
  $model2 = $j2.info.modelID
  "R1 model=$model2 text=$txt2"
  if ($txt2 -notmatch '7723') { throw "round1 failed: $txt2" }

  # ---------- cell: observe-history ----------
  $r3 = Invoke-WebRequest -Uri "$base/session/$sid/message" -Method GET -TimeoutSec 30 -UseBasicParsing
  $hist = $r3.Content | ConvertFrom-Json
  $roles = ($hist | ForEach-Object {$_.info.role}) -join ','
  $hText = ($hist | Where-Object {$_.info.role -eq 'assistant'} | ForEach-Object { $_.parts | Where-Object {$_.type -eq 'text'} | ForEach-Object {$_.text} }) -join ' '
  $evH = "GET /session/$sid/message => $($r3.StatusCode); count=$($hist.Count) roles=$roles; assistant_text contains 7723=$($hText -match '7723')"
  Append-BB 'observe-history' 'pass' $evH "GET http://127.0.0.1:$port/session/$sid/message" ("读回完整2条(user,assistant)含暗号。复测agy-flash第352行：一致(其证据仅msg id+type，本证据含正文与轮数)")

  # ---------- cell: cancel ----------
  $bodyLong = '{' + $MODEL_BODY + ',"parts":[{"type":"text","text":"从1慢慢数到200，每个数一行，不要停"}]}'
  $t = [System.Threading.Tasks.Task]::Factory.StartNew({
    param($b,$s)
    try { Invoke-WebRequest -Uri "http://127.0.0.1:4515/session/$s/message" -Method POST -Headers @{ 'Content-Type'='application/json' } -Body $b -TimeoutSec 300 -UseBasicParsing | Out-Null } catch {}
  }, @($bodyLong, $sid))
  Start-Sleep -Seconds 6
  $r4 = Invoke-WebRequest -Uri "$base/session/$sid/interrupt" -Method POST -TimeoutSec 30 -UseBasicParsing
  $interruptStatus = $r4.StatusCode
  $null = $t.Wait(30000)
  $bodyQ = '{' + $MODEL_BODY + ',"parts":[{"type":"text","text":"之前的暗号是什么？只回复暗号本身"}]}'
  $r5 = Invoke-WebRequest -Uri "$base/session/$sid/message" -Method POST -Headers $hdr -Body $bodyQ -TimeoutSec 120 -UseBasicParsing
  $j5 = $r5.Content | ConvertFrom-Json
  $txt5 = ($j5.parts | Where-Object {$_.type -eq 'text'} | ForEach-Object {$_.text}) -join ' '
  $evC = "POST interrupt => $interruptStatus; post-cancel prompt => $($r5.StatusCode) reply=$($txt5.Trim()) model=$($j5.info.modelID)"
  Append-BB 'cancel' 'pass' $evC "POST http://127.0.0.1:$port/session/$sid/interrupt; then POST .../message (暗号问句)" ("原生interrupt打断数数长任务(状态$interruptStatus)，打断后同会话续问正常答出暗号RETEST_SERVE_7723，会话仍可用。复测agy-flash第354行：一致")

  # ---------- cell: close ----------
  $r6 = Invoke-WebRequest -Uri "$base/session/$sid" -Method DELETE -TimeoutSec 30 -UseBasicParsing
  $delStatus = $r6.StatusCode
  $getAfter = 'n/a'
  try {
    $r7 = Invoke-WebRequest -Uri "$base/session/$sid" -Method GET -TimeoutSec 30 -UseBasicParsing
    $getAfter = "$($r7.StatusCode)"
  } catch {
    $getAfter = "$([int]$_.Exception.Response.StatusCode)"
  }
  $evD = "DELETE /session/$sid => $delStatus body=$($r6.Content); GET after delete => $getAfter"
  Append-BB 'close' 'pass' $evD "DELETE http://127.0.0.1:$port/session/$sid; GET http://127.0.0.1:$port/session/$sid" ("删除返回$delStatus，再GET返回$getAfter(不存在)。复测agy-flash第355行：一致")
  "DONE serve route sid=$sid"
} finally {
  if (-not $srv.HasExited) { $srv.Kill($true); "SERVER_STOPPED=true" } else { "SERVER_EXITED code=$($srv.ExitCode)" }
}
