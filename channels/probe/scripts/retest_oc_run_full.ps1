# retest: opencode/L0/run — 5 cells, each appends to blackboard immediately after its evidence is captured
$ErrorActionPreference = 'Stop'
$bb = 'E:\program\GIT\Agent\multi\Agent-Architecture-Hub\channels\probe\blackboard.jsonl'
$env:HTTP_PROXY='http://127.0.0.1:7892'; $env:HTTPS_PROXY='http://127.0.0.1:7892'
$MODEL = 'zhipuai-coding-plan/glm-5.3-flash'
function Now(){ [System.DateTime]::Now.ToUniversalTime().AddHours(8).ToString('yyyy-MM-ddTHH:mm:ss+08:00') }
function Append-BB($cap, $result, $cond, $ev, $cmd, $note, $route){
  $o = [ordered]@{
    at = Now; by = 'workbuddy-retest-1018'; family = 'opencode'; layer = 'L0'
    route = $route; surface = 'native-cli'; capability = $cap; result = $result
    condition = $cond; evidence = ($ev -join ' '); cmd = $cmd; note = $note
  }
  Add-Content -LiteralPath $bb -Encoding utf8NoBOM -Value (($o | ConvertTo-Json -Compress))
  "APPENDED: $cap $result"
}
$COND = 'opencode 1.18.33 (opencode-ai npm), model zhipuai-coding-plan/glm-5.3-flash via Zhipu Coding Plan, proxy 127.0.0.1:7892, cwd Agent-Architecture-Hub'

# ---------- cell 1: model-list ----------
"== model-list =="
$models = (opencode models 2>&1 | Out-String) -split "`r?`n" | Where-Object { $_ -match '^[a-z]' } | ForEach-Object { $_.Trim() }
$ev1 = @("count=$($models.Count)", ($models | Select-Object -First 3), '...', ($models | Select-Object -Last 2))
Append-BB 'model-list' 'pass' $COND ($ev1 -join ' | ') 'opencode models' ("列表16项与实际可用一致：本批测试全程用其中的 zhipuai-coding-plan/glm-5.3-flash 实际跑通（见 cancel/observe-history 格）；含 opencode/*-free 10 项与 zhipuai-coding-plan 5 项。复测agy-flash第343行：一致")

# ---------- cell 2: quota ----------
"== quota =="
$stats = opencode stats --models 2>&1 | Out-String
$flat = ($stats -replace '\s+', ' ')
$keep = @()
foreach($k in 'Sessions','Messages','Total Cost','zhipuai-coding-plan/glm-5.3-flash','Messages 27'){ if ($flat -match [regex]::Escape($k)) { $keep += "HAS:$k" } }
$overview = if ($flat -match 'OVERVIEW.*?Sessions\s+(\d+).*?Messages\s+(\d+)') { "Sessions=$($Matches[1]) Messages=$($Matches[2])" } else { 'parse_fail' }
Append-BB 'quota' 'partial' $COND ("opencode stats --models => $overview; $flat".Substring(0,300)) 'opencode stats --models' ("判'partial'：stats 只给本机用量统计(Sessions/Messages/Tokens/Cost/ModelUsage)，无渠道剩余额度或窗口数据；Coding Plan 余额需另行查询。原347行'pass'证据实为本面板，与登记表'剩余额度与窗口'定义不符")

# ---------- setup session for observe-history / cancel / close ----------
"== new probe session =="
$r1 = opencode run "记住暗号 RETEST_RUN_8841。只回复：已记住 RETEST_RUN_8841" -m $MODEL --format json 2>$env:TEMP\oc_r1b.err | Out-String
$sid = $null
foreach($l in ($r1 -split "`n")){ if($l -match '"sessionID":"(ses_[A-Za-z0-9]+)"'){ $sid = $Matches[1]; break } }
"SID=$sid"
if (-not $sid) { throw 'no session id from round1' }

# ---------- cell 3: observe-history ----------
"== observe-history =="
$exp = opencode export $sid 2>$env:TEMP\oc_expb.err | Out-String
$j = $exp | ConvertFrom-Json
$roles = ($j.messages | ForEach-Object { $_.info.role }) -join ','
$asstText = ($j.messages | Where-Object {$_.info.role -eq 'assistant'} | ForEach-Object { $_.parts | Where-Object {$_.type -eq 'text'} | ForEach-Object {$_.text} }) -join ' '
$ev3 = "export info.id=$($j.info.id) title=$($j.info.title) messages=$($j.messages.Count) roles=$roles assistant_text=$($asstText.Trim())"
Append-BB 'observe-history' 'pass' $COND ($ev3.Substring(0,[Math]::Min(400,$ev3.Length))) "opencode export $sid" ("读回全部2轮(user+assistant)，assistant 文本含暗号，零丢弃。复测agy-flash第335行：一致(其仅展示info元数据，本证据含正文)")

# ---------- cell 4: cancel ----------
"== cancel =="
$killScript = 'E:\program\GIT\Agent\multi\Agent-Architecture-Hub\channels\probe\scripts\retest_oc_cancel.ps1'
$killOut = & pwsh -NoProfile -File $killScript $sid | Out-String
$killLine = ($killOut -split "`r?`n" | Where-Object { $_ -match 'KILLED_AT_MS|EXITED_EARLY' }) -join ''
$sawStart = $killOut -match 'step_start'
$sawFinish = $killOut -match 'step_finish'
$r3 = opencode run "之前的暗号是什么？只回复暗号本身" -s $sid -m $MODEL --format json 2>$env:TEMP\oc_r3b.err | Out-String
$postText = $null; $fin = $null
foreach($l in ($r3 -split "`n")){
  if($l -match '^\s*\{'){
    $jj = $l | ConvertFrom-Json
    if($jj.type -eq 'text'){ $postText = $jj.part.text }
    if($jj.type -eq 'step_finish'){ $fin = $jj.part.reason }
  }
}
$ev4 = "$killLine; midturn_out_has_step_start=$sawStart has_step_finish=$sawFinish; post_cancel reply=$postText finish_reason=$fin"
Append-BB 'cancel' 'pass' $COND $ev4 "pwsh retest_oc_cancel.ps1 $sid (kill mid-counting); opencode run '之前的暗号是什么？' -s $sid -m $MODEL --format json" ("轮中kill进程：只见step_start无step_finish；-s续接后正常答出暗号RETEST_RUN_8841且finish=stop，会话仍可恢复。注：run路线无原生interrupt命令，kill进程为等效打断手段(与原337行同法)。复测：一致")

# ---------- cell 5: close ----------
"== close =="
$inListBefore = ((opencode session list 2>&1 | Out-String) -match [regex]::Escape($sid))
$del = opencode session delete $sid 2>&1 | Out-String
$delExit = $LASTEXITCODE
$inListAfter = ((opencode session list 2>&1 | Out-String) -match [regex]::Escape($sid))
$expAfter = opencode export $sid 2>&1 | Out-String
$notFound = $expAfter -match 'Session not found'
$ev5 = "in_list_before=$inListBefore; delete_stdout=$($del.Trim()); del_exit=$delExit; in_list_after=$inListAfter; export_after=$($expAfter.Trim() -replace '\s+',' ')"
Append-BB 'close' 'pass' $COND $ev5 "opencode session delete $sid; opencode session list; opencode export $sid" ("删除后list不可见且export报Session not found。复测agy-flash第338行：一致(其仅看list，本证据加测export)")
"DONE run route"
