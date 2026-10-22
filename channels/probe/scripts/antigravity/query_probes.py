import sqlite3

conn = sqlite3.connect(r'C:\Users\COLORFIRE\.gemini\antigravity\conversation_summaries.db')
c = conn.cursor()
rows = c.execute("SELECT conversation_id, title, preview, status, not_fully_idle FROM conversation_summaries WHERE title LIKE 'probe-%' ORDER BY last_modified_time DESC LIMIT 10").fetchall()
with open('channels/probe/scripts/antigravity/probes_out.txt', 'w', encoding='utf-8') as out:
    for r in rows:
        out.write(f"ID: {r[0]} | Title: {r[1]} | Status: {r[3]} | Idle: {r[4]}\n")
        out.write(f"Preview: {r[2]}\n")
        out.write("-" * 50 + "\n")
