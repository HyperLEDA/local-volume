import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]


def test_check_schema_target_is_lint_only() -> None:
    makefile = (ROOT / "makefile").read_text(encoding="utf-8")
    match = re.search(r"(?m)^check-schema:\n((?:\t[^\n]*\n)+)", makefile)
    assert match is not None
    commands = [line.strip() for line in match.group(1).splitlines()]
    assert len(commands) == 1
    assert re.fullmatch(r"bunx schemalint@\d+\.\d+\.\d+", commands[0])
