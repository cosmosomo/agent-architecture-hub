# sync_capability_skill.ps1 — Synchronizes local-capability-hub Skill across all 11 local AI hosts
$ErrorActionPreference = "Stop"

$hubRoot = "e:\program\GIT\Agent\multi\Agent-Architecture-Hub"
$canonicalSkill = "C:\Users\COLORFIRE\.cc-switch\skills\local-capability-hub"

New-Item -ItemType Directory -Force -Path "$canonicalSkill\scripts" | Out-Null
New-Item -ItemType Directory -Force -Path "$canonicalSkill\references" | Out-Null

Copy-Item -Force "$hubRoot\hub\tools\search_hub.js" "$canonicalSkill\scripts\search_hub.js"
Copy-Item -Force "$hubRoot\channels\_private\本机AI全能力与全量密钥一册通.md" "$canonicalSkill\references\keys-and-endpoints.md"

$targets = @(
  "$hubRoot\channels\_private\local-capability-hub",
  "C:\Users\COLORFIRE\.claude\skills\local-capability-hub",
  "C:\Users\COLORFIRE\.codex\skills\local-capability-hub",
  "C:\Users\COLORFIRE\.zcode\skills\local-capability-hub",
  "C:\Users\COLORFIRE\.workbuddy\skills\local-capability-hub",
  "C:\Users\COLORFIRE\.config\opencode\skills\local-capability-hub",
  "C:\Users\COLORFIRE\.gemini\config\skills\local-capability-hub",
  "C:\Users\COLORFIRE\.agents\skills\local-capability-hub",
  "C:\Users\COLORFIRE\AppData\Local\DoubaoWork\User Data\Profile 3\.doubaowork\agent_mode\workspace\.user_skills\local-capability-hub",
  "C:\Users\COLORFIRE\AppData\Local\DoubaoWork\User Data\Default\.doubaowork\agent_mode\workspace\.user_skills\local-capability-hub",
  "C:\Users\COLORFIRE\AppData\Local\Doubao\User Data\Default\.doubao\agent_mode\workspace\.user_skills\local-capability-hub"
)

foreach ($t in $targets) {
  $parent = Split-Path $t -Parent
  if (Test-Path $parent) {
    if (Test-Path $t) { Remove-Item -Recurse -Force $t }
    Copy-Item -Recurse -Force $canonicalSkill $t
    Write-Output "[SYNCED] $t"
  }
}
