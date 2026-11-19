import pytest

from lv_backend.preview_worker import batch_selection, cache_counts, capture_target


def test_only_same_origin_preview_uploads_are_accepted():
    url = "http://lv:8000/api/v1/group-preview/123?definition=physical&variant=portrait"
    assert capture_target(url, "http://lv:8000") == (123, "physical", "portrait")
    with pytest.raises(ValueError):
        capture_target(url, "http://other:8000")
    with pytest.raises(ValueError):
        capture_target(
            "http://lv:8000/api/v1/group-preview/abc?definition=physical&variant=portrait",
            "http://lv:8000",
        )
    with pytest.raises(ValueError):
        capture_target(url + "&admin=true", "http://lv:8000")
    with pytest.raises(ValueError):
        capture_target(
            "http://lv:8000/api/v1/group-preview/123?definition=published&variant=portrait",
            "http://lv:8000",
        )


def test_cache_counts_handle_lmc_hierarchy_policy():
    groups = [{"root_pgc": 17223}, {"root_pgc": 44}]
    entries = [{"root_pgc": 17223, "variant": "portrait", "current": True}]
    assert cache_counts(groups, entries, "both") == (2, 3, 2)
    assert cache_counts(groups, entries, "hierarchy") == (2, 1, 1)
    assert cache_counts(groups, entries, "portrait") == (2, 2, 1)


def test_batch_selection_uses_live_group_count_for_all():
    assert batch_selection("1", 57) == ("value", "1")
    assert batch_selection("24", 57) == ("value", "24")
    assert batch_selection("96", 57) == ("value", "96")
    assert batch_selection("all", 57) == ("label", "All 57 groups")
    assert batch_selection("all", 66) == ("label", "All 66 groups")
    with pytest.raises(ValueError):
        batch_selection("other", 57)
    with pytest.raises(ValueError):
        batch_selection("all", -1)
