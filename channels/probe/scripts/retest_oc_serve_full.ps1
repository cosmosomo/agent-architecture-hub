# retest: opencode/L0/serve — observe-history / cancel / close over HTTP API (full flow)
$ErrorActionPreference = 'Stop'
$port = 4512
$logFile = "$env:TEMP\retest_oc_serve_full.log"
Remove-Item -LiteralPath $logFile -ErrorAction SilentlyContinue
function Log($m){ Add-Content -LiteralPath $logFile -Value $m; $m }

$psi = New-Object System.Diagnostics.ProcessStartInfo
$psi.FileName = 'C:\Users\COLORFIRE\AppData\Roaming\npm\node_modules\opencode-ai\bin\opencode.exe'
$psi.Arguments = "serve --port $port --hostname 127.0.0.1 --print-logs --log-level DEBUG"
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

try {
  $ready = $false
  foreach($i in 1..40){
    if ($srv.HasExited) { throw "server exited early" }
    try { $r = Invoke-WebRequest -Uri "$base/doc" -Method GET -TimeoutSec 2 -UseBasicParsing; if ($r.StatusCode) { $ready=$true; break } } catch { Start-Sleep -Milliseconds 500 }
  }
  Log "READY=$ready"

  # create session
  $r1 = Invoke-WebRequest -Uri "$base/session" -Method POST -Headers $hdr -Body '{"title":"probe-retest-serve-full-1018"}' -TimeoutSec 30 -UseBasicParsing
  $sid = ($r1.Content | ConvertFrom-Json).id
  Log "SESSION_ID=$sid"

  # prompt round 1 (blocking) — remembers code
  $body1 = '{"modelID":"zhipuai-coding-plan/glm-5.3-flash","parts":[{"type":"text","text":"记住暗号 RETEST_SERVE_7723，只回复：OK_7723"}]}'
  $r2 = Invoke-WebRequest -Uri "$base/session/$sid/message" -Method POST -Headers $hdr -Body $body1 -TimeoutSec 90 -UseBasicParsing
  $j2 = $r2.Content | ConvertFrom-Json
  Log "R1_STATUS=$($r2.StatusCode) R1_INFO_MODEL=$($j2.info.modelID)"
  Log "R1_TEXT=$(($j2.parts | Where-Object {$_.type -eq 'text'} | ForEach-Object {$_.text}) -join ' ')"

  # observe-history: GET /session/{id}/message
  $r3 = Invoke-WebRequest -Uri "$base/session/$sid/message" -Method GET -TimeoutSec 30 -UseBasicParsing
  $hist = $r3.Content | ConvertFrom-Json
  $roles = ($hist | ForEach-Object {$_.info.role}) -join ','
  Log "HISTORY_STATUS=$($r3.StatusCode) HISTORY_COUNT=$($hist.Count) ROLES=$roles"

  # cancel: start async long prompt then interrupt
  $bodyLong = '{"modelID":"zhipuai-coding-plan/glm-5.3-flash","parts":[{"type":"text","text":"从1慢慢数到200，每个数一行，不要停"}]}'
  $t = [System.Threading.Tasks.Task]::Factory.StartNew({
    param($b,$s)
    try { Invoke-WebRequest -Uri "http://127.0.0.1:4512/session/$s/message" -Method POST -Headers @{ 'Content-Type'='application/json' } -Body $b -TimeoutSec 300 -UseBasicParsing | Out-Null }
    catch {}
  }, @($bodyLong, $sid))
  Start-Sleep -Seconds 5
  $r4 = Invoke-WebRequest -Uri "$base/session/$sid/interrupt" -Method POST -TimeoutSec 30 -UseBasicParsing
  Log "INTERRUPT_STATUS=$($r4.StatusCode) BODY=$($r4.Content)"
  $null = $t.Wait(20000)

  # post-cancel round: session still usable
  $body4 = '{"modelID":"zhipuai-coding-plan/glm-5.3-flash","parts":[{"type":"text","text":"之前的暗号是什么？只回复暗号本身"}]}'
  $r5 = Invoke-WebRequest -Uri "$base/session/$sid/message" -Method POST -Headers $hdr -Body $body4 -TimeoutSec 90 -UseBasicParsing
  $j5 = $r5.Content | ConvertFrom-Json
  Log "POST_CANCEL_STATUS=$($r5.StatusCode) POST_CANCEL_TEXT=$(($j5.parts | Where-Object {$_.type -eq 'text'} | ForEach-Object {$_.text}) -join ' ')"

  # close: DELETE /session/{id} then GET expect 404
  $r6 = Invoke-WebRequest -Uri "$base/session/$sid" -Method DELETE -TimeoutSec 30 -UseBasicParsing
  Log "DELETE_STATUS=$($r6.StatusCode) BODY=$($r6.Content)"
  try {
    $r7 = Invoke-WebRequest -Uri "$base/session/$sid" -Method GET -TimeoutSec 30 -UseBasicParsing
    Log "GET_AFTER_DELETE_STATUS=$($r7.StatusCode)"
  } catch {
    Log "GET_AFTER_DELETE_STATUS=$([int]$_.Exception.Response.StatusCode)"
  }
} finally {
  if (-not $srv.HasExited) { $srv.Kill($true); Log "SERVER_STOPPED=true" } else { Log "SERVER_EXITED code=$($srv.ExitCode)" }
}
