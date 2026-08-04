#!/usr/bin/env python3
"""Run the proven Preview promotion engine for the next production release."""

from pathlib import Path
import sys

BASE_SCRIPT = Path(__file__).with_name("promote-preview-to-production.py")
source = BASE_SCRIPT.read_text(encoding="utf-8")

required_replacements = (
    ('VERSION = "2.3.0"', 'VERSION = "2.3.1"'),
    ('VERSION_CODE = 58', 'VERSION_CODE = 59'),
    ('content = read(path).replace("2.2.1", VERSION)', 'content = re.sub(r"\\b2\\.3\\.0\\b", VERSION, read(path))'),
    ('r"(?<!\\d)57(?!\\d)"', 'r"(?<!\\d)58(?!\\d)"'),
)
for old, new in required_replacements:
    if old not in source:
        raise SystemExit(f"[latest-preview-promotion] required base marker missing: {old}")
    source = source.replace(old, new)

source = source.replace("Amy FX 2.3.0", "Amy FX 2.3.1")
source = source.replace("runtime v5", "runtime v6")
source = source.replace("version: '5.0.0'", "version: '6.0.0'")

sys.argv[0] = str(BASE_SCRIPT)
namespace = {
    "__name__": "__main__",
    "__file__": str(BASE_SCRIPT),
    "__package__": None,
}
exec(compile(source, str(BASE_SCRIPT), "exec"), namespace)
