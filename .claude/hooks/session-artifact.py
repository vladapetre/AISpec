#!/usr/bin/env python3
import sys, json, os
from datetime import datetime, timezone

data = json.load(sys.stdin)
if data.get("tool_name") not in ("Write", "Edit"):
    sys.exit(0)

file_path = data.get("tool_input", {}).get("file_path", "")
cwd = data.get("cwd", os.getcwd())
rel = os.path.relpath(file_path, cwd)

if not rel.startswith("artifacts/") or rel.startswith("artifacts/sessions/"):
    sys.exit(0)

session_id = os.environ.get("CLAUDE_CODE_SESSION_ID", "")
if not session_id:
    sys.exit(0)

map_file = os.path.join(cwd, "artifacts/sessions/.map", session_id)
if not os.path.exists(map_file):
    sys.exit(0)

rel_path = open(map_file).read().strip()
session_file = os.path.join(cwd, "artifacts/sessions", rel_path, "session.md")
if not os.path.exists(session_file):
    sys.exit(0)

timestamp = datetime.now(timezone.utc).strftime("%H:%MZ")
entry = f"- {timestamp} — artifact: {rel}"
content = open(session_file).read()
content = content.replace("<!-- end-checkpoints -->", f"{entry}\n<!-- end-checkpoints -->")
open(session_file, "w").write(content)
