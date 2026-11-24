"""Stage 05b HOLD records only; no independent distance or error approvals."""

from typing import Literal

Record = tuple[int, Literal["value", "interval"], str, Literal["VERIFIED", "HOLD"], str, str, str, str, str]

RECORDS: tuple[Record, ...] = (
    (
        27104,
        "interval",
        "2edcf01a5e71d346ff3b6c2ccf2eba41072d0028651e89a54d1592b0552e3962",
        "HOLD",
        "2023Ap.....66....1K",
        "https://arxiv.org/abs/2303.05787 (Table 1; sections 2–3)",
        "Stage 05b catalogue audit (AI-assisted; not source approval)",
        "2026-11-24",
        "e_mu is consistent with 0.05 * mu; published typical 5% concerns D. "
        "Confirm source ingestion and individual errors.",
    ),
    (
        31923,
        "interval",
        "7bfac1707c56d23726050af65f3bd0bb858d0e6c3be4da1e183004e89fa44ffd",
        "HOLD",
        "2023Ap.....66....1K",
        "https://arxiv.org/abs/2303.05787 (Table 1; sections 2–3)",
        "Stage 05b catalogue audit (AI-assisted; not source approval)",
        "2026-11-24",
        "e_mu is consistent with 0.05 * mu; published typical 5% concerns D. "
        "Confirm source ingestion and individual errors.",
    ),
    (
        32413,
        "interval",
        "159d04b6df1e75fa909a9eb030e35a807a6088c05eca6f0ea7a2e92c71f2b59d",
        "HOLD",
        "2023Ap.....66....1K",
        "https://arxiv.org/abs/2303.05787 (Table 1; sections 2–3)",
        "Stage 05b catalogue audit (AI-assisted; not source approval)",
        "2026-11-24",
        "e_mu is consistent with 0.05 * mu; published typical 5% concerns D. "
        "Confirm source ingestion and individual errors.",
    ),
    (
        42413,
        "interval",
        "3ec677db20161a5d0fa9b09254c2b985aed5258bf86d49590c0d72576fce34aa",
        "HOLD",
        "2023Ap.....66....1K",
        "https://arxiv.org/abs/2303.05787 (Table 1; sections 2–3)",
        "Stage 05b catalogue audit (AI-assisted; not source approval)",
        "2026-11-24",
        "e_mu is consistent with 0.05 * mu; published typical 5% concerns D. "
        "Confirm source ingestion and individual errors.",
    ),
    (
        52358,
        "interval",
        "5c4c3c86b2668bced5e2dc9fb6b0ca927e49ccabe56b1501e255d74fdc9bd961",
        "HOLD",
        "2023Ap.....66....1K",
        "https://arxiv.org/abs/2303.05787 (Table 1; sections 2–3)",
        "Stage 05b catalogue audit (AI-assisted; not source approval)",
        "2026-11-24",
        "e_mu is consistent with 0.05 * mu; published typical 5% concerns D. "
        "Confirm source ingestion and individual errors.",
    ),
    (
        62453,
        "interval",
        "92ee869ebe0cd84b8438254ee4ab6cd24ec37ee18318c549b46fd089782190d9",
        "HOLD",
        "2023Ap.....66....1K",
        "https://arxiv.org/abs/2303.05787 (Table 1; sections 2–3)",
        "Stage 05b catalogue audit (AI-assisted; not source approval)",
        "2026-11-24",
        "e_mu is consistent with 0.05 * mu; published typical 5% concerns D. "
        "Confirm source ingestion and individual errors.",
    ),
    (
        71368,
        "interval",
        "b487b6546012676c220431bd3e2a2578a94fd26870769e39437bc75a91e43ffd",
        "HOLD",
        "2023Ap.....66....1K",
        "https://arxiv.org/abs/2303.05787 (Table 1; sections 2–3)",
        "Stage 05b catalogue audit (AI-assisted; not source approval)",
        "2026-11-24",
        "e_mu is consistent with 0.05 * mu; published typical 5% concerns D. "
        "Confirm source ingestion and individual errors.",
    ),
    (
        71866,
        "interval",
        "8d488c20b58cb8fc872494778e4b5b6fb926e3bd982d6ae97400d6055526fd7f",
        "HOLD",
        "2023Ap.....66....1K",
        "https://arxiv.org/abs/2303.05787 (Table 1; sections 2–3)",
        "Stage 05b catalogue audit (AI-assisted; not source approval)",
        "2026-11-24",
        "e_mu is consistent with 0.05 * mu; published typical 5% concerns D. "
        "Confirm source ingestion and individual errors.",
    ),
    (
        2807141,
        "interval",
        "688746e59b1235346300fc1b874d49c76c0e8f2d0d9c96ed27a6d8da1ca75c96",
        "HOLD",
        "2023Ap.....66....1K",
        "https://arxiv.org/abs/2303.05787 (Table 1; sections 2–3)",
        "Stage 05b catalogue audit (AI-assisted; not source approval)",
        "2026-11-24",
        "e_mu is consistent with 0.05 * mu; published typical 5% concerns D. "
        "Confirm source ingestion and individual errors.",
    ),
    (
        2815824,
        "interval",
        "59ff7cbb323ef8b56f92d37e31bf4add63d321a3a60a3a40ee5112547e6f4ef1",
        "HOLD",
        "2023Ap.....66....1K",
        "https://arxiv.org/abs/2303.05787 (Table 1; sections 2–3)",
        "Stage 05b catalogue audit (AI-assisted; not source approval)",
        "2026-11-24",
        "e_mu is consistent with 0.05 * mu; published typical 5% concerns D. "
        "Confirm source ingestion and individual errors.",
    ),
)
