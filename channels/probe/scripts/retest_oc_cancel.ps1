# retest: opencode/L0/run cancel — resume session, long task, kill at ~6s
$env:HTTP_PROXY='http://127.0.0.1:7892'; $env:HTTPS_PROXY='http://127.0.0.1:7892'
$sid = $args[0]
$prompt = '从1慢慢数到200，每个数一行输出'
$argline = 'run "{0}" -s {1} -m zhipuai-coding-plan/glm-5.3-flash --format json' -f $prompt, $sid
$psi = New-Object System.Diagnostics.ProcessStartInfo
$ocexe = 'C:\Users\COLORFIRE\AppData\Roaming\npm\node_modules\opencode\bin\opencode.exe'
if (-not (Test-Path $ocexe)) { $ocexe = 'C:\Users\COLORFIRE\AppData\Roaming\npm\opencode.cmd' }
$psi.FileName = $ocexe
$psi.Arguments = $argline
$psi.RedirectStandardOutput = $true
$psi.RedirectStandardError = $true
$psi.RedirectStandardInput = $true
$psi.UseShellExecute = $false
$psi.EnvironmentVariables['HTTP_PROXY']='http://127.0.0.1:7892'
$psi.EnvironmentVariables['HTTPS_PROXY']='http://127.0.0.1:7892'
$p = [System.Diagnostics.Process]::Start($psi)
$p.StandardInput.Close()
$sb = New-Object System.Text.StringBuilder
$sw = [System.Diagnostics.Stopwatch]::StartNew()
try {
  while (-not $p.StandardOutput.EndOfStream) {
    $line = $p.StandardOutput.ReadLine()
    [void]$sb.AppendLine($line)
    if ($sw.ElapsedMilliseconds -gt 6000) { break }
  }
} catch {}
if (-not $p.HasExited) {
  $p.Kill($true)
  "KILLED_AT_MS=$($sw.ElapsedMilliseconds)"
} else {
  "EXITED_EARLY code=$($p.ExitCode)"
}
Start-Sleep -Milliseconds 800
$out = $sb.ToString()
"OUT_LEN=$($out.Length)"
$lines = $out -split "`r?`n" | Where-Object { $_ -match '^\s*\{' } | Select-Object -First 8
foreach($l in $lines){ $t=$l.Trim(); $t.Substring(0, [Math]::Min(240, $t.Length)) }
