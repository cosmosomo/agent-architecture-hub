/* The built-in agent catalogue (60 agents), the 62 sample teams (nodes and edges laid out by hand) and the small lookup tables
   the observatory needs. Taken once from the concept board (concept/index.html); this file is the source now. */
window.HUB = window.HUB || {};
HUB.base = {
 "agents": {
  "ml_engineer": {
   "id": "ml_engineer",
   "nameEn": "ML Engineer",
   "cat": "DANE",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Trains, deploys, and monitors ML models on your data. Feature engineering, honest evaluation on a test set, deployment, and MLOps: drift monitoring, retraining, versioning. It trains your own model, not a prompt to a ready one. Works in Polish and English.",
   "tools": "Read, Write, Bash"
  },
  "data_engineer": {
   "id": "data_engineer",
   "nameEn": "Data Engineer",
   "cat": "DANE",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Designs and builds data pipelines (ingest, ETL, warehouse) with quality control that feed analytics and ML. Treats data as a product: versioned schemas, orchestration, tests and alerts. Does not train models or do business analysis. Works in Polish and English.",
   "tools": "Read, Write, Bash"
  },
  "ai_engineer": {
   "id": "ai_engineer",
   "nameEn": "AI Engineer",
   "cat": "DANE",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Builds LLM-powered applications: RAG systems, assistants, prompt pipelines, and model API integrations. Combines retrieval (vector DB) with generation and balances cost, latency, and quality. Does not train models from scratch - it assembles systems from ready models and measures them with evaluation. Works in Polish and English.",
   "tools": "Read, Write, Bash, WebSearch, WebFetch"
  },
  "prompt_engineer": {
   "id": "prompt_engineer",
   "nameEn": "Prompt Engineer",
   "cat": "DANE",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Turns a vague requirement into a precise instruction: role, task, examples, and explicit output format. Treats a prompt like code - designs variants, tests them on a shared set, and picks the winner by metric, not hunch. Adds few-shot only where it raises quality. Works in Polish and English.",
   "tools": "Read, Write, WebSearch"
  },
  "devops_engineer": {
   "id": "devops_engineer",
   "nameEn": "DevOps Engineer",
   "cat": "OPS",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Automates the path from commit to production: CI/CD pipelines, Infrastructure as Code (Terraform/Ansible), deployment strategies (blue-green, canary) with rollback, environment and secret management. Shortens the delivery loop and ensures repeatability. Does not design cloud architecture or define SLOs. Works in Polish and English.",
   "tools": "Read, Write, Bash"
  },
  "cloud_architect": {
   "id": "cloud_architect",
   "nameEn": "Cloud Architect",
   "cat": "OPS",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Designs the target cloud architecture: service selection (compute, storage, network), network topology, cost, security, scalability, and disaster recovery. Draws the diagram and justifies trade-offs by well-architected principles. Does not build deployment pipelines or operate a Kubernetes cluster. Works in Polish and English.",
   "tools": "Read, Write, WebSearch, WebFetch"
  },
  "sre_engineer": {
   "id": "sre_engineer",
   "nameEn": "SRE Engineer",
   "cat": "OPS",
   "phase": "qa",
   "model": "sonnet",
   "roleEn": "Guards production reliability: defines SLIs/SLOs and an error budget, designs monitoring and alerts around golden signals, runs incident response and blameless postmortems, reduces toil. Balances the pace of change with risk. Does not build CI/CD pipelines or design cloud architecture. Works in Polish and English.",
   "tools": "Read, Write, Bash"
  },
  "kubernetes_specialist": {
   "id": "kubernetes_specialist",
   "nameEn": "Kubernetes Specialist",
   "cat": "OPS",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Designs and operates Kubernetes clusters: manifests and Helm, requests/limits, autoscaling (HPA), networking (Ingress/Service), storage, RBAC, and security context. Packs applications into containers and deploys declaratively with self-healing. Does not design the whole cloud or define SLOs. Works in Polish and English.",
   "tools": "Read, Write, Bash"
  },
  "accessibility_tester": {
   "id": "accessibility_tester",
   "nameEn": "Accessibility Tester",
   "cat": "QA / AUDYT",
   "phase": "qa",
   "model": "sonnet",
   "roleEn": "Audits WCAG conformance: contrast (ratio/APCA), keyboard navigation, focus visibility, semantics and ARIA, screen reader, touch targets. Returns prioritized findings with fix recommendations, distinguishing automated from manual. Does not redesign visually or write application code. Works in Polish and English.",
   "tools": "Read, Bash"
  },
  "product_manager": {
   "id": "product_manager",
   "nameEn": "Product Manager",
   "cat": "PRODUKT",
   "phase": "strategy",
   "model": "sonnet",
   "roleEn": "Defines the user problem and target group, prioritizes (RICE/MoSCoW), writes a PRD with scope, acceptance criteria, and success metrics, and manages trade-offs and roadmap. Decides what and why to build. Does not write code, design UI, or do go-to-market. Works in Polish and English.",
   "tools": "Read, Write, WebSearch"
  },
  "ux_researcher": {
   "id": "ux_researcher",
   "nameEn": "UX Researcher",
   "cat": "PRODUKT",
   "phase": "research",
   "model": "sonnet",
   "roleEn": "Runs user research: interviews, surveys, usability tests, personas, JTBD, and journey maps. Turns user behavior into evidence-backed insights. Differs from the UX Researcher trend scout. Does not decide product priorities or design UI. Works in Polish and English.",
   "tools": "Read, Write, WebSearch"
  },
  "technical_writer": {
   "id": "technical_writer",
   "nameEn": "Technical Writer",
   "cat": "BUILD",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Creates developer documentation: API reference, how-to guides, tutorials, and explanations by the Diataxis framework, with tested code examples. Docs-as-code, versioned with the product. Does not write marketing content, articles, or in the author personal voice. Works in Polish and English.",
   "tools": "Read, Write, WebSearch"
  },
  "mobile_developer": {
   "id": "mobile_developer",
   "nameEn": "Mobile Developer",
   "cat": "BUILD",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Builds apps for iOS and Android: natively (Swift/Kotlin) or cross-platform (React Native/Flutter). Offline-first, push notifications, native integrations (camera, GPS, biometrics), and store publishing. Does not build a web UI, backend, or the visual layer from scratch. Works in Polish and English.",
   "tools": "Read, Write, Bash"
  },
  "orchestrator": {
   "id": "orchestrator",
   "nameEn": "Orchestrator",
   "cat": "STRATEGIA",
   "phase": "strategy",
   "model": "opus",
   "roleEn": "Central decision point of the entire agent system. Analyzes task, decomposes into subtasks and delegates to specialists. Controls gates between phases (GO/NO-GO) and synthesizes results. Does not generate content - manages workflow and resolves conflicts.",
   "tools": "Agent, Read/Write, Bash, TaskCreate"
  },
  "synthesizer": {
   "id": "synthesizer",
   "nameEn": "Synthesizer",
   "cat": "STRATEGIA",
   "phase": "strategy",
   "model": "sonnet",
   "roleEn": "Cross-phase memory of the system - maintains MANIFEST.md as single source of truth. Collects results from each phase, updates architectural decisions and stack.",
   "tools": "Read/Write (MANIFEST.md)"
  },
  "analyst": {
   "id": "analyst",
   "nameEn": "Analyst",
   "cat": "PLANOWANIE",
   "phase": "strategy",
   "model": "sonnet",
   "roleEn": "Specialist in decomposing complex problems into independent subtasks. Identifies dependencies, estimates complexity (S/M/L/XL).",
   "tools": "Read, Write"
  },
  "planner": {
   "id": "planner",
   "nameEn": "Planner",
   "cat": "PLANOWANIE",
   "phase": "strategy",
   "model": "sonnet",
   "roleEn": "Creates schedule based on Analyst's decomposition. Determines parallel vs sequential tasks, identifies critical path.",
   "tools": "Read, Write"
  },
  "res_tech": {
   "id": "res_tech",
   "nameEn": "Researcher Tech",
   "cat": "RESEARCH",
   "phase": "research",
   "model": "haiku",
   "roleEn": "Conducts technical research: compares frameworks, libraries, APIs and architecture. Analyzes minimum 3 options with pros/cons.",
   "tools": "WebSearch, WebFetch, Read"
  },
  "res_ux": {
   "id": "res_ux",
   "nameEn": "Researcher UX",
   "cat": "RESEARCH",
   "phase": "research",
   "model": "haiku",
   "roleEn": "Researches UI/UX trends, collects inspiration from Dribbble, Behance, Awwwards. Checks WCAG 2.1 AA.",
   "tools": "WebSearch, WebFetch"
  },
  "res_reddit": {
   "id": "res_reddit",
   "nameEn": "Researcher Reddit",
   "cat": "RESEARCH",
   "phase": "research",
   "model": "haiku",
   "roleEn": "Searches Reddit for unfiltered opinions and real developer experiences.",
   "tools": "WebSearch, WebFetch"
  },
  "res_x": {
   "id": "res_x",
   "nameEn": "Researcher X",
   "cat": "RESEARCH",
   "phase": "research",
   "model": "sonnet",
   "roleEn": "Monitors X/Twitter for trends from tech influencers.",
   "tools": "WebSearch, WebFetch"
  },
  "res_github": {
   "id": "res_github",
   "nameEn": "Researcher GitHub",
   "cat": "RESEARCH",
   "phase": "research",
   "model": "sonnet",
   "roleEn": "Searches open-source repositories similar to project. Analyzes architecture, stack, README.",
   "tools": "WebSearch, WebFetch"
  },
  "res_forums": {
   "id": "res_forums",
   "nameEn": "Researcher Forums",
   "cat": "RESEARCH",
   "phase": "research",
   "model": "sonnet",
   "roleEn": "Searches StackOverflow, Dev.to, Medium, HN for tutorials and lessons learned.",
   "tools": "WebSearch, WebFetch"
  },
  "res_docs": {
   "id": "res_docs",
   "nameEn": "Researcher Docs",
   "cat": "RESEARCH",
   "phase": "research",
   "model": "haiku",
   "roleEn": "Collects information from official framework and tool documentation.",
   "tools": "WebSearch, WebFetch, Read"
  },
  "res_critic": {
   "id": "res_critic",
   "nameEn": "Research Critic",
   "cat": "RESEARCH",
   "phase": "debate1",
   "model": "sonnet",
   "roleEn": "Validates Researcher results looking for contradictions, bias and gaps. Evaluates source credibility.",
   "tools": "Read"
  },
  "backend": {
   "id": "backend",
   "nameEn": "Backend Dev",
   "cat": "BUILD",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Implements server layer: API endpoints, data schemas, validation and business logic.",
   "tools": "Write, Edit, Bash, Read"
  },
  "frontend": {
   "id": "frontend",
   "nameEn": "Frontend Dev",
   "cat": "BUILD",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Implements client layer mobile-first. Creates reusable components with state handling.",
   "tools": "Write, Edit, Bash, Read"
  },
  "feature": {
   "id": "feature",
   "nameEn": "Feature Dev",
   "cat": "BUILD",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Implements specialized features: real-time, AI/ML integrations, data visualizations.",
   "tools": "Write, Edit, Bash, Read"
  },
  "designer": {
   "id": "designer",
   "nameEn": "Designer",
   "cat": "BUILD",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Creates complete visual layer from design tokens to animations. CSS/SCSS with tokens.",
   "tools": "Write, Edit, Read"
  },
  "integrator": {
   "id": "integrator",
   "nameEn": "Integrator",
   "cat": "BUILD",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Connects workers' output into a cohesive project. Verifies API contracts, resolves conflicts.",
   "tools": "Read, Write, Edit, Bash"
  },
  "writer": {
   "id": "writer",
   "nameEn": "Technical Writer",
   "cat": "BUILD",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Creates technical documentation: README.md, CHANGELOG, API docs, decision records.",
   "tools": "Read, Write, Edit"
  },
  "res_extractor": {
   "id": "res_extractor",
   "nameEn": "Extractor",
   "cat": "RESEARCH",
   "phase": "research",
   "model": "haiku",
   "roleEn": "Cuts one long researcher report 10x into a concise claim table (JSON): 15-30 atomic, citable facts plus conflict and gap sections. Pure extraction, not reasoning - runs in parallel (up to 7) in /deep-research-v2. Works in Polish and English.",
   "tools": "Read, Write"
  },
  "synthesizer_lean": {
   "id": "synthesizer_lean",
   "nameEn": "Synthesizer Lean",
   "cat": "STRATEGIA",
   "phase": "strategy",
   "model": "opus",
   "roleEn": "A map-reduce-optimized Synthesizer: takes concise fact tables (extracts) instead of full reports and merges them into one decision-ready synthesis. Faster and cheaper on large research swarms. Works in Polish and English.",
   "tools": "Read, Write, Edit"
  },
  "style_profiler": {
   "id": "style_profiler",
   "nameEn": "Voice Profiler",
   "cat": "BUILD",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Analyzes samples of the author's text and builds a durable, reusable style profile (voice_profile.md): sentence rhythm, vocabulary, tone, formatting, hooks, and hard negative constraints. Does not write content - it extracts language patterns. Bloomberry pattern: a large corpus rather than a few sentences.",
   "tools": "Read, Write, Edit, Grep, Glob"
  },
  "voice_qa": {
   "id": "voice_qa",
   "nameEn": "Voice Guardian",
   "cat": "BUILD",
   "phase": "build",
   "model": "haiku",
   "roleEn": "Validates finished text against the author's style profile (voice_profile.md): whether it sounds like the author, detects AI slop markers, and catches broken negative constraints. A separate step from writing, because one model's self-correction is unreliable. Returns a PASS/REVISE verdict with a concrete list of fixes. Works in Polish and English.",
   "tools": "Read, Write, Edit, Grep"
  },
  "social_strategist": {
   "id": "social_strategist",
   "nameEn": "Social Content Strategist",
   "cat": "BUILD",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Plans a post before the first sentence: picks the angle, opening hook, format and structure for a specific platform (LinkedIn / Facebook / X), and matches CTA and length to the channel's norms. Does not write the final text - it creates a brief that Your Voice Writer fills in with the author's style. Knows platform differences and that LinkedIn penalizes generic AI slop. Works in Polish and English.",
   "tools": "Read, Write, WebSearch, WebFetch"
  },
  "career_document_builder": {
   "id": "career_document_builder",
   "nameEn": "Career Document Architect",
   "cat": "BUILD",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Builds a CV, cover letter, and LinkedIn profile tailored to a specific job opening, based on the author's REAL experience. Extracts keywords from the posting, maps them to actual achievements, and optimizes for ATS. Zero-fabrication rule: never invents positions, dates, or numbers. Works in Polish and English.",
   "tools": "Read, Write, Edit, WebSearch"
  },
  "interview_coach": {
   "id": "interview_coach",
   "nameEn": "Interview Coach",
   "cat": "BUILD",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Prepares you for a job interview through simulation: realistic role-specific questions, follow-ups like a real recruiter, feedback, and the STAR method. A TRAINING mode before the interview, not live cheating. Builds readiness on the author's real experience. Works in Polish and English.",
   "tools": "Read, Write, WebSearch"
  },
  "recipe_scout": {
   "id": "recipe_scout",
   "nameEn": "Recipe Scout",
   "cat": "RESEARCH",
   "phase": "research",
   "model": "sonnet",
   "roleEn": "The first agent in the cooking pipeline. Finds a pool of recipes matched to the dish category and your ingredients (from the fridge or with shopping), collects time and difficulty, and flags novelties and missing ingredients. Delivers a varied pool, it does not pick one dish. Works in Polish and English.",
   "tools": "WebSearch, WebFetch, Read"
  },
  "taste_recommender": {
   "id": "taste_recommender",
   "nameEn": "Taste Advisor",
   "cat": "BUILD",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "The middle agent in the cooking pipeline. Takes the recipe pool from the Scout and ranks it by your taste profile (profil_gustu.md), justifies the fit, adds at least one novelty, and strictly rejects dishes breaking allergies and exclusions. Learns from feedback. Works in Polish and English.",
   "tools": "Read, Write, Edit"
  },
  "recipe_filter": {
   "id": "recipe_filter",
   "nameEn": "Kitchen Filter",
   "cat": "BUILD",
   "phase": "build",
   "model": "haiku",
   "roleEn": "The final, lightweight agent in the cook. Takes recommendations from the Taste Advisor and filters them by difficulty, ingredient availability, and - the differentiator - ACTIVE work time separately from TOTAL time. Estimates active time when the source lacks it and honestly flags it. Works in Polish and English.",
   "tools": "Read, Write, Edit"
  },
  "decision_advisor": {
   "id": "decision_advisor",
   "nameEn": "Decision Advisor",
   "cat": "STRATEGIA",
   "phase": "strategy",
   "model": "sonnet",
   "roleEn": "Turns collected community signal (Reddit/forums/X) into a clear decision verdict: a recommendation, key tradeoffs, a confidence level, and who it is and is not for. Weighs a repeated signal over single loud opinions (n=1). Does not invent data beyond the sentiment. Works in Polish and English.",
   "tools": "Read, Write, Edit, Grep"
  },
  "voice_writer": {
   "id": "voice_writer",
   "nameEn": "Your Voice Writer",
   "cat": "BUILD",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Generates practical text (emails, LinkedIn/Facebook posts, CV fragments, messages) in the author's personal voice described in voice_profile.md. Faithfully applies the profile and negative constraints, learns from edits. Does not invent a style from scratch - avoids generic AI slop.",
   "tools": "Read, Write, Edit"
  },
  "qa_security": {
   "id": "qa_security",
   "nameEn": "QA Security",
   "cat": "QA / AUDYT",
   "phase": "qa",
   "model": "haiku",
   "roleEn": "Security audit: OWASP Top 10, hardcoded secrets, unsecured endpoints.",
   "tools": "Read, Grep, Bash"
  },
  "qa_quality": {
   "id": "qa_quality",
   "nameEn": "QA Quality",
   "cat": "QA / AUDYT",
   "phase": "qa",
   "model": "haiku",
   "roleEn": "Checks compliance with requirements, identifies missing tests and edge cases.",
   "tools": "Read, Grep, Bash"
  },
  "qa_perf": {
   "id": "qa_perf",
   "nameEn": "QA Performance",
   "cat": "QA / AUDYT",
   "phase": "qa",
   "model": "haiku",
   "roleEn": "Comprehensive performance audit: response time, bundle size, memory, query performance.",
   "tools": "Bash, Read"
  },
  "qa_manager": {
   "id": "qa_manager",
   "nameEn": "QA Manager",
   "cat": "QA / AUDYT",
   "phase": "qa",
   "model": "sonnet",
   "roleEn": "Collects and prioritizes QA reports. GO/NO-GO decision on 1-10 scale.",
   "tools": "Read, Write"
  },
  "expert_pragmatist": {
   "id": "expert_pragmatist",
   "nameEn": "Pragmatist",
   "cat": "FIVE MINDS",
   "phase": "debate1",
   "model": "opus",
   "roleEn": "Five Minds: evaluates feasibility, costs, timeline, resources. Defends pragmatic perspective.",
   "tools": "Read"
  },
  "expert_innovator": {
   "id": "expert_innovator",
   "nameEn": "Innovator",
   "cat": "FIVE MINDS",
   "phase": "debate1",
   "model": "opus",
   "roleEn": "Five Minds: seeks best solutions, innovation, competitive advantage. Defends innovative perspective.",
   "tools": "Read"
  },
  "expert_analyst": {
   "id": "expert_analyst",
   "nameEn": "Data Analyst",
   "cat": "FIVE MINDS",
   "phase": "debate1",
   "model": "opus",
   "roleEn": "Five Minds: analyzes data, benchmarks, metrics, evidence. Defends data-driven perspective.",
   "tools": "Read"
  },
  "expert_user": {
   "id": "expert_user",
   "nameEn": "User Advocate",
   "cat": "FIVE MINDS",
   "phase": "debate1",
   "model": "opus",
   "roleEn": "Five Minds: represents end-user perspective. Defends UX, accessibility and user experience.",
   "tools": "Read"
  },
  "expert_devil": {
   "id": "expert_devil",
   "nameEn": "Shadow (Devil's Advocate)",
   "cat": "FIVE MINDS",
   "phase": "debate1",
   "model": "opus",
   "roleEn": "Five Minds: questions EVERY decision, seeks risks and gaps. Has no domain loyalty.",
   "tools": "Read"
  },
  "decision_presenter": {
   "id": "decision_presenter",
   "nameEn": "Decision Presenter",
   "cat": "HITL",
   "phase": "hitl",
   "model": "haiku",
   "roleEn": "Human-in-the-Loop gate between phases. Collects proposals, identifies 2-3 options with trade-offs and presents them impartially. Waits for user decision.",
   "tools": "Read"
  },
  "db_architect": {
   "id": "db_architect",
   "nameEn": "DB Architect",
   "cat": "BUILD",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Specjalista projektowania baz danych: schemat, indeksy, migracje, strategia partycjonowania. Dobiera model danych (relacyjny/dokumentowy/kolumnowy), definiuje klucze, więzy integralności i plan migracji bezprzerwowych.",
   "tools": "Read, Write, Bash (psql/mysql/sqlite), WebSearch"
  },
  "observability_engineer": {
   "id": "observability_engineer",
   "nameEn": "Observability Engineer",
   "cat": "BUILD",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Instrumentuje system w metryki, logi i tracingi (trzy filary obserwowalności). Dobiera stack (OpenTelemetry, Prometheus, Grafana), definiuje SLI/SLO/SLA i projektuje dashboardy oraz alerty.",
   "tools": "Read, Write, Bash, WebSearch"
  },
  "gtm_strategist": {
   "id": "gtm_strategist",
   "nameEn": "GTM Strategist",
   "cat": "PRODUKT",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Projektuje go-to-market: ICP, positioning, pricing, kanały akwizycji i plan launchu. Łączy wynik badań użytkowników z mechanika wdrożenia produktu na rynek.",
   "tools": "Read, Write, WebSearch, WebFetch"
  },
  "statistician": {
   "id": "statistician",
   "nameEn": "Statistician",
   "cat": "DANE",
   "phase": "strategy",
   "model": "sonnet",
   "roleEn": "Projektuje eksperymenty i analizy statystyczne. Dobiera testy hipotez, wielkość próby, moc testu i metode korekcji dla testów wielokrotnych. Pilnuje poprawności wnioskowania.",
   "tools": "Read, Write, Bash (R/Python)"
  },
  "eda_analyst": {
   "id": "eda_analyst",
   "nameEn": "EDA Analyst",
   "cat": "DANE",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Prowadzi eksploracyjna analize danych: profilowanie, wykrywanie anomalii, korelacje, wizualizacje. Opisuje dane zanim ktoś na nich buduje model.",
   "tools": "Read, Write, Bash (Python/pandas/matplotlib)"
  },
  "control_mapper": {
   "id": "control_mapper",
   "nameEn": "Control Mapper",
   "cat": "COMPLIANCE",
   "phase": "build",
   "model": "sonnet",
   "roleEn": "Mapuje wymagania regulacyjne (GDPR, SOC2, ISO27001, HIPAA) na konkretne kontrole techniczne i procesowe. Buduje matryce kontroli, identyfikuje luki i dowody zgodności.",
   "tools": "Read, Write, WebSearch"
  },
  "telemetry_surfer": {
   "id": "telemetry_surfer",
   "nameEn": "Telemetry Surfer",
   "cat": "OPS",
   "phase": "research",
   "model": "sonnet",
   "roleEn": "Przeszukuje istniejąca telemetrie (logi, metryki, traces) w poszukiwaniu wzorców, anomalii i incydentów. Odpowiada na pytania co się stalo i co się dzieje teraz bazując na danych operacyjnych.",
   "tools": "Read, Bash (grep/jq/promtool/logcli), WebFetch"
  }
 },
 "presets": {
  "mlops": {
   "id": "mlops",
   "nameEn": "MLOps Pipeline",
   "count": 6,
   "descEn": "A team to build and deploy your own ML model: the Data Engineer preps clean data, the EDA Analyst explores, the ML Engineer trains and deploys with drift monitoring and retraining, and QA validates. For classic ML on your data, not an app on a ready LLM. Works in Polish and English.",
   "useEn": "Building and deploying your own ML model on your data with a full MLOps cycle.",
   "flow": "Prompt Chaining + MLOps",
   "tokens": "~200-450K",
   "cost": "$0.55-1.60",
   "category": "data",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "data_engineer",
     "x": 400,
     "y": 120,
     "m": "sonnet"
    },
    {
     "d": "eda_analyst",
     "x": 400,
     "y": 220,
     "m": "sonnet"
    },
    {
     "d": "ml_engineer",
     "x": 400,
     "y": 320,
     "m": "sonnet"
    },
    {
     "d": "qa_quality",
     "x": 400,
     "y": 420,
     "m": "haiku"
    },
    {
     "d": "synthesizer",
     "x": 400,
     "y": 520,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     4,
     5,
     "one"
    ],
    [
     5,
     0,
     "continuous"
    ]
   ]
  },
  "rag_app": {
   "id": "rag_app",
   "nameEn": "RAG / AI App Build",
   "count": 6,
   "descEn": "A team for building LLM-powered apps: RAG systems, assistants, classifiers. The AI Engineer designs the RAG pipeline, the Prompt Engineer tunes prompts on a test set, the Backend integrates, and QA guards cost, quality, and security. Works in Polish and English.",
   "useEn": "Building an LLM app: a docs chatbot, a RAG assistant, a classifier - with cost, quality, and security control.",
   "flow": "Orchestrator-Worker + RAG",
   "tokens": "~200-500K",
   "cost": "$0.60-1.80",
   "category": "data",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "ai_engineer",
     "x": 210,
     "y": 140,
     "m": "sonnet"
    },
    {
     "d": "prompt_engineer",
     "x": 590,
     "y": 140,
     "m": "sonnet"
    },
    {
     "d": "backend",
     "x": 400,
     "y": 260,
     "m": "sonnet"
    },
    {
     "d": "qa_security",
     "x": 400,
     "y": 380,
     "m": "haiku"
    },
    {
     "d": "synthesizer",
     "x": 400,
     "y": 500,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     4,
     5,
     "one"
    ],
    [
     5,
     0,
     "continuous"
    ]
   ]
  },
  "devops_cicd": {
   "id": "devops_cicd",
   "nameEn": "DevOps CI/CD Setup",
   "count": 6,
   "descEn": "A team to automate delivery: the DevOps Engineer builds the CI/CD pipeline and IaC, the SRE Engineer defines SLOs, the Observability Engineer sets up monitoring, and QA checks deployment security. Frequent, small, reversible deploys with visibility. Works in Polish and English.",
   "useEn": "Automating delivery: a CI/CD pipeline with rollback, infrastructure as code, SLOs, and observability from the start.",
   "flow": "Prompt Chaining + CI/CD",
   "tokens": "~180-420K",
   "cost": "$0.50-1.50",
   "category": "ops",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "devops_engineer",
     "x": 400,
     "y": 120,
     "m": "sonnet"
    },
    {
     "d": "sre_engineer",
     "x": 400,
     "y": 220,
     "m": "sonnet"
    },
    {
     "d": "observability_engineer",
     "x": 400,
     "y": 320,
     "m": "sonnet"
    },
    {
     "d": "qa_security",
     "x": 400,
     "y": 420,
     "m": "haiku"
    },
    {
     "d": "synthesizer",
     "x": 400,
     "y": 520,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     4,
     5,
     "one"
    ],
    [
     5,
     0,
     "continuous"
    ]
   ]
  },
  "k8s_deploy": {
   "id": "k8s_deploy",
   "nameEn": "Cloud / K8s Deploy",
   "count": 6,
   "descEn": "A team to deploy applications to cloud and Kubernetes: the Cloud Architect designs the architecture, the Kubernetes Specialist writes manifests and Helm, the DevOps Engineer wires the pipeline, and the Observability Engineer monitors the cluster. Autoscaling and self-healing. Works in Polish and English.",
   "useEn": "Deploying an app to cloud and Kubernetes: architecture, manifests, pipeline, and cluster monitoring together.",
   "flow": "Orchestrator-Worker + IaC",
   "tokens": "~200-480K",
   "cost": "$0.60-1.70",
   "category": "ops",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "cloud_architect",
     "x": 400,
     "y": 120,
     "m": "sonnet"
    },
    {
     "d": "kubernetes_specialist",
     "x": 400,
     "y": 220,
     "m": "sonnet"
    },
    {
     "d": "devops_engineer",
     "x": 400,
     "y": 320,
     "m": "sonnet"
    },
    {
     "d": "observability_engineer",
     "x": 400,
     "y": 420,
     "m": "sonnet"
    },
    {
     "d": "synthesizer",
     "x": 400,
     "y": 520,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     4,
     5,
     "one"
    ],
    [
     5,
     0,
     "continuous"
    ]
   ]
  },
  "a11y_audit": {
   "id": "a11y_audit",
   "nameEn": "Accessibility Audit",
   "count": 5,
   "descEn": "A team to audit a finished interface for WCAG: the Accessibility Tester audits contrast, keyboard, ARIA, and screen reader, QA verifies, and the Designer proposes fixes. Prioritized issues with fix recommendations. Works in Polish and English.",
   "useEn": "Auditing a finished interface for WCAG: contrast, keyboard, ARIA, screen reader - with a prioritized fix plan.",
   "flow": "Linear Pipeline + QA",
   "tokens": "~120-300K",
   "cost": "$0.30-0.85",
   "category": "quality",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "accessibility_tester",
     "x": 400,
     "y": 130,
     "m": "sonnet"
    },
    {
     "d": "designer",
     "x": 400,
     "y": 240,
     "m": "sonnet"
    },
    {
     "d": "qa_quality",
     "x": 400,
     "y": 350,
     "m": "haiku"
    },
    {
     "d": "synthesizer",
     "x": 400,
     "y": 460,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     4,
     0,
     "continuous"
    ]
   ]
  },
  "product_discovery": {
   "id": "product_discovery",
   "nameEn": "Product Discovery",
   "count": 6,
   "descEn": "A discovery team turning user signals into a defined problem, PRD, and priorities: the UX Researcher runs research, the Product Manager writes the PRD and priorities, the Analyst decomposes the problem, and the GTM Strategist adds market context. Works in Polish and English.",
   "useEn": "Discovery phase: validating the problem with research, personas, prioritization, and a PRD with success metrics before building.",
   "flow": "Discovery + Prioritization",
   "tokens": "~200-460K",
   "cost": "$0.55-1.55",
   "category": "strategy",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "ux_researcher",
     "x": 400,
     "y": 120,
     "m": "sonnet"
    },
    {
     "d": "analyst",
     "x": 400,
     "y": 220,
     "m": "sonnet"
    },
    {
     "d": "product_manager",
     "x": 400,
     "y": 320,
     "m": "sonnet"
    },
    {
     "d": "gtm_strategist",
     "x": 400,
     "y": 420,
     "m": "sonnet"
    },
    {
     "d": "synthesizer",
     "x": 400,
     "y": 520,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     4,
     5,
     "one"
    ],
    [
     5,
     0,
     "continuous"
    ]
   ]
  },
  "docs_portal": {
   "id": "docs_portal",
   "nameEn": "Documentation Portal",
   "count": 6,
   "descEn": "A team building a structured developer documentation portal: the Docs Researcher gathers sources, the Technical Writer writes reference and how-tos by Diataxis, the Frontend assembles the portal, and QA checks examples and links. Docs-as-code. Works in Polish and English.",
   "useEn": "Building a full developer documentation portal: reference, tutorials, and how-tos by Diataxis, with working examples and docs-as-code.",
   "flow": "Content Pipeline + docs-as-code",
   "tokens": "~200-470K",
   "cost": "$0.55-1.60",
   "category": "content",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "res_docs",
     "x": 400,
     "y": 120,
     "m": "haiku"
    },
    {
     "d": "technical_writer",
     "x": 400,
     "y": 220,
     "m": "sonnet"
    },
    {
     "d": "frontend",
     "x": 400,
     "y": 320,
     "m": "sonnet"
    },
    {
     "d": "qa_quality",
     "x": 400,
     "y": 420,
     "m": "haiku"
    },
    {
     "d": "synthesizer",
     "x": 400,
     "y": 520,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     4,
     5,
     "one"
    ],
    [
     5,
     0,
     "continuous"
    ]
   ]
  },
  "mobile_app": {
   "id": "mobile_app",
   "nameEn": "Mobile App",
   "count": 6,
   "descEn": "A team building a mobile app for iOS and Android from requirements to store readiness: the Analyst captures requirements, the Mobile Developer builds native or cross-platform offline-first, the Backend provides the API, and QA tests on both platforms. Works in Polish and English.",
   "useEn": "Building an app for iOS and/or Android from requirements to publishing: native or cross-platform, offline-first, push, backend, and QA on both platforms.",
   "flow": "Feature Sprint + mobile",
   "tokens": "~230-520K",
   "cost": "$0.60-1.80",
   "category": "build",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "analyst",
     "x": 400,
     "y": 120,
     "m": "sonnet"
    },
    {
     "d": "mobile_developer",
     "x": 400,
     "y": 220,
     "m": "sonnet"
    },
    {
     "d": "backend",
     "x": 400,
     "y": 320,
     "m": "sonnet"
    },
    {
     "d": "qa_quality",
     "x": 400,
     "y": 420,
     "m": "haiku"
    },
    {
     "d": "synthesizer",
     "x": 400,
     "y": 520,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     4,
     5,
     "one"
    ],
    [
     5,
     0,
     "continuous"
    ]
   ]
  },
  "obs_slo": {
   "id": "obs_slo",
   "nameEn": "Observability & SLO",
   "count": 6,
   "descEn": "A team proactively wiring in observability: the Observability Engineer instruments metrics, logs, and traces and builds dashboards, the SRE defines SLO/SLI and error budgets and designs alerting, DevOps wires it into the pipeline, and QA verifies the alarms. Differs from Incident War Room (live incident). Works in Polish and English.",
   "useEn": "Proactively wiring in observability: instrumentation, dashboards, SLO/SLI, and alerting - before an incident, not during one.",
   "flow": "Feature Sprint + observability",
   "tokens": "~210-490K",
   "cost": "$0.55-1.70",
   "category": "ops",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "observability_engineer",
     "x": 400,
     "y": 120,
     "m": "sonnet"
    },
    {
     "d": "sre_engineer",
     "x": 400,
     "y": 220,
     "m": "sonnet"
    },
    {
     "d": "devops_engineer",
     "x": 400,
     "y": 320,
     "m": "sonnet"
    },
    {
     "d": "qa_quality",
     "x": 400,
     "y": 420,
     "m": "haiku"
    },
    {
     "d": "synthesizer",
     "x": 400,
     "y": 520,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     4,
     5,
     "one"
    ],
    [
     5,
     0,
     "continuous"
    ]
   ]
  },
  "code_onboarding": {
   "id": "code_onboarding",
   "nameEn": "Codebase Onboarding",
   "count": 5,
   "descEn": "A team that quickly gets you into an unfamiliar or inherited codebase: the Tech Researcher explores the repository, the Analyst maps the architecture, key paths, and risks, and the Technical Writer writes an onboarding guide. No code changes. Differs from Legacy Refactor. Works in Polish and English.",
   "useEn": "Quickly understanding an unfamiliar or inherited codebase: an architecture map, dependencies, key paths, and an onboarding guide - no code changes.",
   "flow": "Recon + docs-as-code",
   "tokens": "~150-350K",
   "cost": "$0.35-1.10",
   "category": "research",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "res_tech",
     "x": 400,
     "y": 130,
     "m": "sonnet"
    },
    {
     "d": "analyst",
     "x": 400,
     "y": 240,
     "m": "sonnet"
    },
    {
     "d": "technical_writer",
     "x": 400,
     "y": 350,
     "m": "sonnet"
    },
    {
     "d": "synthesizer",
     "x": 400,
     "y": 460,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     4,
     0,
     "continuous"
    ]
   ]
  },
  "landing_page": {
   "id": "landing_page",
   "nameEn": "Landing Page",
   "count": 6,
   "descEn": "A team building a conversion landing page from scratch: the Designer lays out the sections, the Writer creates the sales copy, the Frontend builds a responsive page, and QA checks responsiveness and the CTA. Differs from UI/UX Overhaul and Design System. Works in Polish and English.",
   "useEn": "Building a conversion landing page from scratch: a section design, ready responsive frontend, and sales copy with a clear CTA.",
   "flow": "Design Sprint + copy",
   "tokens": "~180-420K",
   "cost": "$0.45-1.40",
   "category": "design",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "designer",
     "x": 270,
     "y": 140,
     "m": "sonnet"
    },
    {
     "d": "writer",
     "x": 530,
     "y": 140,
     "m": "sonnet"
    },
    {
     "d": "frontend",
     "x": 400,
     "y": 260,
     "m": "sonnet"
    },
    {
     "d": "qa_quality",
     "x": 400,
     "y": 380,
     "m": "haiku"
    },
    {
     "d": "synthesizer",
     "x": 400,
     "y": 500,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     4,
     5,
     "one"
    ],
    [
     5,
     0,
     "continuous"
    ]
   ]
  },
  "growth_campaign": {
   "id": "growth_campaign",
   "nameEn": "Growth Campaign",
   "count": 5,
   "descEn": "A team planning a marketing campaign for an existing product: the Analyst studies the audience, the GTM Strategist sets positioning and channels, and the Writer creates ready campaign copy. Differs from PRD to Launch (a new product from idea to launch). Works in Polish and English.",
   "useEn": "Planning a marketing campaign for an existing product: audience analysis, positioning, a channel plan, and ready campaign copy.",
   "flow": "GTM Sprint + copy",
   "tokens": "~160-380K",
   "cost": "$0.40-1.20",
   "category": "strategy",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "analyst",
     "x": 400,
     "y": 130,
     "m": "sonnet"
    },
    {
     "d": "gtm_strategist",
     "x": 400,
     "y": 240,
     "m": "sonnet"
    },
    {
     "d": "writer",
     "x": 400,
     "y": 350,
     "m": "sonnet"
    },
    {
     "d": "synthesizer",
     "x": 400,
     "y": 460,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     4,
     0,
     "continuous"
    ]
   ]
  },
  "pitch_deck": {
   "id": "pitch_deck",
   "nameEn": "Pitch Deck",
   "count": 5,
   "descEn": "A team building the narrative and structure of an investor or sales pitch deck: the Analyst gathers numbers and market context, the Writer arranges the story slide by slide, and the Designer sets the visual layout. Differs from Growth Campaign and Product Discovery. Works in Polish and English.",
   "useEn": "Building the narrative and structure of an investor or sales presentation: a slide-by-slide story, numbers, and a visual layout.",
   "flow": "Narrative + slides",
   "tokens": "~150-350K",
   "cost": "$0.35-1.05",
   "category": "strategy",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "analyst",
     "x": 400,
     "y": 130,
     "m": "sonnet"
    },
    {
     "d": "writer",
     "x": 400,
     "y": 240,
     "m": "sonnet"
    },
    {
     "d": "designer",
     "x": 400,
     "y": 350,
     "m": "sonnet"
    },
    {
     "d": "synthesizer",
     "x": 400,
     "y": 460,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     4,
     0,
     "continuous"
    ]
   ]
  },
  "solo": {
   "id": "solo",
   "nameEn": "Solo + Validator",
   "count": 2,
   "descEn": "Orchestrator + worker with loop.",
   "useEn": "Bugs, refactoring, scripts.",
   "flow": "Direct Delegation",
   "tokens": "~100-250K",
   "cost": "$0.55-1.40",
   "category": "build",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 100,
     "m": null
    },
    {
     "d": "backend",
     "x": 400,
     "y": 260,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "two"
    ]
   ]
  },
  "quick_fix": {
   "id": "quick_fix",
   "nameEn": "Quick Fix",
   "count": 3,
   "descEn": "Fix-test-fix cycle with continuous loop.",
   "useEn": "Bugfixes, hotfixes, patches.",
   "flow": "Fix-Test Loop",
   "tokens": "~130-320K",
   "cost": "$0.60-1.50",
   "category": "build",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 60,
     "m": null
    },
    {
     "d": "backend",
     "x": 400,
     "y": 200,
     "m": null
    },
    {
     "d": "qa_quality",
     "x": 400,
     "y": 340,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     2,
     0,
     "continuous"
    ]
   ]
  },
  "recon": {
   "id": "recon",
   "nameEn": "Recon Squad",
   "count": 3,
   "descEn": "Orchestrator + researcher + builder.",
   "useEn": "POC, spike, feasibility study.",
   "flow": "Hub-and-Spoke",
   "tokens": "~120-310K",
   "cost": "$0.60-1.50",
   "category": "research",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 60,
     "m": null
    },
    {
     "d": "res_tech",
     "x": 260,
     "y": 200,
     "m": null
    },
    {
     "d": "backend",
     "x": 540,
     "y": 200,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     1,
     2,
     "one"
    ]
   ]
  },
  "trio": {
   "id": "trio",
   "nameEn": "Classic Trio",
   "count": 3,
   "descEn": "Backend + Frontend + QA.",
   "useEn": "Full-stack, CRUD, REST API + UI.",
   "flow": "Triangle",
   "tokens": "~140-360K",
   "cost": "$0.60-1.50",
   "category": "build",
   "nodes": [
    {
     "d": "backend",
     "x": 250,
     "y": 100,
     "m": null
    },
    {
     "d": "frontend",
     "x": 550,
     "y": 100,
     "m": null
    },
    {
     "d": "qa_quality",
     "x": 400,
     "y": 270,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     2,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     0,
     1,
     "two"
    ]
   ]
  },
  "reflect": {
   "id": "reflect",
   "nameEn": "Reflective Loop",
   "count": 3,
   "descEn": "Research → Analysis → Critique.",
   "useEn": "Deep research, due diligence.",
   "flow": "Reflective Trio",
   "tokens": "~90-220K",
   "cost": "$0.30-0.75",
   "category": "quality",
   "nodes": [
    {
     "d": "res_tech",
     "x": 400,
     "y": 60,
     "m": null
    },
    {
     "d": "analyst",
     "x": 400,
     "y": 210,
     "m": null
    },
    {
     "d": "res_critic",
     "x": 400,
     "y": 360,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     2,
     0,
     "continuous"
    ]
   ]
  },
  "bug_hunt": {
   "id": "bug_hunt",
   "nameEn": "Bug Hunter",
   "count": 4,
   "descEn": "Orchestrator + builder + 2x QA.",
   "useEn": "Debugging, bug triage.",
   "flow": "Fork QA",
   "tokens": "~160-400K",
   "cost": "$0.65-1.60",
   "category": "quality",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 50,
     "m": null
    },
    {
     "d": "backend",
     "x": 400,
     "y": 180,
     "m": null
    },
    {
     "d": "qa_security",
     "x": 250,
     "y": 320,
     "m": null
    },
    {
     "d": "qa_quality",
     "x": 550,
     "y": 320,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     2,
     0,
     "one"
    ],
    [
     3,
     0,
     "one"
    ]
   ]
  },
  "content": {
   "id": "content",
   "nameEn": "Content Pipeline",
   "count": 4,
   "descEn": "2 researchers → writer → QA.",
   "useEn": "Documentation, README, reports.",
   "flow": "Linear Pipeline",
   "tokens": "~100-250K",
   "cost": "$0.20-0.55",
   "category": "content",
   "nodes": [
    {
     "d": "res_forums",
     "x": 240,
     "y": 60,
     "m": null
    },
    {
     "d": "res_tech",
     "x": 560,
     "y": 60,
     "m": null
    },
    {
     "d": "writer",
     "x": 400,
     "y": 220,
     "m": null
    },
    {
     "d": "qa_quality",
     "x": 400,
     "y": 370,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     2,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     2,
     3,
     "one"
    ]
   ]
  },
  "plan_exec": {
   "id": "plan_exec",
   "nameEn": "Plan & Execute",
   "count": 4,
   "descEn": "Plan → schedule → build → validation.",
   "useEn": "Migrations, refactoring.",
   "flow": "Plan-and-Execute",
   "tokens": "~150-370K",
   "cost": "$0.60-1.50",
   "category": "build",
   "nodes": [
    {
     "d": "analyst",
     "x": 400,
     "y": 40,
     "m": null
    },
    {
     "d": "planner",
     "x": 400,
     "y": 170,
     "m": null
    },
    {
     "d": "backend",
     "x": 400,
     "y": 300,
     "m": null
    },
    {
     "d": "qa_quality",
     "x": 400,
     "y": 430,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     3,
     0,
     "continuous"
    ]
   ]
  },
  "perf_boost": {
   "id": "perf_boost",
   "nameEn": "Performance Boost",
   "count": 4,
   "descEn": "Analysis → backend + performance audit.",
   "useEn": "API optimization, Core Web Vitals.",
   "flow": "Measure-Fix Cycle",
   "tokens": "~160-390K",
   "cost": "$0.65-1.55",
   "category": "quality",
   "nodes": [
    {
     "d": "analyst",
     "x": 400,
     "y": 50,
     "m": null
    },
    {
     "d": "backend",
     "x": 250,
     "y": 190,
     "m": null
    },
    {
     "d": "qa_perf",
     "x": 550,
     "y": 190,
     "m": null
    },
    {
     "d": "integrator",
     "x": 400,
     "y": 340,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     2,
     3,
     "one"
    ]
   ]
  },
  "startup": {
   "id": "startup",
   "nameEn": "Startup MVP",
   "count": 5,
   "descEn": "Orchestrator + analyst + researcher + builder + QA.",
   "useEn": "MVP, small SaaS, prototype.",
   "flow": "Hub-and-Spoke",
   "tokens": "~190-470K",
   "cost": "$0.80-1.95",
   "category": "build",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 40,
     "m": null
    },
    {
     "d": "analyst",
     "x": 400,
     "y": 150,
     "m": null
    },
    {
     "d": "res_tech",
     "x": 240,
     "y": 270,
     "m": null
    },
    {
     "d": "backend",
     "x": 560,
     "y": 270,
     "m": null
    },
    {
     "d": "qa_quality",
     "x": 400,
     "y": 400,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     0,
     3,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     3,
     4,
     "one"
    ]
   ]
  },
  "cascade": {
   "id": "cascade",
   "nameEn": "Cascade Cost",
   "count": 5,
   "descEn": "Haiku → Sonnet → Opus. 70-80% cheap.",
   "useEn": "Large volume, batch.",
   "flow": "Cascade Escalation",
   "tokens": "~180-440K",
   "cost": "$0.65-1.65",
   "category": "build",
   "nodes": [
    {
     "d": "res_tech",
     "x": 220,
     "y": 60,
     "m": null
    },
    {
     "d": "res_docs",
     "x": 580,
     "y": 60,
     "m": null
    },
    {
     "d": "backend",
     "x": 280,
     "y": 210,
     "m": null
    },
    {
     "d": "qa_quality",
     "x": 520,
     "y": 210,
     "m": null
    },
    {
     "d": "orchestrator",
     "x": 400,
     "y": 370,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     2,
     4,
     "one"
    ],
    [
     3,
     4,
     "one"
    ]
   ]
  },
  "test_suite": {
   "id": "test_suite",
   "nameEn": "Testing Suite",
   "count": 5,
   "descEn": "Orchestrator + 3x QA + Manager.",
   "useEn": "Pre-release, CI/CD gate.",
   "flow": "Triple QA Gate",
   "tokens": "~150-380K",
   "cost": "$0.50-1.25",
   "category": "quality",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 40,
     "m": null
    },
    {
     "d": "qa_security",
     "x": 200,
     "y": 180,
     "m": null
    },
    {
     "d": "qa_quality",
     "x": 400,
     "y": 180,
     "m": null
    },
    {
     "d": "qa_perf",
     "x": 600,
     "y": 180,
     "m": null
    },
    {
     "d": "qa_manager",
     "x": 400,
     "y": 330,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     0,
     3,
     "one"
    ],
    [
     1,
     4,
     "one"
    ],
    [
     2,
     4,
     "one"
    ],
    [
     3,
     4,
     "one"
    ]
   ]
  },
  "a11y": {
   "id": "a11y",
   "nameEn": "Accessibility Sprint",
   "count": 5,
   "descEn": "UX research → designer + FE → QA → docs.",
   "useEn": "WCAG audit, a11y compliance.",
   "flow": "A11y Pipeline",
   "tokens": "~160-400K",
   "cost": "$0.60-1.50",
   "category": "design",
   "nodes": [
    {
     "d": "res_ux",
     "x": 400,
     "y": 40,
     "m": null
    },
    {
     "d": "designer",
     "x": 250,
     "y": 180,
     "m": null
    },
    {
     "d": "frontend",
     "x": 550,
     "y": 180,
     "m": null
    },
    {
     "d": "qa_quality",
     "x": 400,
     "y": 320,
     "m": null
    },
    {
     "d": "writer",
     "x": 400,
     "y": 450,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     3,
     4,
     "one"
    ]
   ]
  },
  "security": {
   "id": "security",
   "nameEn": "Security Hardening",
   "count": 6,
   "descEn": "Builder + 3x QA + Manager GO/NO-GO.",
   "useEn": "Security audit.",
   "flow": "Fan-out → Aggregate",
   "tokens": "~210-520K",
   "cost": "$0.75-1.95",
   "category": "quality",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 30,
     "m": null
    },
    {
     "d": "backend",
     "x": 400,
     "y": 150,
     "m": null
    },
    {
     "d": "qa_security",
     "x": 200,
     "y": 290,
     "m": null
    },
    {
     "d": "qa_quality",
     "x": 400,
     "y": 290,
     "m": null
    },
    {
     "d": "qa_perf",
     "x": 600,
     "y": 290,
     "m": null
    },
    {
     "d": "qa_manager",
     "x": 400,
     "y": 430,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     1,
     4,
     "one"
    ],
    [
     2,
     5,
     "one"
    ],
    [
     3,
     5,
     "one"
    ],
    [
     4,
     5,
     "one"
    ],
    [
     5,
     0,
     "one"
    ]
   ]
  },
  "review": {
   "id": "review",
   "nameEn": "Code Review",
   "count": 6,
   "descEn": "Analysis → build → review.",
   "useEn": "Feature with review, critical PR.",
   "flow": "Pipeline + Fan-out",
   "tokens": "~250-630K",
   "cost": "$1.05-2.70",
   "category": "quality",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 30,
     "m": null
    },
    {
     "d": "analyst",
     "x": 400,
     "y": 140,
     "m": null
    },
    {
     "d": "backend",
     "x": 250,
     "y": 260,
     "m": null
    },
    {
     "d": "frontend",
     "x": 550,
     "y": 260,
     "m": null
    },
    {
     "d": "qa_security",
     "x": 250,
     "y": 400,
     "m": null
    },
    {
     "d": "qa_quality",
     "x": 550,
     "y": 400,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     2,
     4,
     "one"
    ],
    [
     3,
     5,
     "one"
    ],
    [
     4,
     0,
     "one"
    ],
    [
     5,
     0,
     "one"
    ]
   ]
  },
  "design_sys": {
   "id": "design_sys",
   "nameEn": "Design System",
   "count": 6,
   "descEn": "UX + docs research → designer + FE → docs.",
   "useEn": "Design system, style guide.",
   "flow": "Design Pipeline",
   "tokens": "~200-490K",
   "cost": "$0.85-2.15",
   "category": "design",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": null
    },
    {
     "d": "res_ux",
     "x": 250,
     "y": 140,
     "m": null
    },
    {
     "d": "res_docs",
     "x": 550,
     "y": 140,
     "m": null
    },
    {
     "d": "designer",
     "x": 250,
     "y": 280,
     "m": null
    },
    {
     "d": "frontend",
     "x": 550,
     "y": 280,
     "m": null
    },
    {
     "d": "writer",
     "x": 400,
     "y": 420,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     2,
     4,
     "one"
    ],
    [
     3,
     5,
     "one"
    ],
    [
     4,
     5,
     "one"
    ]
   ]
  },
  "api_modern": {
   "id": "api_modern",
   "nameEn": "API Modernization",
   "count": 6,
   "descEn": "Analysis → research → backend + integrator → QA.",
   "useEn": "REST→GraphQL, refactoring.",
   "flow": "API Upgrade Pipeline",
   "tokens": "~220-550K",
   "cost": "$0.95-2.35",
   "category": "build",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": null
    },
    {
     "d": "analyst",
     "x": 400,
     "y": 130,
     "m": null
    },
    {
     "d": "res_tech",
     "x": 400,
     "y": 240,
     "m": null
    },
    {
     "d": "backend",
     "x": 250,
     "y": 360,
     "m": null
    },
    {
     "d": "integrator",
     "x": 550,
     "y": 360,
     "m": null
    },
    {
     "d": "qa_quality",
     "x": 400,
     "y": 490,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     2,
     4,
     "one"
    ],
    [
     3,
     5,
     "one"
    ],
    [
     4,
     5,
     "one"
    ]
   ]
  },
  "ui_overhaul": {
   "id": "ui_overhaul",
   "nameEn": "UI/UX Overhaul",
   "count": 7,
   "descEn": "2x research → analysis → designer + FE → QA.",
   "useEn": "UI redesign, FE modernization.",
   "flow": "UI Redesign Pipeline",
   "tokens": "~240-590K",
   "cost": "$0.95-2.35",
   "category": "design",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 10,
     "m": null
    },
    {
     "d": "res_ux",
     "x": 230,
     "y": 120,
     "m": null
    },
    {
     "d": "res_docs",
     "x": 570,
     "y": 120,
     "m": null
    },
    {
     "d": "analyst",
     "x": 400,
     "y": 230,
     "m": null
    },
    {
     "d": "designer",
     "x": 230,
     "y": 350,
     "m": null
    },
    {
     "d": "frontend",
     "x": 570,
     "y": 350,
     "m": null
    },
    {
     "d": "qa_quality",
     "x": 400,
     "y": 470,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     3,
     5,
     "one"
    ],
    [
     4,
     6,
     "one"
    ],
    [
     5,
     6,
     "one"
    ]
   ]
  },
  "feature_sprint": {
   "id": "feature_sprint",
   "nameEn": "Feature Sprint",
   "count": 7,
   "descEn": "Analysis → research → build → QA.",
   "useEn": "New feature, feature flag.",
   "flow": "Sprint Pipeline",
   "tokens": "~270-660K",
   "cost": "$1.10-2.70",
   "category": "build",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 10,
     "m": null
    },
    {
     "d": "analyst",
     "x": 400,
     "y": 110,
     "m": null
    },
    {
     "d": "res_tech",
     "x": 230,
     "y": 220,
     "m": null
    },
    {
     "d": "res_ux",
     "x": 570,
     "y": 220,
     "m": null
    },
    {
     "d": "backend",
     "x": 230,
     "y": 350,
     "m": null
    },
    {
     "d": "frontend",
     "x": 570,
     "y": 350,
     "m": null
    },
    {
     "d": "qa_quality",
     "x": 400,
     "y": 470,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     2,
     4,
     "one"
    ],
    [
     3,
     5,
     "one"
    ],
    [
     4,
     6,
     "one"
    ],
    [
     5,
     6,
     "one"
    ]
   ]
  },
  "standard": {
   "id": "standard",
   "nameEn": "Standard Dev",
   "count": 8,
   "descEn": "Orchestrator + planning + research + build + QA.",
   "useEn": "Typical web projects, SaaS.",
   "flow": "Hierarchical Pipeline",
   "tokens": "~300-740K",
   "cost": "$1.25-3.10",
   "category": "build",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 15,
     "m": null
    },
    {
     "d": "analyst",
     "x": 280,
     "y": 110,
     "m": null
    },
    {
     "d": "planner",
     "x": 520,
     "y": 110,
     "m": null
    },
    {
     "d": "res_tech",
     "x": 220,
     "y": 220,
     "m": null
    },
    {
     "d": "res_ux",
     "x": 580,
     "y": 220,
     "m": null
    },
    {
     "d": "backend",
     "x": 260,
     "y": 340,
     "m": null
    },
    {
     "d": "frontend",
     "x": 540,
     "y": 340,
     "m": null
    },
    {
     "d": "qa_security",
     "x": 400,
     "y": 460,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     0,
     3,
     "one"
    ],
    [
     0,
     4,
     "one"
    ],
    [
     3,
     5,
     "one"
    ],
    [
     4,
     6,
     "one"
    ],
    [
     5,
     7,
     "one"
    ],
    [
     6,
     7,
     "one"
    ]
   ]
  },
  "data_pipe": {
   "id": "data_pipe",
   "nameEn": "Data Pipeline",
   "count": 8,
   "descEn": "Planning + research → backend + feature → integrator.",
   "useEn": "ETL, data warehouse.",
   "flow": "Data Engineering",
   "tokens": "~290-710K",
   "cost": "$1.30-3.20",
   "category": "data",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 10,
     "m": null
    },
    {
     "d": "analyst",
     "x": 280,
     "y": 110,
     "m": null
    },
    {
     "d": "planner",
     "x": 520,
     "y": 110,
     "m": null
    },
    {
     "d": "res_tech",
     "x": 230,
     "y": 220,
     "m": null
    },
    {
     "d": "res_docs",
     "x": 570,
     "y": 220,
     "m": null
    },
    {
     "d": "backend",
     "x": 230,
     "y": 340,
     "m": null
    },
    {
     "d": "feature",
     "x": 570,
     "y": 340,
     "m": null
    },
    {
     "d": "integrator",
     "x": 400,
     "y": 460,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     2,
     4,
     "one"
    ],
    [
     3,
     5,
     "one"
    ],
    [
     4,
     6,
     "one"
    ],
    [
     5,
     7,
     "one"
    ],
    [
     6,
     7,
     "one"
    ]
   ]
  },
  "research": {
   "id": "research",
   "nameEn": "Research Swarm",
   "count": 9,
   "descEn": "6 researchers + critic + synthesizer.",
   "useEn": "Due diligence, stack selection.",
   "flow": "Fan-out → Critique",
   "tokens": "~260-660K",
   "cost": "$0.80-2.05",
   "category": "research",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 10,
     "m": null
    },
    {
     "d": "res_tech",
     "x": 120,
     "y": 130,
     "m": null
    },
    {
     "d": "res_reddit",
     "x": 240,
     "y": 130,
     "m": null
    },
    {
     "d": "res_github",
     "x": 360,
     "y": 130,
     "m": null
    },
    {
     "d": "res_forums",
     "x": 480,
     "y": 130,
     "m": null
    },
    {
     "d": "res_docs",
     "x": 600,
     "y": 130,
     "m": null
    },
    {
     "d": "res_x",
     "x": 720,
     "y": 130,
     "m": null
    },
    {
     "d": "res_critic",
     "x": 400,
     "y": 280,
     "m": null
    },
    {
     "d": "synthesizer",
     "x": 400,
     "y": 420,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     0,
     3,
     "one"
    ],
    [
     0,
     4,
     "one"
    ],
    [
     0,
     5,
     "one"
    ],
    [
     0,
     6,
     "one"
    ],
    [
     1,
     7,
     "one"
    ],
    [
     2,
     7,
     "one"
    ],
    [
     3,
     7,
     "one"
    ],
    [
     4,
     7,
     "one"
    ],
    [
     5,
     7,
     "one"
    ],
    [
     6,
     7,
     "one"
    ],
    [
     7,
     8,
     "one"
    ],
    [
     8,
     0,
     "two"
    ]
   ]
  },
  "legacy": {
   "id": "legacy",
   "nameEn": "Legacy Refactor",
   "count": 9,
   "descEn": "Analysis + research → 3x build → 2x QA.",
   "useEn": "Refactoring, framework migration.",
   "flow": "Legacy Modernization",
   "tokens": "~330-830K",
   "cost": "$1.30-3.20",
   "category": "ops",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 10,
     "m": null
    },
    {
     "d": "analyst",
     "x": 400,
     "y": 105,
     "m": null
    },
    {
     "d": "res_tech",
     "x": 230,
     "y": 200,
     "m": null
    },
    {
     "d": "res_github",
     "x": 570,
     "y": 200,
     "m": null
    },
    {
     "d": "backend",
     "x": 180,
     "y": 310,
     "m": null
    },
    {
     "d": "frontend",
     "x": 400,
     "y": 310,
     "m": null
    },
    {
     "d": "integrator",
     "x": 620,
     "y": 310,
     "m": null
    },
    {
     "d": "qa_security",
     "x": 300,
     "y": 430,
     "m": null
    },
    {
     "d": "qa_quality",
     "x": 500,
     "y": 430,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     2,
     4,
     "one"
    ],
    [
     3,
     5,
     "one"
    ],
    [
     4,
     6,
     "one"
    ],
    [
     5,
     6,
     "one"
    ],
    [
     6,
     7,
     "one"
    ],
    [
     6,
     8,
     "one"
    ]
   ]
  },
  "saas": {
   "id": "saas",
   "nameEn": "Full-Stack SaaS",
   "count": 10,
   "descEn": "Research → build (3 roles) → integration → QA.",
   "useEn": "SaaS from scratch, dashboard.",
   "flow": "Hierarchical Squads",
   "tokens": "~360-900K",
   "cost": "$1.40-3.55",
   "category": "build",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 10,
     "m": null
    },
    {
     "d": "analyst",
     "x": 400,
     "y": 100,
     "m": null
    },
    {
     "d": "res_tech",
     "x": 230,
     "y": 200,
     "m": null
    },
    {
     "d": "res_ux",
     "x": 570,
     "y": 200,
     "m": null
    },
    {
     "d": "backend",
     "x": 180,
     "y": 310,
     "m": null
    },
    {
     "d": "frontend",
     "x": 400,
     "y": 310,
     "m": null
    },
    {
     "d": "designer",
     "x": 620,
     "y": 310,
     "m": null
    },
    {
     "d": "integrator",
     "x": 400,
     "y": 420,
     "m": null
    },
    {
     "d": "qa_security",
     "x": 280,
     "y": 530,
     "m": null
    },
    {
     "d": "qa_quality",
     "x": 520,
     "y": 530,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     2,
     4,
     "one"
    ],
    [
     3,
     5,
     "one"
    ],
    [
     3,
     6,
     "one"
    ],
    [
     4,
     7,
     "one"
    ],
    [
     5,
     7,
     "one"
    ],
    [
     6,
     7,
     "one"
    ],
    [
     7,
     8,
     "one"
    ],
    [
     7,
     9,
     "one"
    ]
   ]
  },
  "microservices": {
   "id": "microservices",
   "nameEn": "Microservices",
   "count": 11,
   "descEn": "Planning → 4x build → 3x QA.",
   "useEn": "Service mesh, containerization.",
   "flow": "Monolith Decomposition",
   "tokens": "~400-1000K",
   "cost": "$1.70-4.25",
   "category": "build",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 5,
     "m": null
    },
    {
     "d": "analyst",
     "x": 280,
     "y": 90,
     "m": null
    },
    {
     "d": "planner",
     "x": 520,
     "y": 90,
     "m": null
    },
    {
     "d": "res_tech",
     "x": 400,
     "y": 180,
     "m": null
    },
    {
     "d": "backend",
     "x": 160,
     "y": 280,
     "m": null
    },
    {
     "d": "feature",
     "x": 320,
     "y": 280,
     "m": null
    },
    {
     "d": "integrator",
     "x": 480,
     "y": 280,
     "m": null
    },
    {
     "d": "frontend",
     "x": 640,
     "y": 280,
     "m": null
    },
    {
     "d": "qa_security",
     "x": 230,
     "y": 400,
     "m": null
    },
    {
     "d": "qa_quality",
     "x": 400,
     "y": 400,
     "m": null
    },
    {
     "d": "qa_manager",
     "x": 570,
     "y": 400,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     3,
     5,
     "one"
    ],
    [
     3,
     6,
     "one"
    ],
    [
     3,
     7,
     "one"
    ],
    [
     4,
     8,
     "one"
    ],
    [
     5,
     8,
     "one"
    ],
    [
     6,
     9,
     "one"
    ],
    [
     7,
     9,
     "one"
    ],
    [
     8,
     10,
     "one"
    ],
    [
     9,
     10,
     "one"
    ],
    [
     10,
     0,
     "one"
    ]
   ]
  },
  "full": {
   "id": "full",
   "nameEn": "Full Hierarchy",
   "count": 13,
   "descEn": "5-layer hierarchy. Gold Standard.",
   "useEn": "Enterprise, mission-critical.",
   "flow": "Full 5-Layer Hierarchy",
   "tokens": "~430-1070K",
   "cost": "$1.65-4.20",
   "category": "build",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 10,
     "m": null
    },
    {
     "d": "analyst",
     "x": 290,
     "y": 100,
     "m": null
    },
    {
     "d": "planner",
     "x": 510,
     "y": 100,
     "m": null
    },
    {
     "d": "res_tech",
     "x": 170,
     "y": 200,
     "m": null
    },
    {
     "d": "res_ux",
     "x": 400,
     "y": 200,
     "m": null
    },
    {
     "d": "res_docs",
     "x": 630,
     "y": 200,
     "m": null
    },
    {
     "d": "backend",
     "x": 150,
     "y": 310,
     "m": null
    },
    {
     "d": "frontend",
     "x": 310,
     "y": 310,
     "m": null
    },
    {
     "d": "designer",
     "x": 490,
     "y": 310,
     "m": null
    },
    {
     "d": "integrator",
     "x": 650,
     "y": 310,
     "m": null
    },
    {
     "d": "qa_security",
     "x": 240,
     "y": 420,
     "m": null
    },
    {
     "d": "qa_quality",
     "x": 420,
     "y": 420,
     "m": null
    },
    {
     "d": "qa_manager",
     "x": 600,
     "y": 420,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     0,
     3,
     "one"
    ],
    [
     0,
     4,
     "one"
    ],
    [
     0,
     5,
     "one"
    ],
    [
     3,
     6,
     "one"
    ],
    [
     4,
     7,
     "one"
    ],
    [
     5,
     8,
     "one"
    ],
    [
     6,
     9,
     "one"
    ],
    [
     7,
     9,
     "one"
    ],
    [
     8,
     9,
     "one"
    ],
    [
     9,
     10,
     "one"
    ],
    [
     9,
     11,
     "one"
    ],
    [
     10,
     12,
     "one"
    ],
    [
     11,
     12,
     "one"
    ],
    [
     12,
     0,
     "one"
    ]
   ]
  },
  "deep": {
   "id": "deep",
   "nameEn": "Deep Research+Build",
   "count": 18,
   "descEn": "6 researchers + critic + synthesizer + 4 build + 3 QA.",
   "useEn": "Enterprise with deep analysis.",
   "flow": "Full Orchestra",
   "tokens": "~600-1500K",
   "cost": "$2.20-5.55",
   "category": "build",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 420,
     "y": 5,
     "m": null
    },
    {
     "d": "analyst",
     "x": 240,
     "y": 85,
     "m": null
    },
    {
     "d": "planner",
     "x": 450,
     "y": 85,
     "m": null
    },
    {
     "d": "synthesizer",
     "x": 620,
     "y": 85,
     "m": null
    },
    {
     "d": "res_reddit",
     "x": 100,
     "y": 175,
     "m": null
    },
    {
     "d": "res_x",
     "x": 220,
     "y": 175,
     "m": null
    },
    {
     "d": "res_ux",
     "x": 340,
     "y": 175,
     "m": null
    },
    {
     "d": "res_github",
     "x": 460,
     "y": 175,
     "m": null
    },
    {
     "d": "res_forums",
     "x": 580,
     "y": 175,
     "m": null
    },
    {
     "d": "res_docs",
     "x": 700,
     "y": 175,
     "m": null
    },
    {
     "d": "res_critic",
     "x": 420,
     "y": 270,
     "m": null
    },
    {
     "d": "backend",
     "x": 190,
     "y": 365,
     "m": null
    },
    {
     "d": "frontend",
     "x": 370,
     "y": 365,
     "m": null
    },
    {
     "d": "feature",
     "x": 530,
     "y": 365,
     "m": null
    },
    {
     "d": "integrator",
     "x": 680,
     "y": 365,
     "m": null
    },
    {
     "d": "qa_security",
     "x": 260,
     "y": 460,
     "m": null
    },
    {
     "d": "qa_quality",
     "x": 440,
     "y": 460,
     "m": null
    },
    {
     "d": "qa_manager",
     "x": 610,
     "y": 460,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     0,
     3,
     "two"
    ],
    [
     1,
     4,
     "one"
    ],
    [
     1,
     5,
     "one"
    ],
    [
     1,
     6,
     "one"
    ],
    [
     1,
     7,
     "one"
    ],
    [
     1,
     8,
     "one"
    ],
    [
     1,
     9,
     "one"
    ],
    [
     4,
     10,
     "one"
    ],
    [
     5,
     10,
     "one"
    ],
    [
     6,
     10,
     "one"
    ],
    [
     7,
     10,
     "one"
    ],
    [
     8,
     10,
     "one"
    ],
    [
     9,
     10,
     "one"
    ],
    [
     10,
     3,
     "one"
    ],
    [
     3,
     11,
     "one"
    ],
    [
     3,
     12,
     "one"
    ],
    [
     3,
     13,
     "one"
    ],
    [
     11,
     14,
     "one"
    ],
    [
     12,
     14,
     "one"
    ],
    [
     13,
     14,
     "one"
    ],
    [
     14,
     15,
     "one"
    ],
    [
     14,
     16,
     "one"
    ],
    [
     15,
     17,
     "one"
    ],
    [
     16,
     17,
     "one"
    ],
    [
     17,
     0,
     "one"
    ]
   ]
  },
  "five_minds": {
   "id": "five_minds",
   "nameEn": "Five Minds Protocol",
   "count": 14,
   "descEn": "4 experts + Devil's Advocate debate.",
   "useEn": "Architectural decisions.",
   "flow": "Fan-out → Debate → Build",
   "tokens": "~440-1080K",
   "cost": "$2.30-5.80",
   "category": "strategy",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": null
    },
    {
     "d": "res_tech",
     "x": 200,
     "y": 130,
     "m": null
    },
    {
     "d": "res_ux",
     "x": 400,
     "y": 130,
     "m": null
    },
    {
     "d": "res_forums",
     "x": 600,
     "y": 130,
     "m": null
    },
    {
     "d": "analyst",
     "x": 400,
     "y": 240,
     "m": null
    },
    {
     "d": "expert_innovator",
     "x": 100,
     "y": 360,
     "m": null
    },
    {
     "d": "expert_pragmatist",
     "x": 250,
     "y": 360,
     "m": null
    },
    {
     "d": "expert_analyst",
     "x": 400,
     "y": 360,
     "m": null
    },
    {
     "d": "expert_user",
     "x": 550,
     "y": 360,
     "m": null
    },
    {
     "d": "expert_devil",
     "x": 700,
     "y": 360,
     "m": null
    },
    {
     "d": "synthesizer",
     "x": 400,
     "y": 480,
     "m": null
    },
    {
     "d": "backend",
     "x": 250,
     "y": 600,
     "m": null
    },
    {
     "d": "frontend",
     "x": 400,
     "y": 600,
     "m": null
    },
    {
     "d": "qa_manager",
     "x": 550,
     "y": 600,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     0,
     3,
     "one"
    ],
    [
     1,
     4,
     "one"
    ],
    [
     2,
     4,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     4,
     5,
     "two"
    ],
    [
     4,
     6,
     "two"
    ],
    [
     4,
     7,
     "two"
    ],
    [
     4,
     8,
     "two"
    ],
    [
     4,
     9,
     "two"
    ],
    [
     5,
     10,
     "one"
    ],
    [
     6,
     10,
     "one"
    ],
    [
     7,
     10,
     "one"
    ],
    [
     8,
     10,
     "one"
    ],
    [
     9,
     10,
     "one"
    ],
    [
     10,
     11,
     "one"
    ],
    [
     10,
     12,
     "one"
    ],
    [
     11,
     13,
     "one"
    ],
    [
     12,
     13,
     "one"
    ],
    [
     13,
     0,
     "continuous"
    ]
   ]
  },
  "deep_five_minds": {
   "id": "deep_five_minds",
   "nameEn": "Deep Five Minds",
   "count": 27,
   "descEn": "Deep Research + 2x Five Minds debate + 3 HITL gates. Maximum preset.",
   "useEn": "Critical enterprise, platforms, irreversible decisions.",
   "flow": "Deep Research → HITL → Five Minds → HITL → Build → HITL → QA",
   "tokens": "~750-1880K",
   "cost": "$2.80-7.10",
   "category": "strategy",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 5,
     "m": null
    },
    {
     "d": "analyst",
     "x": 250,
     "y": 80,
     "m": null
    },
    {
     "d": "planner",
     "x": 400,
     "y": 80,
     "m": null
    },
    {
     "d": "synthesizer",
     "x": 550,
     "y": 80,
     "m": null
    },
    {
     "d": "decision_presenter",
     "x": 420,
     "y": 135,
     "m": null
    },
    {
     "d": "res_tech",
     "x": 100,
     "y": 200,
     "m": null
    },
    {
     "d": "res_reddit",
     "x": 230,
     "y": 200,
     "m": null
    },
    {
     "d": "res_ux",
     "x": 360,
     "y": 200,
     "m": null
    },
    {
     "d": "res_github",
     "x": 490,
     "y": 200,
     "m": null
    },
    {
     "d": "res_forums",
     "x": 620,
     "y": 200,
     "m": null
    },
    {
     "d": "res_x",
     "x": 750,
     "y": 200,
     "m": null
    },
    {
     "d": "res_critic",
     "x": 250,
     "y": 300,
     "m": null
    },
    {
     "d": "expert_pragmatist",
     "x": 400,
     "y": 300,
     "m": null
    },
    {
     "d": "expert_innovator",
     "x": 550,
     "y": 300,
     "m": null
    },
    {
     "d": "expert_analyst",
     "x": 250,
     "y": 380,
     "m": null
    },
    {
     "d": "expert_user",
     "x": 400,
     "y": 380,
     "m": null
    },
    {
     "d": "expert_devil",
     "x": 550,
     "y": 380,
     "m": null
    },
    {
     "d": "decision_presenter",
     "x": 420,
     "y": 435,
     "m": null
    },
    {
     "d": "backend",
     "x": 150,
     "y": 500,
     "m": null
    },
    {
     "d": "frontend",
     "x": 300,
     "y": 500,
     "m": null
    },
    {
     "d": "feature",
     "x": 450,
     "y": 500,
     "m": null
    },
    {
     "d": "designer",
     "x": 600,
     "y": 500,
     "m": null
    },
    {
     "d": "integrator",
     "x": 750,
     "y": 500,
     "m": null
    },
    {
     "d": "decision_presenter",
     "x": 420,
     "y": 565,
     "m": null
    },
    {
     "d": "qa_security",
     "x": 300,
     "y": 630,
     "m": null
    },
    {
     "d": "qa_quality",
     "x": 500,
     "y": 630,
     "m": null
    },
    {
     "d": "qa_manager",
     "x": 400,
     "y": 730,
     "m": null
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     0,
     3,
     "two"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     4,
     5,
     "one"
    ],
    [
     4,
     6,
     "one"
    ],
    [
     4,
     7,
     "one"
    ],
    [
     4,
     8,
     "one"
    ],
    [
     4,
     9,
     "one"
    ],
    [
     4,
     10,
     "one"
    ],
    [
     5,
     11,
     "one"
    ],
    [
     6,
     11,
     "one"
    ],
    [
     7,
     11,
     "one"
    ],
    [
     8,
     11,
     "one"
    ],
    [
     9,
     11,
     "one"
    ],
    [
     10,
     11,
     "one"
    ],
    [
     11,
     3,
     "one"
    ],
    [
     3,
     12,
     "two"
    ],
    [
     3,
     13,
     "two"
    ],
    [
     3,
     14,
     "two"
    ],
    [
     3,
     15,
     "two"
    ],
    [
     3,
     16,
     "two"
    ],
    [
     12,
     3,
     "one"
    ],
    [
     13,
     3,
     "one"
    ],
    [
     14,
     3,
     "one"
    ],
    [
     15,
     3,
     "one"
    ],
    [
     16,
     3,
     "one"
    ],
    [
     3,
     17,
     "one"
    ],
    [
     17,
     18,
     "one"
    ],
    [
     17,
     19,
     "one"
    ],
    [
     17,
     20,
     "one"
    ],
    [
     17,
     21,
     "one"
    ],
    [
     17,
     22,
     "one"
    ],
    [
     22,
     23,
     "one"
    ],
    [
     18,
     23,
     "one"
    ],
    [
     19,
     23,
     "one"
    ],
    [
     20,
     23,
     "one"
    ],
    [
     21,
     23,
     "one"
    ],
    [
     23,
     24,
     "one"
    ],
    [
     23,
     25,
     "one"
    ],
    [
     24,
     26,
     "one"
    ],
    [
     25,
     26,
     "one"
    ],
    [
     26,
     0,
     "one"
    ]
   ]
  },
  "deep_research_swarm_pro": {
   "id": "deep_research_swarm_pro",
   "nameEn": "Deep Research Swarm Pro",
   "count": 10,
   "descEn": "Siedmiu researcherów w stylu Anthropic + Krytyk + Syntetyk.",
   "useEn": "Badania z wielu źródeł: rozpoznanie rynku, przegląd literatury.",
   "flow": "Lead Researcher Pattern",
   "tokens": "~280-700K",
   "cost": "$1.40-3.50",
   "category": "research",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "res_tech",
     "x": 80,
     "y": 160,
     "m": "sonnet"
    },
    {
     "d": "res_ux",
     "x": 200,
     "y": 160,
     "m": "sonnet"
    },
    {
     "d": "res_reddit",
     "x": 320,
     "y": 160,
     "m": "sonnet"
    },
    {
     "d": "res_x",
     "x": 440,
     "y": 160,
     "m": "sonnet"
    },
    {
     "d": "res_github",
     "x": 560,
     "y": 160,
     "m": "sonnet"
    },
    {
     "d": "res_forums",
     "x": 680,
     "y": 160,
     "m": "sonnet"
    },
    {
     "d": "res_docs",
     "x": 380,
     "y": 280,
     "m": "sonnet"
    },
    {
     "d": "res_critic",
     "x": 400,
     "y": 400,
     "m": "opus"
    },
    {
     "d": "synthesizer",
     "x": 400,
     "y": 520,
     "m": "opus"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     0,
     3,
     "one"
    ],
    [
     0,
     4,
     "one"
    ],
    [
     0,
     5,
     "one"
    ],
    [
     0,
     6,
     "one"
    ],
    [
     0,
     7,
     "one"
    ],
    [
     1,
     8,
     "one"
    ],
    [
     2,
     8,
     "one"
    ],
    [
     3,
     8,
     "one"
    ],
    [
     4,
     8,
     "one"
    ],
    [
     5,
     8,
     "one"
    ],
    [
     6,
     8,
     "one"
    ],
    [
     7,
     8,
     "one"
    ],
    [
     8,
     9,
     "one"
    ],
    [
     9,
     0,
     "continuous"
    ]
   ]
  },
  "migration_crew": {
   "id": "migration_crew",
   "nameEn": "Migration Crew",
   "count": 10,
   "descEn": "Migracja starego kodu z trzema zwiadowcami równolegle + brama HITL.",
   "useEn": "Java 8→21, Angular→React, Python 2→3, REST→gRPC.",
   "flow": "Plan → Explore → Migrate",
   "tokens": "~270-680K",
   "cost": "$1.10-2.80",
   "category": "ops",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "analyst",
     "x": 260,
     "y": 130,
     "m": "sonnet"
    },
    {
     "d": "planner",
     "x": 540,
     "y": 130,
     "m": "opus"
    },
    {
     "d": "res_github",
     "x": 160,
     "y": 240,
     "m": "sonnet"
    },
    {
     "d": "res_tech",
     "x": 400,
     "y": 240,
     "m": "sonnet"
    },
    {
     "d": "res_docs",
     "x": 640,
     "y": 240,
     "m": "sonnet"
    },
    {
     "d": "decision_presenter",
     "x": 400,
     "y": 350,
     "m": "sonnet"
    },
    {
     "d": "backend",
     "x": 280,
     "y": 460,
     "m": "sonnet"
    },
    {
     "d": "integrator",
     "x": 520,
     "y": 460,
     "m": "sonnet"
    },
    {
     "d": "qa_quality",
     "x": 400,
     "y": 570,
     "m": "haiku"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     1,
     4,
     "one"
    ],
    [
     1,
     5,
     "one"
    ],
    [
     2,
     6,
     "one"
    ],
    [
     3,
     6,
     "one"
    ],
    [
     4,
     6,
     "one"
    ],
    [
     5,
     6,
     "one"
    ],
    [
     6,
     7,
     "one"
    ],
    [
     6,
     8,
     "one"
    ],
    [
     7,
     9,
     "one"
    ],
    [
     8,
     9,
     "one"
    ],
    [
     9,
     0,
     "continuous"
    ]
   ]
  },
  "fullstack_premium": {
   "id": "fullstack_premium",
   "nameEn": "Full-Stack Premium",
   "count": 12,
   "descEn": "Siedmioosobowy zespół full-stack + badania UX + obserwowalność + architekt bazy danych.",
   "useEn": "Funkcja gotowa na produkcje, z obserwowalnością i projektem bazy danych.",
   "flow": "Hierarchical Build",
   "tokens": "~380-940K",
   "cost": "$1.55-3.85",
   "category": "build",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "analyst",
     "x": 260,
     "y": 120,
     "m": "sonnet"
    },
    {
     "d": "planner",
     "x": 540,
     "y": 120,
     "m": "sonnet"
    },
    {
     "d": "res_ux",
     "x": 200,
     "y": 220,
     "m": "haiku"
    },
    {
     "d": "res_docs",
     "x": 600,
     "y": 220,
     "m": "haiku"
    },
    {
     "d": "db_architect",
     "x": 400,
     "y": 320,
     "m": "sonnet"
    },
    {
     "d": "designer",
     "x": 140,
     "y": 430,
     "m": "sonnet"
    },
    {
     "d": "backend",
     "x": 300,
     "y": 430,
     "m": "sonnet"
    },
    {
     "d": "frontend",
     "x": 500,
     "y": 430,
     "m": "sonnet"
    },
    {
     "d": "integrator",
     "x": 660,
     "y": 430,
     "m": "sonnet"
    },
    {
     "d": "qa_security",
     "x": 280,
     "y": 540,
     "m": "opus"
    },
    {
     "d": "observability_engineer",
     "x": 520,
     "y": 540,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     1,
     4,
     "one"
    ],
    [
     2,
     5,
     "one"
    ],
    [
     3,
     6,
     "one"
    ],
    [
     4,
     6,
     "one"
    ],
    [
     5,
     7,
     "one"
    ],
    [
     5,
     8,
     "one"
    ],
    [
     7,
     9,
     "one"
    ],
    [
     8,
     9,
     "one"
    ],
    [
     6,
     9,
     "one"
    ],
    [
     9,
     10,
     "one"
    ],
    [
     9,
     11,
     "one"
    ],
    [
     10,
     0,
     "continuous"
    ],
    [
     11,
     0,
     "continuous"
    ]
   ]
  },
  "security_multi_vector": {
   "id": "security_multi_vector",
   "nameEn": "Multi-Vector Security",
   "count": 9,
   "descEn": "Pięć skanerów równolegle + STRIDE + brama wydania.",
   "useEn": "Przegląd bezpieczeństwa przed wydaniem i przygotowanie do audytu SOC 2.",
   "flow": "Threat Model → Fan-out → Gate",
   "tokens": "~220-560K",
   "cost": "$1.20-3.00",
   "category": "quality",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "analyst",
     "x": 400,
     "y": 130,
     "m": "opus"
    },
    {
     "d": "qa_security",
     "x": 120,
     "y": 240,
     "m": "opus"
    },
    {
     "d": "qa_quality",
     "x": 280,
     "y": 240,
     "m": "haiku"
    },
    {
     "d": "qa_perf",
     "x": 440,
     "y": 240,
     "m": "sonnet"
    },
    {
     "d": "res_github",
     "x": 600,
     "y": 240,
     "m": "haiku"
    },
    {
     "d": "expert_devil",
     "x": 280,
     "y": 360,
     "m": "sonnet"
    },
    {
     "d": "qa_manager",
     "x": 480,
     "y": 360,
     "m": "opus"
    },
    {
     "d": "decision_presenter",
     "x": 400,
     "y": 480,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     1,
     4,
     "one"
    ],
    [
     1,
     5,
     "one"
    ],
    [
     2,
     7,
     "one"
    ],
    [
     3,
     7,
     "one"
    ],
    [
     4,
     7,
     "one"
    ],
    [
     5,
     7,
     "one"
    ],
    [
     6,
     7,
     "one"
    ],
    [
     1,
     6,
     "two"
    ],
    [
     7,
     8,
     "one"
    ],
    [
     8,
     0,
     "continuous"
    ]
   ]
  },
  "perf_squad": {
   "id": "perf_squad",
   "nameEn": "Performance Squad",
   "count": 8,
   "descEn": "Debata Five Minds + trzej specjaliści diagnozujący równolegle.",
   "useEn": "Dojście do przyczyny spadku wydajności na produkcji: pomiar, profil, hipotezy.",
   "flow": "Hypothesis-driven",
   "tokens": "~200-510K",
   "cost": "$0.95-2.40",
   "category": "quality",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "analyst",
     "x": 400,
     "y": 130,
     "m": "sonnet"
    },
    {
     "d": "db_architect",
     "x": 160,
     "y": 240,
     "m": "sonnet"
    },
    {
     "d": "frontend",
     "x": 400,
     "y": 240,
     "m": "sonnet"
    },
    {
     "d": "backend",
     "x": 640,
     "y": 240,
     "m": "sonnet"
    },
    {
     "d": "expert_devil",
     "x": 280,
     "y": 360,
     "m": "opus"
    },
    {
     "d": "qa_perf",
     "x": 520,
     "y": 360,
     "m": "sonnet"
    },
    {
     "d": "synthesizer",
     "x": 400,
     "y": 480,
     "m": "opus"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     1,
     4,
     "one"
    ],
    [
     2,
     5,
     "one"
    ],
    [
     3,
     5,
     "one"
    ],
    [
     4,
     5,
     "one"
    ],
    [
     5,
     6,
     "two"
    ],
    [
     6,
     7,
     "one"
    ],
    [
     7,
     0,
     "continuous"
    ]
   ]
  },
  "prd_to_launch": {
   "id": "prd_to_launch",
   "nameEn": "PRD to Launch",
   "count": 11,
   "descEn": "JTBD → PRD → zadania, projekty graficzne, teksty i plan wejścia na rynek.",
   "useEn": "Od pomysłu lub zapisu rozmowy do kompletu materiałów na wdrożenie.",
   "flow": "Product Pipeline",
   "tokens": "~280-700K",
   "cost": "$1.30-3.30",
   "category": "build",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "analyst",
     "x": 400,
     "y": 130,
     "m": "sonnet"
    },
    {
     "d": "res_ux",
     "x": 240,
     "y": 240,
     "m": "haiku"
    },
    {
     "d": "res_reddit",
     "x": 560,
     "y": 240,
     "m": "haiku"
    },
    {
     "d": "writer",
     "x": 400,
     "y": 340,
     "m": "opus"
    },
    {
     "d": "planner",
     "x": 120,
     "y": 450,
     "m": "sonnet"
    },
    {
     "d": "designer",
     "x": 280,
     "y": 450,
     "m": "sonnet"
    },
    {
     "d": "feature",
     "x": 440,
     "y": 450,
     "m": "sonnet"
    },
    {
     "d": "gtm_strategist",
     "x": 600,
     "y": 450,
     "m": "opus"
    },
    {
     "d": "res_critic",
     "x": 300,
     "y": 560,
     "m": "sonnet"
    },
    {
     "d": "decision_presenter",
     "x": 500,
     "y": 560,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     2,
     4,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     4,
     5,
     "one"
    ],
    [
     4,
     6,
     "one"
    ],
    [
     4,
     7,
     "one"
    ],
    [
     4,
     8,
     "one"
    ],
    [
     5,
     9,
     "one"
    ],
    [
     6,
     9,
     "one"
    ],
    [
     7,
     9,
     "one"
    ],
    [
     8,
     9,
     "one"
    ],
    [
     9,
     10,
     "one"
    ],
    [
     10,
     0,
     "continuous"
    ]
   ]
  },
  "ab_test_lab": {
   "id": "ab_test_lab",
   "nameEn": "A/B Test Lab",
   "count": 7,
   "descEn": "Moc testu + warianty + polowanie na naciąganie wyników + zatwierdzenie statystyki.",
   "useEn": "Rygorystyczny projekt testu A/B od początku do końca.",
   "flow": "Statistical Pipeline",
   "tokens": "~140-360K",
   "cost": "$0.80-2.00",
   "category": "strategy",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "statistician",
     "x": 240,
     "y": 130,
     "m": "opus"
    },
    {
     "d": "analyst",
     "x": 560,
     "y": 130,
     "m": "sonnet"
    },
    {
     "d": "res_ux",
     "x": 240,
     "y": 240,
     "m": "haiku"
    },
    {
     "d": "designer",
     "x": 560,
     "y": 240,
     "m": "sonnet"
    },
    {
     "d": "expert_devil",
     "x": 400,
     "y": 360,
     "m": "opus"
    },
    {
     "d": "decision_presenter",
     "x": 400,
     "y": 480,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     1,
     4,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     1,
     5,
     "two"
    ],
    [
     4,
     5,
     "two"
    ],
    [
     5,
     6,
     "one"
    ],
    [
     6,
     0,
     "continuous"
    ]
   ]
  },
  "kb_constructor": {
   "id": "kb_constructor",
   "nameEn": "KB Constructor",
   "count": 10,
   "descEn": "Cztery zbieracze + usuwanie duplikatów + Pisarz + Krytyk + Integrator.",
   "useEn": "Budowa wiki lub bazy wiedzy z rozproszonych źródeł (Slack, wiki, pliki PDF).",
   "flow": "Ingest → Dedup → Publish",
   "tokens": "~250-630K",
   "cost": "$0.85-2.15",
   "category": "research",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "res_forums",
     "x": 120,
     "y": 140,
     "m": "haiku"
    },
    {
     "d": "res_docs",
     "x": 280,
     "y": 140,
     "m": "haiku"
    },
    {
     "d": "res_tech",
     "x": 440,
     "y": 140,
     "m": "haiku"
    },
    {
     "d": "res_github",
     "x": 600,
     "y": 140,
     "m": "haiku"
    },
    {
     "d": "analyst",
     "x": 400,
     "y": 260,
     "m": "opus"
    },
    {
     "d": "feature",
     "x": 200,
     "y": 380,
     "m": "haiku"
    },
    {
     "d": "writer",
     "x": 400,
     "y": 380,
     "m": "sonnet"
    },
    {
     "d": "res_critic",
     "x": 600,
     "y": 380,
     "m": "sonnet"
    },
    {
     "d": "integrator",
     "x": 400,
     "y": 500,
     "m": "haiku"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     0,
     3,
     "one"
    ],
    [
     0,
     4,
     "one"
    ],
    [
     1,
     5,
     "one"
    ],
    [
     2,
     5,
     "one"
    ],
    [
     3,
     5,
     "one"
    ],
    [
     4,
     5,
     "one"
    ],
    [
     5,
     6,
     "one"
    ],
    [
     5,
     7,
     "one"
    ],
    [
     6,
     7,
     "one"
    ],
    [
     7,
     8,
     "two"
    ],
    [
     7,
     9,
     "one"
    ],
    [
     9,
     0,
     "continuous"
    ]
   ]
  },
  "tech_writing_pipe": {
   "id": "tech_writing_pipe",
   "nameEn": "Tech Writing Pipeline",
   "count": 8,
   "descEn": "Konspekt i research → Pisarz, diagramy i optymalizacja pod wyszukiwarki → Krytyk.",
   "useEn": "Długi wpis, dokument biały albo prelekcja z surowego konspektu.",
   "flow": "Content Pipeline",
   "tokens": "~180-450K",
   "cost": "$0.75-1.85",
   "category": "content",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "sonnet"
    },
    {
     "d": "res_docs",
     "x": 240,
     "y": 140,
     "m": "haiku"
    },
    {
     "d": "res_github",
     "x": 560,
     "y": 140,
     "m": "haiku"
    },
    {
     "d": "analyst",
     "x": 400,
     "y": 250,
     "m": "sonnet"
    },
    {
     "d": "writer",
     "x": 400,
     "y": 360,
     "m": "opus"
    },
    {
     "d": "designer",
     "x": 200,
     "y": 470,
     "m": "sonnet"
    },
    {
     "d": "res_critic",
     "x": 400,
     "y": 470,
     "m": "sonnet"
    },
    {
     "d": "feature",
     "x": 600,
     "y": 470,
     "m": "haiku"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     4,
     5,
     "one"
    ],
    [
     4,
     6,
     "two"
    ],
    [
     4,
     7,
     "one"
    ],
    [
     7,
     0,
     "continuous"
    ]
   ]
  },
  "five_minds_strategic": {
   "id": "five_minds_strategic",
   "nameEn": "Five Minds Strategic",
   "count": 13,
   "descEn": "Cztery researche równolegle → pięciu ekspertów i Cień → HITL.",
   "useEn": "Strategia przy wysokiej stawce: zwrot kierunku, przejęcie, wybór technologii.",
   "flow": "Research → Debate → Gold",
   "tokens": "~340-850K",
   "cost": "$1.65-4.10",
   "category": "strategy",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "res_tech",
     "x": 120,
     "y": 130,
     "m": "sonnet"
    },
    {
     "d": "res_reddit",
     "x": 300,
     "y": 130,
     "m": "sonnet"
    },
    {
     "d": "res_forums",
     "x": 480,
     "y": 130,
     "m": "sonnet"
    },
    {
     "d": "res_docs",
     "x": 660,
     "y": 130,
     "m": "sonnet"
    },
    {
     "d": "analyst",
     "x": 400,
     "y": 240,
     "m": "opus"
    },
    {
     "d": "expert_innovator",
     "x": 100,
     "y": 360,
     "m": "opus"
    },
    {
     "d": "expert_pragmatist",
     "x": 250,
     "y": 360,
     "m": "opus"
    },
    {
     "d": "expert_analyst",
     "x": 400,
     "y": 360,
     "m": "opus"
    },
    {
     "d": "expert_user",
     "x": 550,
     "y": 360,
     "m": "opus"
    },
    {
     "d": "expert_devil",
     "x": 700,
     "y": 360,
     "m": "opus"
    },
    {
     "d": "synthesizer",
     "x": 400,
     "y": 480,
     "m": "opus"
    },
    {
     "d": "decision_presenter",
     "x": 400,
     "y": 600,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     0,
     3,
     "one"
    ],
    [
     0,
     4,
     "one"
    ],
    [
     1,
     5,
     "one"
    ],
    [
     2,
     5,
     "one"
    ],
    [
     3,
     5,
     "one"
    ],
    [
     4,
     5,
     "one"
    ],
    [
     5,
     6,
     "two"
    ],
    [
     5,
     7,
     "two"
    ],
    [
     5,
     8,
     "two"
    ],
    [
     5,
     9,
     "two"
    ],
    [
     5,
     10,
     "two"
    ],
    [
     6,
     11,
     "one"
    ],
    [
     7,
     11,
     "one"
    ],
    [
     8,
     11,
     "one"
    ],
    [
     9,
     11,
     "one"
    ],
    [
     10,
     11,
     "one"
    ],
    [
     11,
     12,
     "one"
    ],
    [
     12,
     0,
     "continuous"
    ]
   ]
  },
  "soc2_sweep": {
   "id": "soc2_sweep",
   "nameEn": "SOC2 Sweep",
   "count": 9,
   "descEn": "Polityki + mapowanie kontroli + dowody + analiza luk + zatwierdzenie przez CISO.",
   "useEn": "Przygotowanie do audytu SOC 2 Type II.",
   "flow": "Compliance Sweep",
   "tokens": "~220-560K",
   "cost": "$1.10-2.75",
   "category": "ops",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "res_docs",
     "x": 200,
     "y": 140,
     "m": "haiku"
    },
    {
     "d": "control_mapper",
     "x": 400,
     "y": 140,
     "m": "sonnet"
    },
    {
     "d": "res_github",
     "x": 600,
     "y": 140,
     "m": "haiku"
    },
    {
     "d": "analyst",
     "x": 240,
     "y": 260,
     "m": "opus"
    },
    {
     "d": "qa_security",
     "x": 560,
     "y": 260,
     "m": "opus"
    },
    {
     "d": "writer",
     "x": 240,
     "y": 380,
     "m": "sonnet"
    },
    {
     "d": "res_critic",
     "x": 560,
     "y": 380,
     "m": "sonnet"
    },
    {
     "d": "decision_presenter",
     "x": 400,
     "y": 500,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     0,
     3,
     "one"
    ],
    [
     1,
     4,
     "one"
    ],
    [
     2,
     4,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     4,
     5,
     "one"
    ],
    [
     4,
     6,
     "one"
    ],
    [
     5,
     7,
     "two"
    ],
    [
     6,
     7,
     "one"
    ],
    [
     7,
     8,
     "one"
    ],
    [
     8,
     0,
     "continuous"
    ]
   ]
  },
  "data_analysis_pipe": {
   "id": "data_analysis_pipe",
   "nameEn": "Data Analysis Pipeline",
   "count": 9,
   "descEn": "Zebranie → czyszczenie → analiza eksploracyjna i SQL → model → raport z wykresami.",
   "useEn": "Surowe zbiory danych zamienione w analize gotowa dla decydentów.",
   "flow": "Data Science Flow",
   "tokens": "~240-600K",
   "cost": "$1.10-2.75",
   "category": "data",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "analyst",
     "x": 200,
     "y": 140,
     "m": "haiku"
    },
    {
     "d": "backend",
     "x": 400,
     "y": 140,
     "m": "haiku"
    },
    {
     "d": "eda_analyst",
     "x": 600,
     "y": 140,
     "m": "sonnet"
    },
    {
     "d": "integrator",
     "x": 200,
     "y": 260,
     "m": "sonnet"
    },
    {
     "d": "feature",
     "x": 600,
     "y": 260,
     "m": "opus"
    },
    {
     "d": "writer",
     "x": 240,
     "y": 380,
     "m": "sonnet"
    },
    {
     "d": "designer",
     "x": 560,
     "y": 380,
     "m": "sonnet"
    },
    {
     "d": "res_critic",
     "x": 400,
     "y": 500,
     "m": "opus"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     2,
     4,
     "one"
    ],
    [
     3,
     5,
     "one"
    ],
    [
     4,
     5,
     "one"
    ],
    [
     5,
     6,
     "one"
    ],
    [
     5,
     7,
     "one"
    ],
    [
     6,
     8,
     "two"
    ],
    [
     7,
     8,
     "one"
    ],
    [
     8,
     0,
     "continuous"
    ]
   ]
  },
  "incident_war_room": {
   "id": "incident_war_room",
   "nameEn": "Incident War Room",
   "count": 10,
   "descEn": "Równolegle telemetria, logi i różnice w kodzie → Cień → brama przed wycofaniem zmian → analiza powypadkowa.",
   "useEn": "Od segregacji żywej awarii na produkcji po analize powypadkowa.",
   "flow": "War Room Triage",
   "tokens": "~270-680K",
   "cost": "$1.30-3.30",
   "category": "ops",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 20,
     "m": "opus"
    },
    {
     "d": "telemetry_surfer",
     "x": 160,
     "y": 140,
     "m": "haiku"
    },
    {
     "d": "qa_quality",
     "x": 400,
     "y": 140,
     "m": "haiku"
    },
    {
     "d": "res_github",
     "x": 640,
     "y": 140,
     "m": "sonnet"
    },
    {
     "d": "qa_perf",
     "x": 240,
     "y": 260,
     "m": "sonnet"
    },
    {
     "d": "qa_security",
     "x": 560,
     "y": 260,
     "m": "sonnet"
    },
    {
     "d": "expert_devil",
     "x": 400,
     "y": 360,
     "m": "opus"
    },
    {
     "d": "decision_presenter",
     "x": 400,
     "y": 460,
     "m": "opus"
    },
    {
     "d": "feature",
     "x": 280,
     "y": 560,
     "m": "sonnet"
    },
    {
     "d": "writer",
     "x": 520,
     "y": 560,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     0,
     3,
     "one"
    ],
    [
     1,
     4,
     "one"
    ],
    [
     2,
     4,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     1,
     5,
     "one"
    ],
    [
     2,
     5,
     "one"
    ],
    [
     3,
     5,
     "one"
    ],
    [
     4,
     6,
     "two"
    ],
    [
     5,
     6,
     "two"
    ],
    [
     6,
     7,
     "one"
    ],
    [
     7,
     8,
     "one"
    ],
    [
     7,
     9,
     "one"
    ],
    [
     9,
     0,
     "continuous"
    ]
   ]
  },
  "voice": {
   "id": "voice",
   "nameEn": "Voice",
   "count": 3,
   "descEn": "Voice profiler + Writer in your voice + Voice guardian (+ HITL loop).",
   "useEn": "Maile, wiadomości, fragmenty CV pisane w Twoim stylu, bez sieczki AI.",
   "flow": "Linear Pipeline + HITL",
   "tokens": "~90-220K",
   "cost": "$0.20-0.55",
   "category": "content",
   "nodes": [
    {
     "d": "style_profiler",
     "x": 400,
     "y": 60,
     "m": "sonnet"
    },
    {
     "d": "voice_writer",
     "x": 400,
     "y": 210,
     "m": "sonnet"
    },
    {
     "d": "voice_qa",
     "x": 400,
     "y": 360,
     "m": "haiku"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     2,
     1,
     "two"
    ]
   ]
  },
  "content_social": {
   "id": "content_social",
   "nameEn": "Content Social",
   "count": 4,
   "descEn": "Voice profiler + Social strategist + Writer in your voice + Voice guardian (+ HITL).",
   "useEn": "Posty LinkedIn/Facebook/X w Twoim głosie, dopasowane do platformy.",
   "flow": "Strategy Pipeline + HITL",
   "tokens": "~120-300K",
   "cost": "$0.30-0.75",
   "category": "content",
   "nodes": [
    {
     "d": "style_profiler",
     "x": 400,
     "y": 30,
     "m": "sonnet"
    },
    {
     "d": "social_strategist",
     "x": 400,
     "y": 150,
     "m": "sonnet"
    },
    {
     "d": "voice_writer",
     "x": 400,
     "y": 270,
     "m": "sonnet"
    },
    {
     "d": "voice_qa",
     "x": 400,
     "y": 390,
     "m": "haiku"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     3,
     2,
     "two"
    ]
   ]
  },
  "kariera": {
   "id": "kariera",
   "nameEn": "Career",
   "count": 4,
   "descEn": "Role research + CV/letter tailored to the posting (zero-fabrication) + interview training.",
   "useEn": "Realna aplikacja na konkretne stanowisko: dokumenty i przygotowanie do rozmowy.",
   "flow": "Research → Dokumenty → Przygotowanie",
   "tokens": "~150-380K",
   "cost": "$0.35-0.90",
   "category": "content",
   "nodes": [
    {
     "d": "res_forums",
     "x": 260,
     "y": 60,
     "m": "haiku"
    },
    {
     "d": "res_docs",
     "x": 540,
     "y": 60,
     "m": "haiku"
    },
    {
     "d": "career_document_builder",
     "x": 400,
     "y": 210,
     "m": "sonnet"
    },
    {
     "d": "interview_coach",
     "x": 400,
     "y": 360,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     2,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     2,
     3,
     "one"
    ]
   ]
  },
  "kuchmistrz": {
   "id": "kuchmistrz",
   "nameEn": "Master Chef",
   "count": 3,
   "descEn": "Recipe scout + Taste advisor + Kitchen filter (cascade + HITL).",
   "useEn": "Co ugotować: dopasowane do gustu, czasu PRACY vs całkowitego i tego co masz w lodowce.",
   "flow": "Zwiad → Ranking → Filtr (cascade)",
   "tokens": "~90-220K",
   "cost": "$0.20-0.55",
   "category": "strategy",
   "nodes": [
    {
     "d": "recipe_scout",
     "x": 400,
     "y": 60,
     "m": "sonnet"
    },
    {
     "d": "taste_recommender",
     "x": 400,
     "y": 210,
     "m": "sonnet"
    },
    {
     "d": "recipe_filter",
     "x": 400,
     "y": 360,
     "m": "haiku"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     1,
     2,
     "one"
    ],
    [
     2,
     1,
     "two"
    ]
   ]
  },
  "decision_research": {
   "id": "decision_research",
   "nameEn": "Decision Research",
   "count": 4,
   "descEn": "Reddit ethnographer + forums tracker (+ X hunter optional) + Decision advisor (+ HITL).",
   "useEn": "Wybór narzędzia/produktu/stosu technologicznego (stack) na bazie realnych opinii ludzi, nie marketingu.",
   "flow": "Fan-out → Synteza decyzyjna",
   "tokens": "~120-320K",
   "cost": "$0.30-0.80",
   "category": "strategy",
   "nodes": [
    {
     "d": "res_reddit",
     "x": 200,
     "y": 80,
     "m": "haiku"
    },
    {
     "d": "res_forums",
     "x": 400,
     "y": 80,
     "m": "sonnet"
    },
    {
     "d": "res_x",
     "x": 600,
     "y": 80,
     "m": "sonnet"
    },
    {
     "d": "decision_advisor",
     "x": 400,
     "y": 260,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     3,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     2,
     3,
     "one"
    ]
   ]
  },
  "deep_research_v2": {
   "id": "deep_research_v2",
   "nameEn": "Deep Research v2",
   "count": 17,
   "descEn": "7 researchers to 7 extractors (Haiku) to critic to lean synthesizer. Map-reduce.",
   "useEn": "Kampanie badawcze o dużym korpusie (30 tys. słów i więcej), gdy klasyczny Syntetyk grozi przeciążeniem API.",
   "flow": "Map-Reduce Research",
   "tokens": "~350-900K",
   "cost": "$1.80-4.50",
   "category": "research",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 10,
     "m": "opus"
    },
    {
     "d": "res_tech",
     "x": 60,
     "y": 110,
     "m": "sonnet"
    },
    {
     "d": "res_ux",
     "x": 180,
     "y": 110,
     "m": "sonnet"
    },
    {
     "d": "res_reddit",
     "x": 300,
     "y": 110,
     "m": "sonnet"
    },
    {
     "d": "res_x",
     "x": 420,
     "y": 110,
     "m": "sonnet"
    },
    {
     "d": "res_github",
     "x": 540,
     "y": 110,
     "m": "sonnet"
    },
    {
     "d": "res_forums",
     "x": 660,
     "y": 110,
     "m": "sonnet"
    },
    {
     "d": "res_docs",
     "x": 770,
     "y": 110,
     "m": "sonnet"
    },
    {
     "d": "res_extractor",
     "x": 60,
     "y": 220,
     "m": "haiku"
    },
    {
     "d": "res_extractor",
     "x": 180,
     "y": 220,
     "m": "haiku"
    },
    {
     "d": "res_extractor",
     "x": 300,
     "y": 220,
     "m": "haiku"
    },
    {
     "d": "res_extractor",
     "x": 420,
     "y": 220,
     "m": "haiku"
    },
    {
     "d": "res_extractor",
     "x": 540,
     "y": 220,
     "m": "haiku"
    },
    {
     "d": "res_extractor",
     "x": 660,
     "y": 220,
     "m": "haiku"
    },
    {
     "d": "res_extractor",
     "x": 770,
     "y": 220,
     "m": "haiku"
    },
    {
     "d": "res_critic",
     "x": 300,
     "y": 340,
     "m": "opus"
    },
    {
     "d": "synthesizer_lean",
     "x": 520,
     "y": 450,
     "m": "opus"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     0,
     3,
     "one"
    ],
    [
     0,
     4,
     "one"
    ],
    [
     0,
     5,
     "one"
    ],
    [
     0,
     6,
     "one"
    ],
    [
     0,
     7,
     "one"
    ],
    [
     1,
     8,
     "one"
    ],
    [
     2,
     9,
     "one"
    ],
    [
     3,
     10,
     "one"
    ],
    [
     4,
     11,
     "one"
    ],
    [
     5,
     12,
     "one"
    ],
    [
     6,
     13,
     "one"
    ],
    [
     7,
     14,
     "one"
    ],
    [
     1,
     15,
     "one"
    ],
    [
     2,
     15,
     "one"
    ],
    [
     3,
     15,
     "one"
    ],
    [
     4,
     15,
     "one"
    ],
    [
     5,
     15,
     "one"
    ],
    [
     6,
     15,
     "one"
    ],
    [
     7,
     15,
     "one"
    ],
    [
     8,
     16,
     "one"
    ],
    [
     9,
     16,
     "one"
    ],
    [
     10,
     16,
     "one"
    ],
    [
     11,
     16,
     "one"
    ],
    [
     12,
     16,
     "one"
    ],
    [
     13,
     16,
     "one"
    ],
    [
     14,
     16,
     "one"
    ],
    [
     15,
     16,
     "one"
    ],
    [
     16,
     0,
     "continuous"
    ]
   ]
  },
  "bento_redesign": {
   "id": "bento_redesign",
   "nameEn": "Bento Redesign",
   "count": 7,
   "descEn": "Data audit + grid math + visual build + density QA. Fill ratio 85-95%.",
   "useEn": "Przebudowa kokpitu w układzie bento: eliminacja pustki, spójność, hierarchia.",
   "flow": "Data Audit → Grid Math → Build",
   "tokens": "~240-590K",
   "cost": "$0.95-2.35",
   "category": "design",
   "nodes": [
    {
     "d": "orchestrator",
     "x": 400,
     "y": 10,
     "m": "opus"
    },
    {
     "d": "res_ux",
     "x": 260,
     "y": 120,
     "m": "haiku"
    },
    {
     "d": "res_github",
     "x": 540,
     "y": 120,
     "m": "haiku"
    },
    {
     "d": "analyst",
     "x": 260,
     "y": 230,
     "m": "sonnet"
    },
    {
     "d": "analyst",
     "x": 540,
     "y": 230,
     "m": "sonnet"
    },
    {
     "d": "designer",
     "x": 260,
     "y": 360,
     "m": "sonnet"
    },
    {
     "d": "frontend",
     "x": 540,
     "y": 360,
     "m": "sonnet"
    },
    {
     "d": "qa_quality",
     "x": 400,
     "y": 470,
     "m": "sonnet"
    }
   ],
   "edges": [
    [
     0,
     1,
     "one"
    ],
    [
     0,
     2,
     "one"
    ],
    [
     1,
     3,
     "one"
    ],
    [
     2,
     3,
     "one"
    ],
    [
     3,
     4,
     "one"
    ],
    [
     4,
     5,
     "one"
    ],
    [
     4,
     6,
     "one"
    ],
    [
     5,
     7,
     "one"
    ],
    [
     6,
     7,
     "one"
    ],
    [
     7,
     4,
     "two"
    ]
   ]
  }
 },
 "phases": [
  {
   "id": "strategy",
   "color": "#818CF8"
  },
  {
   "id": "research",
   "color": "#06B6D4"
  },
  {
   "id": "debate1",
   "color": "#A855F7"
  },
  {
   "id": "build",
   "color": "#60A5FA"
  },
  {
   "id": "debate2",
   "color": "#A855F7"
  },
  {
   "id": "qa",
   "color": "#F87171"
  },
  {
   "id": "hitl",
   "color": "#E879F9"
  }
 ],
 "presetCats": {
  "research": {
   "id": "research",
   "zh": "调研",
   "color": "#0E7490"
  },
  "build": {
   "id": "build",
   "zh": "构建",
   "color": "#4D7C0F"
  },
  "quality": {
   "id": "quality",
   "zh": "质量",
   "color": "#DC2626"
  },
  "content": {
   "id": "content",
   "zh": "内容",
   "color": "#A16207"
  },
  "strategy": {
   "id": "strategy",
   "zh": "战略",
   "color": "#4338CA"
  },
  "ops": {
   "id": "ops",
   "zh": "运维",
   "color": "#047857"
  },
  "data": {
   "id": "data",
   "zh": "数据",
   "color": "#7E22CE"
  },
  "design": {
   "id": "design",
   "zh": "设计",
   "color": "#BE185D"
  }
 },
 "agentCats": {
  "OPS": {
   "id": "OPS",
   "zh": "运维 / 基础设施",
   "color": "#34D399"
  },
  "QA / AUDYT": {
   "id": "QA / AUDYT",
   "zh": "QA / 审计",
   "color": "#F87171"
  },
  "PRODUKT": {
   "id": "PRODUKT",
   "zh": "产品",
   "color": "#FBBF24"
  },
  "STRATEGIA": {
   "id": "STRATEGIA",
   "zh": "战略",
   "color": "#818CF8"
  },
  "FIVE MINDS": {
   "id": "FIVE MINDS",
   "zh": "五心智",
   "color": "#F472B6"
  },
  "PLANOWANIE": {
   "id": "PLANOWANIE",
   "zh": "规划",
   "color": "#3B82F6"
  },
  "RESEARCH": {
   "id": "RESEARCH",
   "zh": "调研",
   "color": "#22D3EE"
  },
  "BUILD": {
   "id": "BUILD",
   "zh": "构建",
   "color": "#A3E635"
  },
  "COMPLIANCE": {
   "id": "COMPLIANCE",
   "zh": "合规",
   "color": "#FB923C"
  },
  "HITL": {
   "id": "HITL",
   "zh": "人在回路",
   "color": "#E2E8F0"
  },
  "DANE": {
   "id": "DANE",
   "zh": "数据",
   "color": "#C084FC"
  },
  "CUSTOM": {
   "id": "CUSTOM",
   "zh": "自定义",
   "color": "#A8A29E"
  }
 },
 "sizeGroups": [
  {
   "ids": [
    "solo",
    "quick_fix",
    "recon",
    "trio",
    "reflect",
    "voice",
    "kuchmistrz"
   ]
  },
  {
   "ids": [
    "bug_hunt",
    "content",
    "plan_exec",
    "perf_boost",
    "startup",
    "cascade",
    "test_suite",
    "a11y",
    "content_social",
    "kariera",
    "decision_research",
    "a11y_audit",
    "code_onboarding",
    "growth_campaign",
    "pitch_deck"
   ]
  },
  {
   "ids": [
    "security",
    "review",
    "design_sys",
    "api_modern",
    "ui_overhaul",
    "feature_sprint",
    "standard",
    "data_pipe",
    "ab_test_lab",
    "tech_writing_pipe",
    "perf_squad",
    "bento_redesign",
    "rag_app",
    "mlops",
    "devops_cicd",
    "k8s_deploy",
    "product_discovery",
    "docs_portal",
    "mobile_app",
    "obs_slo",
    "landing_page"
   ]
  },
  {
   "ids": [
    "research",
    "legacy",
    "saas",
    "microservices",
    "deep_research_swarm_pro",
    "migration_crew",
    "fullstack_premium",
    "security_multi_vector",
    "prd_to_launch",
    "kb_constructor",
    "soc2_sweep",
    "data_analysis_pipe",
    "incident_war_room"
   ]
  },
  {
   "ids": [
    "full",
    "five_minds",
    "deep",
    "deep_five_minds",
    "five_minds_strategic",
    "deep_research_v2"
   ]
  }
 ],
 "models": [
  {
   "k": "haiku",
   "label": "Haiku 4.5",
   "short": "Haiku",
   "ctx": 200000
  },
  {
   "k": "sonnet",
   "label": "Sonnet 5",
   "short": "Sonnet",
   "ctx": 1000000
  },
  {
   "k": "opus",
   "label": "Opus 5",
   "short": "Opus",
   "ctx": 1000000
  },
  {
   "k": "fable",
   "label": "Fable 5.1",
   "short": "Fable",
   "ctx": 1000000
  }
 ]
};
