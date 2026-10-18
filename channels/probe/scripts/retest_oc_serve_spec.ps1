# retest: opencode/L0/serve — inspect OpenAPI spec for prompt body schema
$port = 4514
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
try {
  $ready=$false
  foreach($i in 1..40){
    if ($srv.HasExited) { throw 'server exited early' }
    try { $r = Invoke-WebRequest -Uri "http://127.0.0.1:$port/doc" -Method GET -TimeoutSec 2 -UseBasicParsing; if ($r.StatusCode) { $ready=$true; break } } catch { Start-Sleep -Milliseconds 500 }
  }
  "READY=$ready"
  $spec = Invoke-WebRequest -Uri "http://127.0.0.1:$port/doc" -Method GET -TimeoutSec 10 -UseBasicParsing
  $j = $spec.Content | ConvertFrom-Json
  # find paths containing session/{id}/message or prompt
  $j.paths.PSObject.Properties.Name | Where-Object { $_ -match 'message|prompt' }
  "==== schema of POST /session/{id}/message ===="
  $p = $j.paths.'/session/{sessionID}/message'
  if ($p.post) {
    $rb = $p.post.requestBody.content.'application/json'.schema
    $ref = $rb.'$ref'
    "REF=$ref"
    if ($ref) {
      $name = $ref -replace '#/components/schemas/', ''
      $j.components.schemas.$name | ConvertTo-Json -Depth 8
    } else { $rb | ConvertTo-Json -Depth 8 }
  }
} finally {
  if (-not $srv.HasExited) { $srv.Kill($true); "SERVER_STOPPED=true" }
}
