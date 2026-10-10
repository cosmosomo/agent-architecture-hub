---
hub: "1.0"
kind: relations
case: incident_war_room
---

@diag_infra >read @infra_logs
@diag_infra >watch @status_board
@diag_app >read @app_logs
@diag_app >read @error_traces
@diag_app >watch @status_board
@diag_db >read @db_metrics
@diag_db >read @db_logs
@diag_db >watch @status_board
@comms >watch @timeline
@comms >watch @status_board
@fix_eng >read @diag_summary
@fix_eng >read @runbook
@fix_eng >watch @status_board
@validator >watch @metrics_dashboard
@validator >watch @status_board
@postmortem >read @timeline
@postmortem >read @diag_summary
@postmortem >read @runbook
@ic >watch @status_board
@ic >watch @timeline
