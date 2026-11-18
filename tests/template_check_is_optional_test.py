from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def test_optional_copier_check_does_not_affect_required_checks() -> None:
    makefile = (ROOT / "makefile").read_text(encoding="utf-8")
    checks = makefile.split("\ncheck:\n", 1)[1].split("\ntest-js:\n", 1)[0]
    assert "copier" not in checks
    template_check = makefile.split("\ncheck-template:\n", 1)[1].split("\ncheck:\n", 1)[0]
    assert "command -v copier" in template_check
    assert "copier check-update --answers-file .template.yaml" in template_check
    assert "|| true" not in template_check
