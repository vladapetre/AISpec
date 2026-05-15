#!/usr/bin/env python3
import sys, json, os, re
from datetime import datetime, timezone

data = json.load(sys.stdin)
cwd = data.get("cwd", os.getcwd())
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

timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
content = open(session_file).read()
content = re.sub(r"^Last active:.*", f"Last active: {timestamp}", content, flags=re.MULTILINE)
open(session_file, "w").write(content)
