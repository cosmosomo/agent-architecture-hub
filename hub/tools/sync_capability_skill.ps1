# sync_capability_skill.ps1 — Synchronizes local-capability-hub Skill across all 11 local AI hosts with conflict detection
param(
  [switch]$Check,
  [switch]$Force,
  [switch]$Diff
)

$hubRoot = "e:\program\GIT\Agent\multi\Agent-Architecture-Hub"
$scriptPath = "$hubRoot\hub\tools\sync_skill.js"

$nodeArgs = @()
if ($Check) { $nodeArgs += "--check" }
if ($Force) { $nodeArgs += "--force" }
if ($Diff)  { $nodeArgs += "--diff" }

node $scriptPath @nodeArgs
exit $LASTEXITCODE
