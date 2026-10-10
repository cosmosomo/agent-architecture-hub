---
hub: "1.0"
kind: relations
case: deep_research_v2
---

@r_tools >read @brief
@r_tools >read @tool_list
@r_oss >read @brief
@r_oss >read @tool_list
@r_paper >read @brief
@r_ux >read @brief
@r_reddit >read @brief
@r_x >read @brief
@r_forums >read @brief
@r_docs >read @brief
@r_ex1 >read @r_tools   提炼工具功能调研报告
@r_ex2 >read @r_oss     提炼开源项目调研报告
@r_ex3 >read @r_paper   提炼学术与博客调研报告
@r_ex4 >read @r_ux      提炼用户体验调研报告
@r_ex5 >read @r_reddit  提炼社区讨论调研报告
@r_ex6 >read @r_x       提炼技术动态调研报告
@r_ex7 >read @r_forums  提炼技术论坛调研报告
@synthesizer >read @r_docs  官方文档报告不经提炼直接进综合
@reviewer >read @brief
@reviewer >read @research_bundle
@devil >read @research_bundle
@devil >read @review_notes
@defender >read @research_bundle
@defender >read @review_notes
@synthesizer >read @debate_record
@synthesizer >read @research_bundle
@leader >watch @synthesis
