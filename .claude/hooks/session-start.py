#!/usr/bin/env python3
import sys, json, os, uuid
from datetime import datetime, timezone

data = json.load(sys.stdin)
cwd = data.get("cwd", os.getcwd())
session_id = os.environ.get("CLAUDE_CODE_SESSION_ID", "")
if not session_id:
    sys.exit(0)

map_dir = os.path.join(cwd, "artifacts/sessions/.map")
map_file = os.path.join(map_dir, session_id)

if os.path.exists(map_file):
    sys.exit(0)

date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
started = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
session_uuid = str(uuid.uuid4())
rel_path = f"{date_str}/{session_uuid}"
session_dir = os.path.join(cwd, "artifacts/sessions", rel_path)

os.makedirs(session_dir, exist_ok=True)
os.makedirs(map_dir, exist_ok=True)

prompt = data.get("prompt", "").strip()
prompt = " ".join(prompt.split())
goal = (prompt[:197] + "...") if len(prompt) > 200 else prompt or "—"

template_path = os.path.join(cwd, ".claude/skills/auditing/templates/session.md")
if not os.path.exists(template_path):
    sys.exit(0)

content = open(template_path).read()
content = content.replace("{DATE}", date_str)
content = content.replace("{UUID}", session_uuid)
content = content.replace("{STARTED}", started)
content = content.replace("{GOAL}", goal)

open(os.path.join(session_dir, "session.md"), "w").write(content)
open(map_file, "w").write(rel_path)
