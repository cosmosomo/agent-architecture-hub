# retest: opencode/L0/serve — observe-history / cancel / close over HTTP API
# starts opencode serve on a probe port, runs checks, then stops the server process it started.
$ErrorActionPreference = 'Stop'
$port = 4511
$logFile = "$env:TEMP\retest_oc_serve.log"
$srvOut = "$env:TEMP\retest_oc_serve_srv.out"

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

function Log($m){ $m | Tee-Object -FilePath $logFile -Append }
Remove-Item -LiteralPath $logFile -ErrorAction SilentlyContinue

try {
  # wait for server ready
  $ready = $false
  foreach($i in 1..40){
    if ($srv.HasExited) { throw "server exited early code=$($srv.ExitCode)" }
    try {
      $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/doc" -Method GET -TimeoutSec 2 -UseBasicParsing
      if ($r.StatusCode) { $ready = $true; break }
    } catch { Start-Sleep -Milliseconds 500 }
  }
  Log "READY=$ready"

  $base = "http://127.0.0.1:$port"

  # create session via TUI-less HTTP: use /session POST? opencode serve API: POST /session is not documented; use run-equivalent: prompt requires session. Newer API: POST /session creates empty session.
  $hdr = @{ 'Content-Type' = 'application/json' }
  # 1) create session
  try {
    $r1 = Invoke-WebRequest -Uri "$base/session" -Method POST -Headers $hdr -Body '{"title":"probe-retest-serve-1018"}' -TimeoutSec 30 -UseBasicParsing
    Log "CREATE_STATUS=$($r1.StatusCode)"
    Log "CREATE_BODY=$($r1.Content)"
  } catch {
    Log "CREATE_ERR=$($_.Exception.Message)"
    if ($_.Exception.Response) { Log "CREATE_ERR_STATUS=$([int]$_.Exception.Response.StatusCode)" }
  }
} finally {
  if (-not $srv.HasExited) { $srv.Kill($true); Log "SERVER_STOPPED=true" } else { Log "SERVER_ALREADY_EXITED code=$($srv.ExitCode)" }
}
