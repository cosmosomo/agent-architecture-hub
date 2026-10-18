import { appendFact } from './append_fact.mjs';

const AT = new Date().toISOString();

// 1. artifact
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/artifacts-ui',
  surface: 'daemon',
  capability: 'artifact',
  result: 'pass',
  condition: 'Antigravity 2.23.1, brain/<cid>/artifacts + write_to_file ArtifactMetadata',
  evidence: '原生内置 Artifact 发布体系，write_to_file 附带 ArtifactMetadata 可直接向桌面端右侧面板发布可视化产物，支持 Markdown/Mermaid/HTML/Carousel 渲染，人可直接交互与打开',
  cmd: 'write_to_file with ArtifactMetadata',
  note: '原生产物发布系统：支持格式化文档与富媒体独立呈现'
});

// 2. browser
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/builtin-browser',
  surface: 'daemon',
  capability: 'browser',
  result: 'pass',
  condition: 'Antigravity 2.23.1, search_web + read_url_content + CDP browser',
  evidence: '内置 search_web 搜索引擎与 read_url_content 网页正文提取工具；桌面端集成 Chrome DevTools 内置浏览器并支持页面交互',
  cmd: 'search_web + read_url_content',
  note: '原生浏览器读写与网络搜索环境完备'
});

// 3. terminal
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/run_command',
  surface: 'daemon',
  capability: 'terminal',
  result: 'pass',
  condition: 'Antigravity 2.23.1, built-in run_command tool',
  evidence: '内置 run_command 工具，支持同步阻塞、异步转后台 (WaitMsBeforeAsync)、管道输出取回与退出码返回，已执行数百条命令验证可靠',
  cmd: 'run_command({ CommandLine: "...", Cwd: "..." })',
  note: '原生终端执行与输出捕获工具，具备完善的后台托管与标准输入控制'
});

// 4. dev-preview
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/generative_ui+webview',
  surface: 'native-desktop',
  capability: 'dev-preview',
  result: 'pass',
  condition: 'Antigravity 2.23.1, generative_ui skill + sidecar webview preview',
  evidence: '内置 generative_ui 技能支持 <agent-embed src="file:///.../widget.html"> 对话内嵌实时渲染；本地启动开发服务器时桌面端支持侧边栏 Webview 实时预览',
  cmd: 'embed widget.html or open local dev port in sidecar',
  note: '原生内置开发预览容器与对话内嵌富UI渲染'
});

// 5. cmd-list
appendFact({
  at: AT,
  by: 'agy-fact-antigravity',
  family: 'antigravity',
  layer: 'L0',
  route: 'antigravity/L0/slash-commands',
  surface: 'daemon',
  capability: 'cmd-list',
  result: 'pass',
  condition: 'Antigravity 2.23.1, Slash Commands Registry',
  evidence: '原生注册 9 大官方斜杠命令清单（/goal, /compact, /schedule, /browser, /plan, /grill-me, /teamwork-preview, /learn, /boost）并提供完整用途与参数说明，IDE/CLI 均可动态枚举',
  cmd: 'agy --help / slash-commands schema',
  note: '原生暴露可用斜杠命令清单与说明'
});
