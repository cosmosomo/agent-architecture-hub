/* The pictograms and colours of the built-in agents and sample teams: what the cards and the list draw.
   Taken once from the hand-drawn icon set of the sample page this project grew from (MIT, see LICENSE);
   this file is the source now. svg: the inner markup of a 24x24 icon; solid: filled shapes (drawn through a mask),
   otherwise strokes; cat/color: the colour group the card and the icon take. */
window.HUB = window.HUB || {};
HUB.icons = {
 "agents": {
  "ml_engineer": {
   "svg": "<path d=\"M3.5 4v16.5H21\" opacity=\".4\"/><circle cx=\"7\" cy=\"16.5\" r=\"1.6\"/><circle cx=\"11.5\" cy=\"12.5\" r=\"1.6\"/><circle cx=\"15.5\" cy=\"14\" r=\"1.6\"/><circle cx=\"19.5\" cy=\"7.5\" r=\"1.6\"/><path d=\"M8.2 15.4l2.2-1.9M12.9 13l1.3.5M16.7 12.6l1.7-3.2\"/>",
   "cat": "DANE",
   "color": "bl"
  },
  "data_engineer": {
   "svg": "<rect x=\"4\" y=\"4\" width=\"16\" height=\"4\" rx=\"1\"/><rect x=\"4\" y=\"10\" width=\"16\" height=\"4\" rx=\"1\"/><rect x=\"4\" y=\"16\" width=\"16\" height=\"4\" rx=\"1\"/><path d=\"M7.5 6h.01M7.5 12h.01M7.5 18h.01\"/>",
   "cat": "DANE",
   "color": "vi"
  },
  "ai_engineer": {
   "svg": "<rect x=\"3\" y=\"7\" width=\"18\" height=\"12\" rx=\"2\"/><circle cx=\"9\" cy=\"13\" r=\"1.6\" fill=\"currentColor\"/><circle cx=\"15\" cy=\"13\" r=\"1.6\" fill=\"currentColor\"/><path d=\"M12 7V3.5M8.5 3.5h7\"/>",
   "cat": "DANE",
   "color": "cy"
  },
  "prompt_engineer": {
   "svg": "<path d=\"M4 6h16M4 12h9M4 18h16\"/><path d=\"M15 9.5l3.2 2.5-3.2 2.5\"/>",
   "cat": "DANE",
   "color": "vi"
  },
  "devops_engineer": {
   "svg": "<circle cx=\"8.2\" cy=\"12\" r=\"4.1\"/><circle cx=\"15.8\" cy=\"12\" r=\"4.1\"/><circle cx=\"12\" cy=\"12\" r=\"1.2\" fill=\"currentColor\"/>",
   "cat": "OPS",
   "color": "cy"
  },
  "cloud_architect": {
   "svg": "<path d=\"M12 5.4a5.2 5.2 0 00-5 3.8 4.4 4.4 0 00.5 8.8h9.8a4.4 4.4 0 00.5-8.8 5.2 5.2 0 00-5.8-3.8z\" class=\"f\"/><circle cx=\"9.2\" cy=\"13.6\" r=\"1.5\" class=\"ko\"/><circle cx=\"14.8\" cy=\"13.6\" r=\"1.5\" class=\"ko\"/><rect x=\"10.5\" y=\"12.8\" width=\"3\" height=\"1.6\" rx=\".8\" class=\"ko\"/>",
   "cat": "OPS",
   "color": "bl",
   "solid": true
  },
  "sre_engineer": {
   "svg": "<path d=\"M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6z\"/><path d=\"M8 12h2l1.5-3 1.5 5 1-2h2\"/>",
   "cat": "OPS",
   "color": "ro"
  },
  "kubernetes_specialist": {
   "svg": "<path d=\"M12 2.2l8.5 4.9v9.8L12 21.8 3.5 16.9V7.1z\" class=\"f\"/><circle cx=\"12\" cy=\"12\" r=\"3.1\" class=\"ko\"/><circle cx=\"12\" cy=\"12\" r=\"1.2\" class=\"f\"/>",
   "cat": "OPS",
   "color": "bl",
   "solid": true
  },
  "accessibility_tester": {
   "svg": "<circle cx=\"12\" cy=\"4.4\" r=\"1.9\"/><path d=\"M4.5 8h15M12 8v5.5M8 20l4-6.5 4 6.5\"/>",
   "cat": "QA / AUDYT",
   "color": "vi"
  },
  "product_manager": {
   "svg": "<path d=\"M3.6 18.4h16.8\" opacity=\".45\"/><circle cx=\"6.4\" cy=\"18.4\" r=\"1.6\"/><circle cx=\"12\" cy=\"18.4\" r=\"1.6\"/><circle cx=\"18\" cy=\"18.4\" r=\"2.2\"/><path d=\"M18 16.2V6.4\" opacity=\".55\"/><path d=\"M18 6.9l4 1.7-4 1.7z\"/>",
   "cat": "PRODUKT",
   "color": "am"
  },
  "ux_researcher": {
   "svg": "<circle cx=\"9.5\" cy=\"8.5\" r=\"3\"/><path d=\"M4 19a5.5 5.5 0 0111 0\"/><circle cx=\"17.5\" cy=\"12\" r=\"2.6\"/><path d=\"M19.4 13.9L22 16.5\"/>",
   "cat": "PRODUKT",
   "color": "cy"
  },
  "technical_writer": {
   "svg": "<path d=\"M3 5.5c3-1 6-1 9 0v14c-3-1-6-1-9 0zM21 5.5c-3-1-6-1-9 0v14c3-1 6-1 9 0z\"/><path d=\"M6 9.5h3M6 12.5h3M15 9.5h3M15 12.5h3\"/>",
   "cat": "BUILD",
   "color": "bl"
  },
  "mobile_developer": {
   "svg": "<rect x=\"7\" y=\"2\" width=\"10\" height=\"20\" rx=\"2.2\"/><path d=\"M10.5 18.5h3\"/>",
   "cat": "BUILD",
   "color": "cy"
  },
  "orchestrator": {
   "svg": "<path d=\"M3.6 8.4l4 3.3L12 5.2l4.4 6.5 4-3.3-1.6 8.6H5.2z\"/><path d=\"M5.4 20.2h13.2\"/>",
   "cat": "STRATEGIA",
   "color": "am"
  },
  "synthesizer": {
   "svg": "<path d=\"M12 3l5 7.5H7z\"/><path d=\"M7 10.5L3.5 19\"/><path d=\"M12 10.5V21\"/><path d=\"M17 10.5l3.5 8.5\"/><circle cx=\"3.5\" cy=\"19\" r=\"1.5\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"21\" r=\"1.5\" fill=\"currentColor\"/><circle cx=\"20.5\" cy=\"19\" r=\"1.5\" fill=\"currentColor\"/>",
   "cat": "STRATEGIA",
   "color": "vi"
  },
  "analyst": {
   "svg": "<circle cx=\"5.2\" cy=\"17.2\" r=\"1.7\"/><circle cx=\"10.6\" cy=\"12.4\" r=\"1.7\"/><circle cx=\"16\" cy=\"14.2\" r=\"1.7\"/><circle cx=\"19.6\" cy=\"6.8\" r=\"1.7\"/><path d=\"M6.5 16.1l3.1-2.6M12.2 12.9l2.4.8M17.4 13l1.6-4.6\"/><path d=\"M3 4v17h18\" opacity=\".35\"/>",
   "cat": "PLANOWANIE",
   "color": "cy"
  },
  "planner": {
   "svg": "<path d=\"M5 20c3-3 3-6 0-9s-3-6 0-9\"/><path d=\"M19 4c-3 3-3 6 0 9s3 6 0 9\"/><circle cx=\"5\" cy=\"20\" r=\"1.5\" fill=\"currentColor\"/><circle cx=\"19\" cy=\"4\" r=\"1.5\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"12\" r=\"1\" fill=\"currentColor\"/>",
   "cat": "PLANOWANIE",
   "color": "cy"
  },
  "res_tech": {
   "svg": "<circle cx=\"12\" cy=\"12\" r=\"2.1\"/><ellipse cx=\"12\" cy=\"12\" rx=\"9\" ry=\"4.2\" opacity=\".45\"/><ellipse cx=\"12\" cy=\"12\" rx=\"9\" ry=\"4.2\" transform=\"rotate(60 12 12)\" opacity=\".45\"/><ellipse cx=\"12\" cy=\"12\" rx=\"9\" ry=\"4.2\" transform=\"rotate(120 12 12)\" opacity=\".45\"/>",
   "cat": "RESEARCH",
   "color": "bl"
  },
  "res_ux": {
   "svg": "<circle cx=\"8.2\" cy=\"8.8\" r=\"2.4\"/><path d=\"M4 18.6a4.2 4.2 0 018.4 0\" opacity=\".5\"/><path d=\"M17.4 16s-3.6-2.3-3.6-4.7a1.9 1.9 0 013.6-1 1.9 1.9 0 013.6 1c0 2.4-3.6 4.7-3.6 4.7z\" opacity=\".7\"/>",
   "cat": "RESEARCH",
   "color": "bl"
  },
  "res_reddit": {
   "svg": "<circle cx=\"12\" cy=\"11.4\" r=\"6.6\" opacity=\".5\"/><circle cx=\"9.5\" cy=\"10.8\" r=\"1.4\"/><circle cx=\"14.5\" cy=\"10.8\" r=\"1.4\"/><path d=\"M9.6 14.2c1.4 1.1 3.4 1.1 4.8 0\"/><path d=\"M7.2 17.6l-1.8 3.4 3.8-1.6\" opacity=\".55\"/>",
   "cat": "RESEARCH",
   "color": "bl"
  },
  "res_x": {
   "svg": "<path d=\"M4 4l7.5 8.5L4 21\"/><path d=\"M20 4l-7.5 8.5L20 21\"/>",
   "cat": "RESEARCH",
   "color": "bl"
  },
  "res_github": {
   "svg": "<rect x=\"3.2\" y=\"3.2\" width=\"17.6\" height=\"17.6\" rx=\"3.6\" class=\"f\"/><circle cx=\"8.8\" cy=\"8.6\" r=\"1.7\" class=\"ko\"/><circle cx=\"15.2\" cy=\"8.6\" r=\"1.7\" class=\"ko\"/><circle cx=\"12\" cy=\"15.8\" r=\"1.9\" class=\"ko\"/><path d=\"M8.8 10.3v1.4c0 1.1.9 2 2 2h2.4c1.1 0 2-.9 2-2v-1.4\" class=\"kos\"/>",
   "cat": "RESEARCH",
   "color": "bl",
   "solid": true
  },
  "res_forums": {
   "svg": "<path d=\"M3 4.6h12.4a2 2 0 012 2v5a2 2 0 01-2 2H8l-5 3.4z\" class=\"f\"/><circle cx=\"7\" cy=\"9.1\" r=\"1.3\" class=\"ko\"/><circle cx=\"11.2\" cy=\"9.1\" r=\"1.3\" class=\"ko\"/><path d=\"M18.6 9.2h1a2 2 0 012 2v4.6a2 2 0 01-2 2h-.6l-4 3v-3h-1.4a2 2 0 01-1.9-1.4h2.9a3 3 0 003-3z\" class=\"f\"/>",
   "cat": "RESEARCH",
   "color": "bl",
   "solid": true
  },
  "res_docs": {
   "svg": "<path d=\"M7 2h8l5 5v13a2 2 0 01-2 2H7a2 2 0 01-2-2V4a2 2 0 012-2z\"/><path d=\"M15 2v5h5\"/><path d=\"M9 10h6M9 13h6M9 16h4\"/>",
   "cat": "RESEARCH",
   "color": "bl"
  },
  "res_critic": {
   "svg": "<circle cx=\"10.5\" cy=\"10.5\" r=\"6.5\"/><path d=\"M15.5 15.5L21 21\"/><path d=\"M10.5 7.5v6M7.5 10.5h6\"/>",
   "cat": "RESEARCH",
   "color": "ro"
  },
  "backend": {
   "svg": "<rect x=\"3\" y=\"3.2\" width=\"18\" height=\"6\" rx=\"2\" class=\"f\"/><rect x=\"3\" y=\"14.8\" width=\"18\" height=\"6\" rx=\"2\" class=\"f\"/><circle cx=\"7\" cy=\"6.2\" r=\"1.5\" class=\"ko\"/><circle cx=\"7\" cy=\"17.8\" r=\"1.5\" class=\"ko\"/><rect x=\"11\" y=\"10\" width=\"2\" height=\"4\" rx=\"1\" class=\"f\"/>",
   "cat": "BUILD",
   "color": "mu",
   "solid": true
  },
  "frontend": {
   "svg": "<rect x=\"2.5\" y=\"3\" width=\"19\" height=\"17\" rx=\"2.5\"/><path d=\"M2.5 8h19\"/><circle cx=\"5.5\" cy=\"5.5\" r=\".8\" fill=\"currentColor\"/><circle cx=\"8\" cy=\"5.5\" r=\".8\" fill=\"currentColor\"/><circle cx=\"10.5\" cy=\"5.5\" r=\".8\" fill=\"currentColor\"/><rect x=\"5\" y=\"11\" width=\"6\" height=\"6\" rx=\"1\" opacity=\".3\"/><path d=\"M14 11h5M14 14h3.5M14 17h4.5\"/>",
   "cat": "BUILD",
   "color": "mu"
  },
  "feature": {
   "svg": "<line x1=\"4\" y1=\"20\" x2=\"15\" y2=\"9\"/><path d=\"M14 8l2-2 2 2-2 2z\"/><path d=\"M19 4l.5 1.5L21 6l-1.5.5L19 8l-.5-1.5L17 6l1.5-.5z\" fill=\"currentColor\"/><path d=\"M6 4l.5 1.5L8 6l-1.5.5L6 8l-.5-1.5L4 6l1.5-.5z\" fill=\"currentColor\"/>",
   "cat": "BUILD",
   "color": "mu"
  },
  "designer": {
   "svg": "<path d=\"M12 2.8C6.9 2.8 2.8 6.9 2.8 12S6.9 21.2 12 21.2c1.1 0 1.9-.9 1.9-1.9 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .9-1.9 1.9-1.9h2.2c2.6 0 4.7-2.1 4.7-4.7 0-4.2-4.3-7.5-9.7-7.5z\" class=\"f\"/><circle cx=\"7.4\" cy=\"11.4\" r=\"1.6\" class=\"ko\"/><circle cx=\"10.4\" cy=\"7.6\" r=\"1.6\" class=\"ko\"/><circle cx=\"15\" cy=\"7.8\" r=\"1.6\" class=\"ko\"/><circle cx=\"17.4\" cy=\"11.4\" r=\"1.6\" class=\"ko\"/>",
   "cat": "BUILD",
   "color": "mu",
   "solid": true
  },
  "integrator": {
   "svg": "<path d=\"M10 14l4-4\"/><path d=\"M13 6l1-1a4 4 0 015.5 5.5l-2 2\"/><path d=\"M11 18l-1 1a4 4 0 01-5.5-5.5l2-2\"/>",
   "cat": "BUILD",
   "color": "mu"
  },
  "writer": {
   "svg": "<path d=\"M4.4 19.6l1-3.4L16 5.6a2 2 0 012.9 2.9L8.3 19l-3.9.6z\" opacity=\".5\"/><circle cx=\"6.6\" cy=\"17.4\" r=\"1.5\"/><circle cx=\"17.4\" cy=\"6.8\" r=\"1.5\"/>",
   "cat": "BUILD",
   "color": "mu"
  },
  "res_extractor": {
   "svg": "<path d=\"M4 5.4h16l-6.2 7.2v6.4l-3.6-2v-4.4z\" opacity=\".5\"/><circle cx=\"7.6\" cy=\"5.4\" r=\"1.2\"/><circle cx=\"12\" cy=\"5.4\" r=\"1.2\"/><circle cx=\"16.4\" cy=\"5.4\" r=\"1.2\"/><circle cx=\"12\" cy=\"16.6\" r=\"1.5\"/>",
   "cat": "RESEARCH",
   "color": "bl"
  },
  "synthesizer_lean": {
   "svg": "<circle cx=\"5\" cy=\"7.4\" r=\"2.3\" class=\"f\"/><circle cx=\"5\" cy=\"16.6\" r=\"2.3\" class=\"f\"/><circle cx=\"17.8\" cy=\"12\" r=\"3.3\" class=\"f\"/><path d=\"M5 7.4l12.8 4.6M5 16.6l12.8-4.6\" class=\"fs\"/>",
   "cat": "STRATEGIA",
   "color": "vi",
   "solid": true
  },
  "style_profiler": {
   "svg": "<path d=\"M4.4 9.4h2.9l4.2-3.6a1 1 0 011.7.8v10.8a1 1 0 01-1.7.8l-4.2-3.6H4.4a1 1 0 01-1-1v-3.2a1 1 0 011-1z\" class=\"f\"/><path d=\"M15.8 8.4c1.9 2.1 1.9 5.1 0 7.2M18.6 5.8c3.2 3.6 3.2 8.8 0 12.4\" class=\"fst\"/>",
   "cat": "BUILD",
   "color": "vi",
   "solid": true
  },
  "voice_qa": {
   "svg": "<path d=\"M4 9.6h2.7l3.9-3.4a1 1 0 011.7.8v10a1 1 0 01-1.7.8l-3.9-3.4H4a1 1 0 01-1-1v-2.8a1 1 0 011-1z\" class=\"f\"/><path d=\"M15.2 13.6l2.2 2.2 4-4.8 1.6 1.4-5.6 6.6-3.8-3.8z\" class=\"f\"/>",
   "cat": "BUILD",
   "color": "vi",
   "solid": true
  },
  "social_strategist": {
   "svg": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"4\"/><circle cx=\"12\" cy=\"12\" r=\"1\" fill=\"currentColor\"/>",
   "cat": "BUILD",
   "color": "vi"
  },
  "career_document_builder": {
   "svg": "<rect x=\"4.8\" y=\"3.4\" width=\"11.4\" height=\"17.2\" rx=\"2.2\" opacity=\".5\"/><circle cx=\"10.5\" cy=\"9.4\" r=\"2.2\"/><path d=\"M7.2 16.6a3.3 3.3 0 016.6 0\" opacity=\".55\"/><circle cx=\"19.4\" cy=\"12\" r=\"1.5\"/><path d=\"M17.9 12h-1.7\"/>",
   "cat": "BUILD",
   "color": "cy"
  },
  "interview_coach": {
   "svg": "<rect x=\"9\" y=\"2\" width=\"6\" height=\"11\" rx=\"3\"/><path d=\"M6 11a6 6 0 0012 0\"/><path d=\"M12 17v4M9 21h6\"/>",
   "cat": "BUILD",
   "color": "cy"
  },
  "recipe_scout": {
   "svg": "<path d=\"M4 12.4h16a8 8 0 01-16 0z\" opacity=\".5\"/><path d=\"M3 20.6h18\" opacity=\".45\"/><circle cx=\"8.2\" cy=\"7\" r=\"1.4\"/><circle cx=\"12\" cy=\"5.2\" r=\"1.4\"/><circle cx=\"15.8\" cy=\"7\" r=\"1.4\"/>",
   "cat": "RESEARCH",
   "color": "am"
  },
  "taste_recommender": {
   "svg": "<path d=\"M12 21C7 17 3 13 3 8.5A4.5 4.5 0 0112 6a4.5 4.5 0 019 2.5C21 13 17 17 12 21z\"/>",
   "cat": "BUILD",
   "color": "am"
  },
  "recipe_filter": {
   "svg": "<path d=\"M3 4h18l-7 8v7l-4-2v-5z\"/><circle cx=\"17\" cy=\"16\" r=\"4\"/><path d=\"M17 14.5V16l1 1\"/>",
   "cat": "BUILD",
   "color": "am"
  },
  "decision_advisor": {
   "svg": "<path d=\"M6 3v6a4 4 0 004 4h4\"/><path d=\"M14 9l4 4-4 4\"/><circle cx=\"6\" cy=\"3\" r=\"1.5\"/>",
   "cat": "STRATEGIA",
   "color": "bl"
  },
  "voice_writer": {
   "svg": "<path d=\"M13.6 4.4l3.4 3.4-9.4 9.4-4.6 1.2 1.2-4.6z\" class=\"f\"/><path d=\"M18.6 6.2c1.9 2.1 1.9 5.5 0 7.6M21.2 3.8c3.1 3.5 3.1 9.3 0 12.8\" class=\"fst\"/>",
   "cat": "BUILD",
   "color": "vi",
   "solid": true
  },
  "qa_security": {
   "svg": "<path d=\"M12 2l8 4v5c0 5.5-3.5 10.5-8 12.5-4.5-2-8-7-8-12.5V6z\"/><rect x=\"10\" y=\"10\" width=\"4\" height=\"5\" rx=\"1\"/><circle cx=\"12\" cy=\"9\" r=\"2\"/>",
   "cat": "QA / AUDYT",
   "color": "ro"
  },
  "qa_quality": {
   "svg": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M8 12l2.5 3L16 9\"/><path d=\"M12 3v1M12 20v1M3 12h1M20 12h1\"/>",
   "cat": "QA / AUDYT",
   "color": "ro"
  },
  "qa_perf": {
   "svg": "<path d=\"M12 5.2A9.4 9.4 0 002.8 16.6a1.2 1.2 0 001.2 1h16a1.2 1.2 0 001.2-1A9.4 9.4 0 0012 5.2zm5.8 4.3l-4.2 5.4a2.1 2.1 0 11-1.9-1.5z\" class=\"f\"/>",
   "cat": "QA / AUDYT",
   "color": "ro",
   "solid": true
  },
  "qa_manager": {
   "svg": "<circle cx=\"12\" cy=\"5.6\" r=\"2.2\"/><circle cx=\"5.6\" cy=\"18\" r=\"1.9\"/><circle cx=\"12\" cy=\"18\" r=\"1.9\"/><circle cx=\"18.4\" cy=\"18\" r=\"1.9\"/><path d=\"M12 7.8v3.7M5.6 16.1v-2.4c0-.4.3-.7.7-.7h11.4c.4 0 .7.3.7.7v2.4M12 11.5v4.6\"/>",
   "cat": "QA / AUDYT",
   "color": "ro"
  },
  "expert_pragmatist": {
   "svg": "<path d=\"M15 3a4 4 0 00-3.5 6L3 17.5 6.5 21l8.5-8.5A4 4 0 0021 9l-3 3-3-3 3-3a4 4 0 00-3-3z\"/><circle cx=\"5\" cy=\"19\" r=\".8\" fill=\"currentColor\"/>",
   "cat": "FIVE MINDS",
   "color": "am"
  },
  "expert_innovator": {
   "svg": "<path d=\"M9 21h6\"/><path d=\"M10 18h4\"/><path d=\"M12 2a7 7 0 00-4 12.7V18h8v-3.3A7 7 0 0012 2z\"/><path d=\"M10 10l2 3 2-3\"/>",
   "cat": "FIVE MINDS",
   "color": "cy"
  },
  "expert_analyst": {
   "svg": "<path d=\"M12 2.8a9.2 9.2 0 100 18.4 9.2 9.2 0 000-18.4z\" class=\"f\"/><rect x=\"7.9\" y=\"12\" width=\"2.1\" height=\"4.2\" rx=\"1\" class=\"ko\"/><rect x=\"10.9\" y=\"8.6\" width=\"2.1\" height=\"7.6\" rx=\"1\" class=\"ko\"/><rect x=\"13.9\" y=\"10.4\" width=\"2.1\" height=\"5.8\" rx=\"1\" class=\"ko\"/>",
   "cat": "FIVE MINDS",
   "color": "bl",
   "solid": true
  },
  "expert_user": {
   "svg": "<circle cx=\"12\" cy=\"7\" r=\"4\"/><path d=\"M5 21v-2c0-3 3.5-5.5 7-5.5s7 2.5 7 5.5v2\"/><path d=\"M17 8.5l2.5 2-2.5 2\" opacity=\".6\"/>",
   "cat": "FIVE MINDS",
   "color": "cy"
  },
  "expert_devil": {
   "svg": "<path d=\"M12 2c0 4-6 5.5-6 10.5a6 6 0 0012 0C18 7.5 12 6 12 2z\"/><path d=\"M9.5 15c1.5 1.5 3.5 1.5 5 0\"/><path d=\"M8 8.5l1.5 1M16 8.5l-1.5 1\"/>",
   "cat": "FIVE MINDS",
   "color": "ro"
  },
  "decision_presenter": {
   "svg": "<rect x=\"3\" y=\"4.4\" width=\"18\" height=\"12.2\" rx=\"2.2\" opacity=\".5\"/><path d=\"M12 16.6V20M8.4 20h7.2\" opacity=\".5\"/><circle cx=\"9\" cy=\"10.5\" r=\"1.6\"/><circle cx=\"15\" cy=\"10.5\" r=\"1.6\"/><path d=\"M10.6 10.5h2.8\"/>",
   "cat": "HITL",
   "color": "vi"
  }
 },
 "presets": {
  "mlops": {
   "svg": "<path d=\"M4 19V5\"/><path d=\"M4 19h16\"/><path d=\"M7 14l3-3 3 2 4-6\"/><circle cx=\"17\" cy=\"7\" r=\"1.3\" fill=\"currentColor\"/>",
   "cat": "data"
  },
  "rag_app": {
   "svg": "<path d=\"M12 2.4c-4 0-7.2 1.5-7.2 3.4v12.4c0 1.9 3.2 3.4 7.2 3.4s7.2-1.5 7.2-3.4V5.8c0-1.9-3.2-3.4-7.2-3.4z\" class=\"f\"/><path d=\"M4.8 6.6c0 1.9 3.2 3.4 7.2 3.4s7.2-1.5 7.2-3.4M4.8 12.6c0 1.9 3.2 3.4 7.2 3.4s7.2-1.5 7.2-3.4\" class=\"kos\"/>",
   "cat": "data",
   "solid": true
  },
  "devops_cicd": {
   "svg": "<path d=\"M4.8 7.4C2.1 7.4 0 9.5 0 12s2.1 4.6 4.8 4.6c2.4 0 3.9-1.9 5-3.9l.8-1.5c1-1.9 1.8-3 3.2-3l.1-2.2c-2.7 0-4.2 1.9-5.3 3.9l-.8 1.5c-1 1.9-1.8 3-3.2 3-1.4 0-2.6-1.1-2.6-2.4S3.4 9.6 4.8 9.6z\" class=\"f\"/><path d=\"M19.2 16.6c2.7 0 4.8-2.1 4.8-4.6s-2.1-4.6-4.8-4.6c-2.4 0-3.9 1.9-5 3.9l-.8 1.5c-1 1.9-1.8 3-3.2 3l-.1 2.2c2.7 0 4.2-1.9 5.3-3.9l.8-1.5c1-1.9 1.8-3 3.2-3 1.4 0 2.6 1.1 2.6 2.4s-1.2 2.4-2.6 2.4z\" class=\"f\"/>",
   "cat": "ops",
   "solid": true
  },
  "k8s_deploy": {
   "svg": "<path d=\"M12 1.8l8.4 4v8.8L12 22.2l-8.4-7.6V5.8zm0 2.5L5.8 7.2v6.4L12 19.2l6.2-5.6V7.2z\" class=\"f\"/><circle cx=\"12\" cy=\"12\" r=\"2.8\" class=\"f\"/><path d=\"M12 5v3.4M14.6 13.4l3.4 1.6M9.4 13.4L6 15\" class=\"fst\"/>",
   "cat": "ops",
   "solid": true
  },
  "a11y_audit": {
   "svg": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"8\" r=\"1.4\"/><path d=\"M8.5 11h7M12 11v3.5M9.5 19l2.5-4 2.5 4\"/>",
   "cat": "quality"
  },
  "product_discovery": {
   "svg": "<path d=\"M12 2.4A9.6 9.6 0 1012 21.6 9.6 9.6 0 0012 2.4zm0 2.2a7.4 7.4 0 110 14.8 7.4 7.4 0 010-14.8z\" class=\"f\"/><path d=\"M16.6 7.4l-2.6 6.6-6.6 2.6 2.6-6.6z\" class=\"f\"/><circle cx=\"12\" cy=\"12\" r=\"1.5\" class=\"ko\"/>",
   "cat": "strategy",
   "solid": true
  },
  "docs_portal": {
   "svg": "<path d=\"M3.2 4.4c3.2-1.4 6.2-1.4 8.8.4v14.8c-2.6-1.8-5.6-1.8-8.8-.4z\" class=\"f\"/><path d=\"M20.8 4.4c-3.2-1.4-6.2-1.4-8.8.4v14.8c2.6-1.8 5.6-1.8 8.8-.4z\" class=\"f\"/><path d=\"M6 9.2h3.2M6 12.2h3.2M14.8 9.2H18M14.8 12.2H18\" class=\"kos\"/>",
   "cat": "content",
   "solid": true
  },
  "mobile_app": {
   "svg": "<rect x=\"6\" y=\"2\" width=\"12\" height=\"20\" rx=\"2.4\"/><path d=\"M9 6h6\"/><circle cx=\"12\" cy=\"18.3\" r=\"0.9\"/>",
   "cat": "build"
  },
  "obs_slo": {
   "svg": "<path d=\"M3.2 3.4h2.2v15h15.4v2.2H3.2z\" class=\"f\"/><path d=\"M7 15.4l3.4-4 3 2.2 5.8-6\" class=\"fst\"/><circle cx=\"19.2\" cy=\"7.4\" r=\"2.4\" class=\"f\"/><circle cx=\"7\" cy=\"15.4\" r=\"1.7\" class=\"f\"/>",
   "cat": "ops",
   "solid": true
  },
  "code_onboarding": {
   "svg": "<path d=\"M9.2 3.6L3.4 5.8v14.6l5.8-2.2 5.6 2.2 5.8-2.2V3.6l-5.8 2.2z\" class=\"f\"/><path d=\"M9.2 5.8v12.4\" class=\"kos\"/><path d=\"M14.8 5.8v12.4\" class=\"kos\"/>",
   "cat": "research",
   "solid": true
  },
  "landing_page": {
   "svg": "<path d=\"M3 3.8h18v16.4H3z\" class=\"f\"/><path d=\"M3 8.2h18\" class=\"kos\"/><circle cx=\"6.4\" cy=\"6\" r=\"1.2\" class=\"ko\"/><path d=\"M6.4 12.2h7.2\" class=\"kos\"/><rect x=\"6.4\" y=\"14.8\" width=\"6.4\" height=\"3.2\" rx=\"1.6\" class=\"ko\"/>",
   "cat": "design",
   "solid": true
  },
  "growth_campaign": {
   "svg": "<path d=\"M3.4 9.4h3l6.6-3.8v12.8L6.4 14.6h-3z\" class=\"f\"/><path d=\"M14.8 16.2l2.6-3.8 2.4 2 1.6-5 2 .7-2.4 7.4-2.7-2.3-2.2 3.2z\" class=\"f\"/>",
   "cat": "strategy",
   "solid": true
  },
  "pitch_deck": {
   "svg": "<path d=\"M3.2 3.6h17.6v12.2H3.2z\" class=\"f\"/><path d=\"M10.9 16.4h2.2v3h2.6v2H8.3v-2h2.6z\" class=\"f\"/><path d=\"M7 11.6l3-3.4 2.6 2.2 4-4.6\" class=\"kos\"/>",
   "cat": "strategy",
   "solid": true
  },
  "solo": {
   "svg": "<path d=\"M12 3v8\"/><circle cx=\"12\" cy=\"3\" r=\"2\"/><circle cx=\"12\" cy=\"14\" r=\"3\"/><path d=\"M12 17v4\"/>",
   "cat": "build"
  },
  "quick_fix": {
   "svg": "<path d=\"M14.2 2.4l-1.6 7.2h4.9L9.8 21.6l1.6-7.6H6.6z\" class=\"f\"/><circle cx=\"12\" cy=\"11.8\" r=\"2\" class=\"ko\"/>",
   "cat": "build",
   "solid": true
  },
  "recon": {
   "svg": "<circle cx=\"12\" cy=\"10\" r=\"7\"/><path d=\"M17 15l4 4\"/><path d=\"M10 8l2 4 2-3\"/>",
   "cat": "research"
  },
  "trio": {
   "svg": "<path d=\"M12 5.6L18.6 17H5.4z\" opacity=\".4\"/><circle cx=\"12\" cy=\"5.6\" r=\"2.1\"/><circle cx=\"5.4\" cy=\"17\" r=\"2.1\"/><circle cx=\"18.6\" cy=\"17\" r=\"2.1\"/>",
   "cat": "build"
  },
  "reflect": {
   "svg": "<path d=\"M12 4v5M12 15v5\"/><path d=\"M12 9a4.5 4.5 0 110 6\"/><path d=\"M12 15a4.5 4.5 0 100-6\"/><circle cx=\"12\" cy=\"4\" r=\"1.5\" fill=\"currentColor\"/><circle cx=\"12\" cy=\"20\" r=\"1.5\" fill=\"currentColor\"/>",
   "cat": "quality"
  },
  "bug_hunt": {
   "svg": "<path d=\"M12 4.6A7.4 7.4 0 1012 19.4 7.4 7.4 0 0012 4.6zm0 2.2a5.2 5.2 0 110 10.4 5.2 5.2 0 010-10.4z\" class=\"f\"/><circle cx=\"12\" cy=\"12\" r=\"2.6\" class=\"f\"/><path d=\"M12 1.6v3.4M12 19v3.4M1.6 12h3.4M19 12h3.4\" class=\"fst\"/>",
   "cat": "quality",
   "solid": true
  },
  "content": {
   "svg": "<path d=\"M4 4h5v5H4zM4 15h5v5H4z\"/><path d=\"M15 4h5v5h-5zM15 15h5v5h-5z\"/><path d=\"M6.5 9v6M17.5 9v6M9 6.5h6M9 17.5h6\"/>",
   "cat": "content"
  },
  "plan_exec": {
   "svg": "<path d=\"M4 6.4h14M4 12h12M4 17.6h9\" opacity=\".4\"/><circle cx=\"20\" cy=\"6.4\" r=\"1.8\"/><circle cx=\"18\" cy=\"12\" r=\"1.8\"/><circle cx=\"15\" cy=\"17.6\" r=\"1.8\"/>",
   "cat": "build"
  },
  "perf_boost": {
   "svg": "<path d=\"M2.8 18.6l4.8-6.2 3.6 2.6 4.2-7.8 1.9 1-4.9 9.2-3.7-2.7-4.2 5.4z\" class=\"f\"/><circle cx=\"7.6\" cy=\"12.4\" r=\"2\" class=\"f\"/><circle cx=\"11.2\" cy=\"15\" r=\"2\" class=\"f\"/><path d=\"M14.6 3.2l6 1.6-1.6 6-1.9-2.5-3 2.3-1.6-2.1 3-2.3z\" class=\"f\"/>",
   "cat": "quality",
   "solid": true
  },
  "startup": {
   "svg": "<path d=\"M12 2.2l3 6.1 6.8 1-4.9 4.8 1.2 6.7L12 17.6l-6.1 3.2 1.2-6.7-4.9-4.8 6.8-1z\" class=\"f\"/><circle cx=\"12\" cy=\"10.4\" r=\"2.4\" class=\"ko\"/>",
   "cat": "build",
   "solid": true
  },
  "cascade": {
   "svg": "<rect x=\"3.4\" y=\"4\" width=\"5\" height=\"3.4\" rx=\"1\" opacity=\".45\"/><rect x=\"9.5\" y=\"10.3\" width=\"5\" height=\"3.4\" rx=\"1\" opacity=\".45\"/><rect x=\"15.6\" y=\"16.6\" width=\"5\" height=\"3.4\" rx=\"1\" opacity=\".45\"/><circle cx=\"8.4\" cy=\"7.4\" r=\"1.5\"/><circle cx=\"14.5\" cy=\"13.7\" r=\"1.5\"/><path d=\"M9.4 8.4l1 1M15.5 14.7l1 1\"/>",
   "cat": "build"
  },
  "test_suite": {
   "svg": "<path d=\"M3.4 4.2h17.2v15.6H3.4z\" class=\"f\"/><path d=\"M7 10.2l2.2 2.2 4.6-4.8\" class=\"kos\"/><circle cx=\"7.6\" cy=\"16.2\" r=\"1.5\" class=\"ko\"/><circle cx=\"12\" cy=\"16.2\" r=\"1.5\" class=\"ko\"/><circle cx=\"16.4\" cy=\"16.2\" r=\"1.5\" class=\"ko\"/>",
   "cat": "quality",
   "solid": true
  },
  "a11y": {
   "svg": "<circle cx=\"12\" cy=\"5\" r=\"2.5\"/><path d=\"M4 10h16\"/><path d=\"M12 10v5\"/><path d=\"M8 21l4-6 4 6\"/>",
   "cat": "design"
  },
  "security": {
   "svg": "<path d=\"M12 2.2l8.4 3.6v6c0 5.4-3.6 10.2-8.4 12.4-4.8-2.2-8.4-7-8.4-12.4v-6z\" class=\"f\"/><path d=\"M8.4 12.2l2.5 2.5 4.7-5.2\" class=\"kos\"/>",
   "cat": "quality",
   "solid": true
  },
  "review": {
   "svg": "<path d=\"M10.6 3a7.6 7.6 0 105.1 13.2l4 4 1.6-1.6-4-4A7.6 7.6 0 0010.6 3zm0 2.2a5.4 5.4 0 110 10.8 5.4 5.4 0 010-10.8z\" class=\"f\"/><path d=\"M7.6 9.4h6M7.6 12.2h3.6\" class=\"fs\"/>",
   "cat": "quality",
   "solid": true
  },
  "design_sys": {
   "svg": "<circle cx=\"12\" cy=\"12\" r=\"9\"/><circle cx=\"12\" cy=\"12\" r=\"5\" stroke-dasharray=\"3 2\"/><circle cx=\"12\" cy=\"12\" r=\"1.5\" fill=\"currentColor\"/><path d=\"M12 3v3M12 18v3M3 12h3M18 12h3\"/>",
   "cat": "design"
  },
  "api_modern": {
   "svg": "<path d=\"M4 8h5v8H4z\"/><path d=\"M15 8h5v8h-5z\"/><path d=\"M9 10h6M9 14h6\"/><circle cx=\"12\" cy=\"12\" r=\"1.5\" fill=\"currentColor\"/>",
   "cat": "build"
  },
  "ui_overhaul": {
   "svg": "<path d=\"M2.8 3.2h18.4v17.6H2.8z\" class=\"f\"/><rect x=\"5.6\" y=\"6\" width=\"5.6\" height=\"5.6\" rx=\"1.4\" class=\"ko\"/><path d=\"M13.4 7.4h4.8M13.4 10.2h3.4M5.6 15.4h12.6M5.6 18h8\" class=\"kos\"/>",
   "cat": "design",
   "solid": true
  },
  "feature_sprint": {
   "svg": "<circle cx=\"4.4\" cy=\"12\" r=\"2.8\" class=\"f\"/><rect x=\"6.4\" y=\"11\" width=\"8\" height=\"2\" rx=\"1\" class=\"f\"/><path d=\"M13.6 5.8L19.8 12l-6.2 6.2-1.6-1.6L16.6 12l-4.6-4.6z\" class=\"f\"/>",
   "cat": "build",
   "solid": true
  },
  "standard": {
   "svg": "<circle cx=\"12\" cy=\"4\" r=\"2.5\"/><circle cx=\"5\" cy=\"12\" r=\"2\"/><circle cx=\"19\" cy=\"12\" r=\"2\"/><circle cx=\"8\" cy=\"20\" r=\"2\"/><circle cx=\"16\" cy=\"20\" r=\"2\"/><path d=\"M12 6.5v-0M10 6l-4 4.5M14 6l4 4.5M5.5 14l2 4M18.5 14l-2 4\"/>",
   "cat": "build"
  },
  "data_pipe": {
   "svg": "<path d=\"M2.4 4.4h19.2v2.2l-7.4 8.2v8L9.8 20v-5.2L2.4 6.6z\" class=\"f\"/><circle cx=\"12\" cy=\"12.4\" r=\"1.9\" class=\"ko\"/>",
   "cat": "data",
   "solid": true
  },
  "research": {
   "svg": "<circle cx=\"12\" cy=\"12\" r=\"2.8\"/><circle cx=\"12\" cy=\"3.4\" r=\"1.6\"/><circle cx=\"19.4\" cy=\"7.7\" r=\"1.6\"/><circle cx=\"19.4\" cy=\"16.3\" r=\"1.6\"/><circle cx=\"12\" cy=\"20.6\" r=\"1.6\"/><circle cx=\"4.6\" cy=\"16.3\" r=\"1.6\"/><circle cx=\"4.6\" cy=\"7.7\" r=\"1.6\"/><path d=\"M12 5v4.2M18 8.6l-3.6 2M18 15.4l-3.6-2M12 19v-4.2M6 15.4l3.6-2M6 8.6l3.6 2\" opacity=\".55\"/>",
   "cat": "research"
  },
  "legacy": {
   "svg": "<path d=\"M3 3.2h18v17.6H3z\" class=\"f\"/><path d=\"M3 8.2h18M8.4 8.2v12.6\" class=\"kos\"/><circle cx=\"5.7\" cy=\"5.7\" r=\"1.2\" class=\"ko\"/><path d=\"M11 12.4h6.4M11 16.4h4.4\" class=\"kos\"/>",
   "cat": "ops",
   "solid": true
  },
  "saas": {
   "svg": "<path d=\"M17.6 10.6a5.6 5.6 0 00-10.8-1.4A4.6 4.6 0 007.4 18.4h10a4 4 0 00.2-7.8z\" class=\"f\"/><rect x=\"6.8\" y=\"19.6\" width=\"2.2\" height=\"3\" rx=\"1.1\" class=\"f\"/><rect x=\"10.9\" y=\"19.6\" width=\"2.2\" height=\"3\" rx=\"1.1\" class=\"f\"/><rect x=\"15\" y=\"19.6\" width=\"2.2\" height=\"3\" rx=\"1.1\" class=\"f\"/>",
   "cat": "build",
   "solid": true
  },
  "microservices": {
   "svg": "<rect x=\"2\" y=\"2\" width=\"6\" height=\"6\" rx=\"1.5\"/><rect x=\"9\" y=\"2\" width=\"6\" height=\"6\" rx=\"1.5\"/><rect x=\"16\" y=\"2\" width=\"6\" height=\"6\" rx=\"1.5\"/><rect x=\"2\" y=\"16\" width=\"6\" height=\"6\" rx=\"1.5\"/><rect x=\"9\" y=\"16\" width=\"6\" height=\"6\" rx=\"1.5\"/><rect x=\"16\" y=\"16\" width=\"6\" height=\"6\" rx=\"1.5\"/><path d=\"M5 8v8M12 8v8M19 8v8\"/>",
   "cat": "build"
  },
  "full": {
   "svg": "<circle cx=\"12\" cy=\"4.2\" r=\"3\" class=\"f\"/><circle cx=\"5.4\" cy=\"11.6\" r=\"2.4\" class=\"f\"/><circle cx=\"18.6\" cy=\"11.6\" r=\"2.4\" class=\"f\"/><circle cx=\"3.6\" cy=\"19.6\" r=\"2\" class=\"f\"/><circle cx=\"9\" cy=\"19.6\" r=\"2\" class=\"f\"/><circle cx=\"15\" cy=\"19.6\" r=\"2\" class=\"f\"/><circle cx=\"20.4\" cy=\"19.6\" r=\"2\" class=\"f\"/><path d=\"M12 4.2L5.4 11.6M12 4.2l6.6 7.4M5.4 11.6L3.6 19.6M5.4 11.6L9 19.6M18.6 11.6L15 19.6M18.6 11.6l1.8 8\" class=\"fs\"/>",
   "cat": "build",
   "solid": true
  },
  "deep": {
   "svg": "<path d=\"M12 1.8l9.4 5.2v10L12 22.2 2.6 17V7zm0 2.5L4.8 8.3v7.4l7.2 4 7.2-4V8.3z\" class=\"f\"/><circle cx=\"12\" cy=\"12\" r=\"2.8\" class=\"f\"/><path d=\"M4.8 8.3L12 12m0 0l7.2-3.7M12 12v8\" class=\"fst\"/>",
   "cat": "build",
   "solid": true
  },
  "five_minds": {
   "svg": "<circle cx=\"12\" cy=\"4.8\" r=\"2.6\"/><circle cx=\"4.4\" cy=\"10.4\" r=\"2.3\"/><circle cx=\"19.6\" cy=\"10.4\" r=\"2.3\"/><circle cx=\"7.4\" cy=\"19.4\" r=\"2.3\"/><circle cx=\"16.6\" cy=\"19.4\" r=\"2.3\"/><path d=\"M9.6 6.2L6.4 8.9M14.4 6.2l3.2 2.7M5.4 12.5l1.4 4.8M18.6 12.5l-1.4 4.8M9.7 19.4h4.6\" opacity=\".5\"/>",
   "cat": "strategy"
  },
  "deep_five_minds": {
   "svg": "<path d=\"M12 .6l3.4 4.4H8.6z\" class=\"f\"/><circle cx=\"12\" cy=\"12.4\" r=\"5.4\" class=\"f\"/><circle cx=\"12\" cy=\"12.4\" r=\"2.2\" class=\"ko\"/><circle cx=\"2.6\" cy=\"6.4\" r=\"2.2\" class=\"f\"/><circle cx=\"21.4\" cy=\"6.4\" r=\"2.2\" class=\"f\"/><circle cx=\"2.6\" cy=\"17.8\" r=\"2.2\" class=\"f\"/><circle cx=\"21.4\" cy=\"17.8\" r=\"2.2\" class=\"f\"/><path d=\"M12 5.4v2M4.4 7.4l3.6 2.2M19.6 7.4L16 9.6M4.4 16.8L8 14.6M19.6 16.8L16 14.6\" class=\"fst\"/>",
   "cat": "strategy",
   "solid": true
  },
  "deep_research_swarm_pro": {
   "svg": "<circle cx=\"12\" cy=\"12\" r=\"3.2\"/><circle cx=\"12\" cy=\"12\" r=\"1.3\" opacity=\".5\"/><circle cx=\"12\" cy=\"3\" r=\"1.5\"/><circle cx=\"19\" cy=\"6.4\" r=\"1.5\"/><circle cx=\"21\" cy=\"14\" r=\"1.5\"/><circle cx=\"16\" cy=\"20.4\" r=\"1.5\"/><circle cx=\"8\" cy=\"20.4\" r=\"1.5\"/><circle cx=\"3\" cy=\"14\" r=\"1.5\"/><circle cx=\"5\" cy=\"6.4\" r=\"1.5\"/><path d=\"M12 4.5v4.3M17.9 7.5l-3.4 3M19.6 13.6l-4.3-1M15.2 19l-1.6-4M10.4 19l1.6-4M4.4 13.6l4.3-1M6.1 7.5l3.4 3\" opacity=\".5\"/>",
   "cat": "research"
  },
  "migration_crew": {
   "svg": "<rect x=\"2\" y=\"3.8\" width=\"5.6\" height=\"4\" rx=\"1.2\" class=\"f\"/><rect x=\"2\" y=\"10\" width=\"5.6\" height=\"4\" rx=\"1.2\" class=\"f\"/><rect x=\"2\" y=\"16.2\" width=\"5.6\" height=\"4\" rx=\"1.2\" class=\"f\"/><rect x=\"16.4\" y=\"3.8\" width=\"5.6\" height=\"4\" rx=\"1.2\" class=\"f\"/><rect x=\"16.4\" y=\"10\" width=\"5.6\" height=\"4\" rx=\"1.2\" class=\"f\"/><rect x=\"16.4\" y=\"16.2\" width=\"5.6\" height=\"4\" rx=\"1.2\" class=\"f\"/><path d=\"M12.4 3.8l3 2-3 2v-1.2H8.4V5h4zM12.4 10l3 2-3 2v-1.2H8.4v-1.6h4zM12.4 16.2l3 2-3 2V19H8.4v-1.6h4z\" class=\"f\"/>",
   "cat": "ops",
   "solid": true
  },
  "fullstack_premium": {
   "svg": "<rect x=\"3\" y=\"5.4\" width=\"18\" height=\"4\" rx=\"1.6\" class=\"f\"/><rect x=\"3\" y=\"10.2\" width=\"18\" height=\"4\" rx=\"1.6\" class=\"f\"/><rect x=\"3\" y=\"15\" width=\"18\" height=\"4\" rx=\"1.6\" class=\"f\"/><circle cx=\"6.6\" cy=\"7.4\" r=\"1.3\" class=\"ko\"/><circle cx=\"6.6\" cy=\"12.2\" r=\"1.3\" class=\"ko\"/><circle cx=\"6.6\" cy=\"17\" r=\"1.3\" class=\"ko\"/><path d=\"M9.4 1.4l1.4 2 1.2-1 1.2 1 1.4-2 1.8 1.2-2.6 3.6-1.8-1.5-1.8 1.5-2.6-3.6z\" class=\"f\"/>",
   "cat": "build",
   "solid": true
  },
  "security_multi_vector": {
   "svg": "<path d=\"M12 3.4l7.2 3.2v5.2c0 4.8-3.2 9-7.2 10.8-4-1.8-7.2-6-7.2-10.8V6.6z\" opacity=\".4\"/><path d=\"M9 12l2.1 2.1 4-4.4\"/><circle cx=\"3.2\" cy=\"8\" r=\"1.3\"/><circle cx=\"20.8\" cy=\"8\" r=\"1.3\"/><circle cx=\"3.2\" cy=\"15\" r=\"1.3\"/><circle cx=\"20.8\" cy=\"15\" r=\"1.3\"/><path d=\"M4.5 8.4l1.2.5M19.5 8.4l-1.2.5M4.5 14.6l1.2-.5M19.5 14.6l-1.2-.5\" opacity=\".55\"/>",
   "cat": "quality"
  },
  "perf_squad": {
   "svg": "<path d=\"M14 2l-9.8 12.6h6.6L9.8 22l9.8-12.6h-6.6z\" class=\"f\"/><circle cx=\"12\" cy=\"12\" r=\"2.1\" class=\"ko\"/>",
   "cat": "quality",
   "solid": true
  },
  "prd_to_launch": {
   "svg": "<path d=\"M12 1.6c2.6 2.6 3.9 6 3.9 9.4 0 3-1 5.8-2.8 8.2h-2.2c-1.8-2.4-2.8-5.2-2.8-8.2 0-3.4 1.3-6.8 3.9-9.4z\" class=\"f\"/><circle cx=\"12\" cy=\"9.2\" r=\"2\" class=\"ko\"/><path d=\"M8.6 13.8L5 17.4l3.8 1.2zM15.4 13.8l3.6 3.6-3.8 1.2z\" class=\"f\"/><path d=\"M10.4 20.8L12 19l1.6 1.8-1.6 1.6z\" class=\"f\"/>",
   "cat": "build",
   "solid": true
  },
  "ab_test_lab": {
   "svg": "<path d=\"M8.6 2.4h6.8v2.2h-.8v4.2l4.5 9a2.6 2.6 0 01-2.3 3.8H7.2a2.6 2.6 0 01-2.3-3.8l4.5-9V4.6h-.8z\" class=\"f\"/><path d=\"M12 11.4v9.2\" class=\"kos\"/><circle cx=\"9.4\" cy=\"16.4\" r=\"1.5\" class=\"ko\"/><circle cx=\"14.6\" cy=\"16.4\" r=\"1.5\" class=\"ko\"/>",
   "cat": "strategy",
   "solid": true
  },
  "kb_constructor": {
   "svg": "<path d=\"M3.2 3.4h7.8v17.2H3.2zM13 3.4h7.8v17.2H13z\" class=\"f\"/><path d=\"M3.2 8.2h7.8M13 8.2h7.8M3.2 12.6h7.8M13 12.6h7.8\" class=\"kos\"/><circle cx=\"7.1\" cy=\"17\" r=\"1.4\" class=\"ko\"/><circle cx=\"16.9\" cy=\"17\" r=\"1.4\" class=\"ko\"/>",
   "cat": "research",
   "solid": true
  },
  "tech_writing_pipe": {
   "svg": "<path d=\"M4.6 2.8h10.6l4.2 4.2v14.2H4.6z\" class=\"f\"/><path d=\"M14.6 3.4v4.2h4.2\" class=\"kos\"/><path d=\"M7.6 11.4h8.8M7.6 15h8.8M7.6 18.2h5.4\" class=\"kos\"/>",
   "cat": "content",
   "solid": true
  },
  "five_minds_strategic": {
   "svg": "<circle cx=\"12\" cy=\"4.2\" r=\"2.8\" class=\"f\"/><circle cx=\"4.4\" cy=\"10.2\" r=\"2.5\" class=\"f\"/><circle cx=\"19.6\" cy=\"10.2\" r=\"2.5\" class=\"f\"/><circle cx=\"7.4\" cy=\"19.4\" r=\"2.5\" class=\"f\"/><circle cx=\"16.6\" cy=\"19.4\" r=\"2.5\" class=\"f\"/><circle cx=\"12\" cy=\"12.6\" r=\"2.2\" class=\"f\"/><path d=\"M12 4.2v8.4M4.4 10.2l7.6 2.4M19.6 10.2L12 12.6M7.4 19.4l4.6-6.8M16.6 19.4L12 12.6\" class=\"fs\"/>",
   "cat": "strategy",
   "solid": true
  },
  "soc2_sweep": {
   "svg": "<path d=\"M12 2.2l8 3v6c0 5.2-3.5 9.8-8 12-4.5-2.2-8-6.8-8-12V5.2z\" class=\"f\"/><rect x=\"7.2\" y=\"8\" width=\"2.6\" height=\"2.6\" rx=\".7\" class=\"ko\"/><rect x=\"11.4\" y=\"8\" width=\"2.6\" height=\"2.6\" rx=\".7\" class=\"ko\"/><rect x=\"7.2\" y=\"12.2\" width=\"2.6\" height=\"2.6\" rx=\".7\" class=\"ko\"/><path d=\"M12.6 14l1.8 1.8 2.8-3.2\" class=\"kos\"/>",
   "cat": "ops",
   "solid": true
  },
  "data_analysis_pipe": {
   "svg": "<path d=\"M3 4h18l-7 8v9l-4-2v-7z\"/><circle cx=\"19\" cy=\"18\" r=\"2\"/><path d=\"M16 18h1\"/>",
   "cat": "data"
  },
  "incident_war_room": {
   "svg": "<path d=\"M12 2.6l10.4 19.4H1.6z\" class=\"f\"/><rect x=\"10.9\" y=\"10\" width=\"2.2\" height=\"5.4\" rx=\"1.1\" class=\"ko\"/><circle cx=\"12\" cy=\"18.2\" r=\"1.4\" class=\"ko\"/>",
   "cat": "ops",
   "solid": true
  },
  "voice": {
   "svg": "<path d=\"M4 20l3.5-1 9.5-9.5-2.5-2.5L5 16.5z\"/><path d=\"M14 5.5l2.5 2.5\"/><path d=\"M4 20l1-3\"/>",
   "cat": "content"
  },
  "content_social": {
   "svg": "<path d=\"M3.6 9.2h3.2l7.4-4v13.6l-7.4-4H3.6z\" class=\"f\"/><path d=\"M16.4 8.6a5.2 5.2 0 010 6.8l1.6 1.4a7.4 7.4 0 000-9.6z\" class=\"f\"/><path d=\"M19.4 6a9 9 0 010 12l1.6 1.4a11.2 11.2 0 000-14.8z\" class=\"f\" opacity=\".55\"/>",
   "cat": "content",
   "solid": true
  },
  "kariera": {
   "svg": "<rect x=\"3\" y=\"7.5\" width=\"18\" height=\"12\" rx=\"2\"/><path d=\"M8 7.5V5.5a2 2 0 012-2h4a2 2 0 012 2v2\"/><path d=\"M3 12.5h18\"/><path d=\"M11 12.5h2\"/>",
   "cat": "content"
  },
  "kuchmistrz": {
   "svg": "<path d=\"M4.4 13.2h12v1.4a6 6 0 01-6 6 6 6 0 01-6-6z\" class=\"f\"/><rect x=\"16.4\" y=\"13.4\" width=\"4.6\" height=\"2\" rx=\"1\" class=\"f\"/><path d=\"M6.4 11.6c-1.6-.6-2.4-1.9-2.4-3.3a3 3 0 015.2-2 3 3 0 015.2 0 3 3 0 015.2 2c0 1.4-.8 2.7-2.4 3.3z\" class=\"f\"/><circle cx=\"10.8\" cy=\"17\" r=\"1.6\" class=\"ko\"/>",
   "cat": "strategy",
   "solid": true
  },
  "decision_research": {
   "svg": "<rect x=\"10.9\" y=\"5.6\" width=\"2.2\" height=\"13.8\" rx=\"1\" class=\"f\"/><rect x=\"6.2\" y=\"18.6\" width=\"11.6\" height=\"2.2\" rx=\"1.1\" class=\"f\"/><rect x=\"4.6\" y=\"8.4\" width=\"14.8\" height=\"2\" rx=\"1\" class=\"f\"/><circle cx=\"12\" cy=\"5\" r=\"2.4\" class=\"f\"/><path d=\"M5 10.8l-3 5.2a3.4 3.4 0 006 0z\" class=\"f\"/><path d=\"M19 10.8l-3 5.2a3.4 3.4 0 006 0z\" class=\"f\"/>",
   "cat": "strategy",
   "solid": true
  },
  "deep_research_v2": {
   "svg": "<circle cx=\"5\" cy=\"6\" r=\"2\"/><circle cx=\"5\" cy=\"18\" r=\"2\"/><circle cx=\"19\" cy=\"12\" r=\"2\"/><path d=\"M7 6h4l6 5M7 18h4l6-5\"/>",
   "cat": "research"
  },
  "bento_redesign": {
   "svg": "<rect x=\"3\" y=\"3\" width=\"8\" height=\"8\" rx=\"1.8\" class=\"f\"/><rect x=\"13\" y=\"3\" width=\"8\" height=\"4.8\" rx=\"1.8\" class=\"f\"/><rect x=\"13\" y=\"9.8\" width=\"8\" height=\"11.2\" rx=\"1.8\" class=\"f\"/><rect x=\"3\" y=\"13\" width=\"8\" height=\"8\" rx=\"1.8\" class=\"f\"/>",
   "cat": "design",
   "solid": true
  }
 },
 "categories": {
  "research": {
   "name": "调研",
   "dark": "#22D3EE",
   "light": "#0E7490",
   "note": "用于深度调研与知识综合的预设。"
  },
  "build": {
   "name": "构建",
   "dark": "#A3E635",
   "light": "#4D7C0F",
   "note": "用于构建的预设：从简单修复到完整应用。"
  },
  "quality": {
   "name": "质量",
   "dark": "#F87171",
   "light": "#DC2626",
   "note": "用于质量保障的预设：测试、安全、审计、性能。"
  },
  "content": {
   "name": "内容",
   "dark": "#FBBF24",
   "light": "#A16207",
   "note": "用于内容生产的预设：文章、文档、用你的文风写的帖子。"
  },
  "strategy": {
   "name": "战略",
   "dark": "#818CF8",
   "light": "#4338CA",
   "note": "用于决策的预设：辩论、优先级、产品探索。"
  },
  "ops": {
   "name": "运维",
   "dark": "#34D399",
   "light": "#047857",
   "note": "用于运维的预设：事件、迁移、CI/CD、部署。"
  },
  "data": {
   "name": "数据",
   "dark": "#C084FC",
   "light": "#7E22CE",
   "note": "用于数据与 AI 的预设：流水线、RAG、MLOps、分析。"
  },
  "design": {
   "name": "设计",
   "dark": "#F472B6",
   "light": "#BE185D",
   "note": "用于设计的预设：设计系统、重设计、无障碍、UI。"
  }
 },
 "catColors": {
  "QA / AUDYT": {
   "dark": "#F87171",
   "light": "#DC2626"
  },
  "COMPLIANCE": {
   "dark": "#FB923C",
   "light": "#C2410C"
  },
  "PRODUKT": {
   "dark": "#FBBF24",
   "light": "#A16207"
  },
  "BUILD": {
   "dark": "#A3E635",
   "light": "#4D7C0F"
  },
  "OPS": {
   "dark": "#34D399",
   "light": "#047857"
  },
  "RESEARCH": {
   "dark": "#22D3EE",
   "light": "#0E7490"
  },
  "PLANOWANIE": {
   "dark": "#3B82F6",
   "light": "#1D4ED8"
  },
  "STRATEGIA": {
   "dark": "#818CF8",
   "light": "#4338CA"
  },
  "DANE": {
   "dark": "#C084FC",
   "light": "#7E22CE"
  },
  "FIVE MINDS": {
   "dark": "#F472B6",
   "light": "#BE185D"
  },
  "HITL": {
   "dark": "#E2E8F0",
   "light": "#475569"
  },
  "CUSTOM": {
   "dark": "#A8A29E",
   "light": "#57534E"
  }
 },
 "agentColors": {
  "dark": {
   "ml_engineer": "#7DD3FC",
   "data_engineer": "#A78BFA",
   "ai_engineer": "#67E8F9",
   "prompt_engineer": "#C4B5FD",
   "devops_engineer": "#5EEAD4",
   "cloud_architect": "#7DD3FC",
   "sre_engineer": "#FCA5A5",
   "kubernetes_specialist": "#818CF8",
   "accessibility_tester": "#C084FC",
   "product_manager": "#FBBF24",
   "ux_researcher": "#22D3EE",
   "technical_writer": "#38BDF8",
   "mobile_developer": "#22D3EE",
   "orchestrator": "#FBBF24",
   "synthesizer": "#A78BFA",
   "analyst": "#818CF8",
   "planner": "#60A5FA",
   "res_tech": "#22D3EE",
   "res_ux": "#F472B6",
   "res_reddit": "#FB923C",
   "res_x": "#38BDF8",
   "res_github": "#A3E635",
   "res_forums": "#818CF8",
   "res_docs": "#94A3B8",
   "res_critic": "#F87171",
   "res_extractor": "#38BDF8",
   "synthesizer_lean": "#A78BFA",
   "backend": "#34D399",
   "frontend": "#60A5FA",
   "feature": "#C084FC",
   "designer": "#F472B6",
   "integrator": "#2DD4BF",
   "writer": "#FCD34D",
   "style_profiler": "#A5B4FC",
   "voice_qa": "#DDD6FE",
   "social_strategist": "#D8B4FE",
   "career_document_builder": "#67E8F9",
   "interview_coach": "#2DD4BF",
   "recipe_scout": "#FDBA74",
   "taste_recommender": "#FBBF24",
   "recipe_filter": "#FCD34D",
   "decision_advisor": "#93C5FD",
   "voice_writer": "#C4B5FD",
   "qa_security": "#F87171",
   "qa_quality": "#34D399",
   "qa_perf": "#FB923C",
   "qa_manager": "#818CF8",
   "expert_pragmatist": "#FBBF24",
   "expert_innovator": "#22D3EE",
   "expert_analyst": "#60A5FA",
   "expert_user": "#F472B6",
   "expert_devil": "#EF4444",
   "decision_presenter": "#E879F9",
   "db_architect": "#60A5FA",
   "observability_engineer": "#22D3EE",
   "gtm_strategist": "#F472B6",
   "statistician": "#A78BFA",
   "eda_analyst": "#22D3EE",
   "control_mapper": "#FBBF24",
   "telemetry_surfer": "#FB923C"
  },
  "light": {
   "ml_engineer": "#0369A1",
   "data_engineer": "#7C3AED",
   "ai_engineer": "#0891B2",
   "prompt_engineer": "#7C3AED",
   "devops_engineer": "#0D9488",
   "cloud_architect": "#0284C7",
   "sre_engineer": "#DC2626",
   "kubernetes_specialist": "#4F46E5",
   "accessibility_tester": "#9333EA",
   "product_manager": "#B45309",
   "ux_researcher": "#0891B2",
   "technical_writer": "#0284C7",
   "mobile_developer": "#0891B2",
   "orchestrator": "#B45309",
   "synthesizer": "#7C3AED",
   "analyst": "#4F46E5",
   "planner": "#2563EB",
   "res_tech": "#0891B2",
   "res_ux": "#DB2777",
   "res_reddit": "#C2410C",
   "res_x": "#0284C7",
   "res_github": "#65A30D",
   "res_forums": "#4F46E5",
   "res_docs": "#64748B",
   "res_critic": "#DC2626",
   "res_extractor": "#0284C7",
   "synthesizer_lean": "#7C3AED",
   "backend": "#059669",
   "frontend": "#2563EB",
   "feature": "#9333EA",
   "designer": "#DB2777",
   "integrator": "#0D9488",
   "writer": "#A16207",
   "style_profiler": "#6366F1",
   "voice_qa": "#8B5CF6",
   "social_strategist": "#9333EA",
   "career_document_builder": "#0891B2",
   "interview_coach": "#0D9488",
   "recipe_scout": "#EA580C",
   "taste_recommender": "#D97706",
   "recipe_filter": "#B45309",
   "decision_advisor": "#2563EB",
   "voice_writer": "#7C3AED",
   "qa_security": "#DC2626",
   "qa_quality": "#059669",
   "qa_perf": "#C2410C",
   "qa_manager": "#4F46E5",
   "expert_pragmatist": "#B45309",
   "expert_innovator": "#0891B2",
   "expert_analyst": "#2563EB",
   "expert_user": "#DB2777",
   "expert_devil": "#B91C1C",
   "decision_presenter": "#A21CAF",
   "db_architect": "#2563EB",
   "observability_engineer": "#0891B2",
   "gtm_strategist": "#DB2777",
   "statistician": "#7C3AED",
   "eda_analyst": "#0891B2",
   "control_mapper": "#B45309",
   "telemetry_surfer": "#C2410C"
  }
 },
 "presetColors": {
  "dark": {
   "solo": "#60A5FA",
   "quick_fix": "#FB923C",
   "recon": "#22D3EE",
   "trio": "#34D399",
   "reflect": "#A78BFA",
   "bug_hunt": "#F87171",
   "content": "#FCD34D",
   "plan_exec": "#818CF8",
   "perf_boost": "#FB923C",
   "startup": "#FBBF24",
   "cascade": "#2DD4BF",
   "test_suite": "#F87171",
   "a11y": "#C084FC",
   "security": "#EF4444",
   "review": "#60A5FA",
   "design_sys": "#F472B6",
   "api_modern": "#22D3EE",
   "ui_overhaul": "#A78BFA",
   "feature_sprint": "#34D399",
   "standard": "#818CF8",
   "data_pipe": "#2DD4BF",
   "research": "#38BDF8",
   "legacy": "#94A3B8",
   "saas": "#60A5FA",
   "microservices": "#C084FC",
   "full": "#FBBF24",
   "deep": "#22D3EE",
   "five_minds": "#FCD34D",
   "deep_five_minds": "#FBBF24",
   "deep_research_swarm_pro": "#22D3EE",
   "migration_crew": "#60A5FA",
   "fullstack_premium": "#34D399",
   "security_multi_vector": "#EF4444",
   "perf_squad": "#FB923C",
   "prd_to_launch": "#FBBF24",
   "ab_test_lab": "#C084FC",
   "kb_constructor": "#38BDF8",
   "tech_writing_pipe": "#FCD34D",
   "five_minds_strategic": "#FBBF24",
   "soc2_sweep": "#2DD4BF",
   "data_analysis_pipe": "#A78BFA",
   "incident_war_room": "#F87171",
   "devops_cicd": "#5EEAD4",
   "k8s_deploy": "#818CF8",
   "a11y_audit": "#C084FC",
   "product_discovery": "#FBBF24",
   "docs_portal": "#38BDF8",
   "mobile_app": "#22D3EE",
   "obs_slo": "#2DD4BF",
   "code_onboarding": "#60A5FA",
   "landing_page": "#FB7185",
   "growth_campaign": "#FCD34D",
   "pitch_deck": "#F59E0B",
   "mlops": "#A78BFA",
   "rag_app": "#22D3EE",
   "voice": "#F472B6",
   "content_social": "#FCD34D",
   "kariera": "#60A5FA",
   "kuchmistrz": "#FB923C",
   "decision_research": "#38BDF8",
   "deep_research_v2": "#2DD4BF",
   "bento_redesign": "#C084FC"
  },
  "light": {
   "solo": "#2563EB",
   "quick_fix": "#C2410C",
   "recon": "#0891B2",
   "trio": "#059669",
   "reflect": "#7C3AED",
   "bug_hunt": "#DC2626",
   "content": "#A16207",
   "plan_exec": "#4F46E5",
   "perf_boost": "#C2410C",
   "startup": "#B45309",
   "cascade": "#0D9488",
   "test_suite": "#DC2626",
   "a11y": "#9333EA",
   "security": "#B91C1C",
   "review": "#2563EB",
   "design_sys": "#DB2777",
   "api_modern": "#0891B2",
   "ui_overhaul": "#7C3AED",
   "feature_sprint": "#059669",
   "standard": "#4F46E5",
   "data_pipe": "#0D9488",
   "research": "#0284C7",
   "legacy": "#64748B",
   "saas": "#2563EB",
   "microservices": "#9333EA",
   "full": "#B45309",
   "deep": "#0891B2",
   "five_minds": "#A16207",
   "deep_five_minds": "#B45309",
   "deep_research_swarm_pro": "#0891B2",
   "migration_crew": "#2563EB",
   "fullstack_premium": "#059669",
   "security_multi_vector": "#B91C1C",
   "perf_squad": "#C2410C",
   "prd_to_launch": "#B45309",
   "ab_test_lab": "#9333EA",
   "kb_constructor": "#0284C7",
   "tech_writing_pipe": "#A16207",
   "five_minds_strategic": "#B45309",
   "soc2_sweep": "#0D9488",
   "data_analysis_pipe": "#7C3AED",
   "incident_war_room": "#DC2626",
   "devops_cicd": "#0D9488",
   "k8s_deploy": "#4F46E5",
   "a11y_audit": "#9333EA",
   "product_discovery": "#B45309",
   "docs_portal": "#0284C7",
   "mobile_app": "#0891B2",
   "obs_slo": "#0F766E",
   "code_onboarding": "#2563EB",
   "landing_page": "#E11D48",
   "growth_campaign": "#CA8A04",
   "pitch_deck": "#92400E",
   "mlops": "#7C3AED",
   "rag_app": "#0891B2",
   "voice": "#DB2777",
   "content_social": "#A16207",
   "kariera": "#2563EB",
   "kuchmistrz": "#C2410C",
   "decision_research": "#0284C7",
   "deep_research_v2": "#0D9488",
   "bento_redesign": "#9333EA"
  }
 }
};
