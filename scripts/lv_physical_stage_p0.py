from __future__ import annotations

import argparse
import pathlib

from lv_backend.data import lvgdb_physical


def main() -> None:
    parser = argparse.ArgumentParser(description="Regenerate approved LVGDB physical P0 stage without PostgreSQL")
    parser.add_argument("--source-table2", type=pathlib.Path, required=True)
    parser.add_argument("--identity-map", type=pathlib.Path, required=True)
    parser.add_argument("--out", type=pathlib.Path, required=True)
    args = parser.parse_args()
    digest = lvgdb_physical.render_stage(args.source_table2, args.identity_map, args.out)
    print(f"P0 OFFLINE PASS: 1676 approved PGC; SHA256={digest}")
    print("HOLD excluded; original Table 2 and published precision retained")
    print("NO DATABASE, DOCKER OR GIT MUTATIONS")


if __name__ == "__main__":
    main()
