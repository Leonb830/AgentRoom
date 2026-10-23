#!/usr/bin/env python3
"""Create local configuration without exposing generated secrets or overwriting it."""
from pathlib import Path
import secrets
import os

root = Path(__file__).resolve().parents[1]
destination = root / ".env"
content = (root / ".env.example").read_text()
password = secrets.token_hex(24)
content = content.replace("change-me", password)
content = content.replace("AUTH_SECRET=\n", "AUTH_SECRET=" + secrets.token_hex(32) + "\n")
content = content.replace("EXECUTION_TOKEN=\n", "EXECUTION_TOKEN=" + secrets.token_hex(32) + "\n")
try:
    fd = os.open(destination, os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
except FileExistsError:
    raise SystemExit(".env already exists; preserved without changes")
with os.fdopen(fd, "w") as file:
    file.write(content)
print("Created protected .env. Owner OAuth and Core settings remain required; see docs/SETUP.md.")
