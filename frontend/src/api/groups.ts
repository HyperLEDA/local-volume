export type GroupDefinition = "physical" | "suite" | "published";
export type GroupPreviewVariant = "hierarchy" | "portrait";

export type GroupSummary = {
  group_id: number;
  root_pgc: number;
  name: string;
  definition: GroupDefinition;
  data_status: "computed" | "pilot" | "validated";
  source_catalog: string;
  source_version: string;
  source_sha256: string | null;
  root_ra: number | null;
  root_dec: number | null;
  distance_mpc: number | null;
  extent_kpc: number | null;
  member_count: number;
  subgroup_count: number;
  unconfirmed_count: number | null;
};

export type DistanceReviewStatus =
  "NOT_REVIEWED" | "VERIFIED" | "HOLD" | "STALE" | "BLOCKED" | "UNAVAILABLE";

export type GroupMember = {
  group_id: number;
  pgc: number;
  parent_md_pgc: number | null;
  hierarchy_depth: number;
  membership_status: "root" | "computed" | "supported" | "unconfirmed";
  source_status: string;
  theta1_source: number | null;
  name: string;
  ra: number | null;
  dec: number | null;
  dist_mpc: number | null;
  morphology_t: number | null;
  b_mag: number | null;
  lvg_v_lg_kms: number | null;
  distance_method?: string | null;
  distance_reference?: string | null;
  distance_source_catalog?: string | null;
  distance_source_name?: string | null;
  distance_value_source?: "lv.physical" | "lv.observed" | null;
  distance_method_for_value?: string | null;
  modulus_method?: string | null;
  observed_mu?: number | string | null;
  observed_e_mu?: number | string | null;
  observed_distance_mpc?: number | null;
  derived_distance_mpc?: number | null;
  derived_distance_method?: string | null;
  distance_computed_revision?: number | null;
  distance_formula_version?: string | null;
  distance_adoption_basis?: string | null;
  distance_reference_for_value?: string | null;
  distance_lineage_status?: "HOLD" | "NON_INDEPENDENT" | "REVIEW_READY";
  distance_lineage_reason?: string;
  distance_interval_traceable?: boolean;
  distance_value_fingerprint?: string | null;
  distance_interval_fingerprint?: string | null;
  distance_value_review_status?: DistanceReviewStatus;
  distance_interval_review_status?: DistanceReviewStatus;
  distance_value_evidence_locator?: string | null;
  distance_interval_evidence_locator?: string | null;
  distance_interval_verified?: boolean;
  distance_origin?:
    "DIRECT_MEASURED" | "GROUP_ASSIGNED" | "MODEL_INFERRED" | "UNKNOWN";
  distance_provenance_verified?: boolean;
  distance_3d_eligible?: boolean;
  abs_b_mag?: number | null;
  log_mhi_msun?: number | null;
  log_m26_msun?: number | null;
  log_lks_lsun?: number | null;
  e_distance_minus_mpc?: number | null;
  e_distance_plus_mpc?: number | null;
  e_v_lg_kms?: number | null;
  velocity_error_basis?: string | null;
  distance_error_basis?: string | null;
  log_mstar_msun?: number | null;
  hi_mass_is_upper_limit?: boolean | null;
  theta1_computed: number | null;
  md_pgc_computed: number | null;
  environment_coverage: string | null;
};

export type GroupDetail = GroupSummary & {
  source_description: string | null;
  tidal_min: number | null;
  tidal_max: number | null;
  members: GroupMember[];
  distance_contract?: string;
  radius_measurements?: unknown[];
  scene_center?: {
    center_type: "root_md";
    center_pgc: number;
    ra: number;
    dec: number;
    distance_mpc: number | null;
    distance_origin: string;
    distance_method_for_value?: string | null;
    distance_reference_for_value?: string | null;
    distance_lineage_status?: "HOLD" | "NON_INDEPENDENT" | "REVIEW_READY";
    distance_lineage_reason?: string;
    distance_provenance_verified: boolean;
    physical_3d_eligible: boolean;
    distance_interval_verified?: boolean;
    distance_value_review_status?: DistanceReviewStatus;
    distance_interval_review_status?: DistanceReviewStatus;
  } | null;
};

export async function fetchGroups(
  definition: GroupDefinition,
): Promise<GroupSummary[]> {
  const response = await fetch(`/api/v1/groups?definition=${definition}`);
  if (!response.ok)
    throw new Error(`Failed to load groups (${response.status})`);
  const payload = (await response.json()) as { data: GroupSummary[] };
  return payload.data;
}

export async function fetchGroup(
  pgc: number,
  definition: GroupDefinition = "physical",
  groupId?: number,
): Promise<GroupDetail> {
  const groupIdQuery =
    definition === "published" && groupId !== undefined
      ? `&group_id=${groupId}`
      : "";
  const response = await fetch(
    `/api/v1/group/${pgc}?definition=${definition}${groupIdQuery}`,
  );
  if (!response.ok)
    throw new Error(`Failed to load group (${response.status})`);
  const payload = (await response.json()) as { data: GroupDetail };
  return payload.data;
}

export type GroupMembership = {
  group_id: number;
  root_pgc: number;
  name: string;
  definition: GroupDefinition;
  data_status: "computed" | "pilot" | "validated";
  source_catalog: string;
  source_version: string;
  source_sha256: string | null;
  source_description: string | null;
  member_pgc: number;
  parent_md_pgc: number | null;
  membership_status: "root" | "computed" | "supported" | "unconfirmed";
  source_status: string;
  hierarchy_depth: number;
};

export function groupMembershipUrl(member: GroupMembership): string {
  if (
    !Number.isSafeInteger(member.member_pgc) ||
    member.member_pgc <= 0 ||
    !Number.isSafeInteger(member.root_pgc) ||
    member.root_pgc <= 0 ||
    !["physical", "suite", "published"].includes(member.definition)
  ) {
    throw new Error("Invalid group membership selector");
  }
  if (member.definition === "published") {
    if (!Number.isSafeInteger(member.group_id) || member.group_id <= 0)
      throw new Error("Invalid published group identifier");
    return `/groups/${member.root_pgc}?definition=published&group_id=${member.group_id}`;
  }
  if (member.group_id !== -member.root_pgc)
    throw new Error("Inconsistent computed group identifier");
  return `/groups/${member.root_pgc}?definition=${member.definition}`;
}

export async function fetchGroupMemberships(
  memberPgc: number,
): Promise<GroupMembership[]> {
  if (!Number.isSafeInteger(memberPgc) || memberPgc <= 0)
    throw new Error("Invalid member PGC");
  const response = await fetch(`/api/v1/group-memberships/${memberPgc}`);
  if (!response.ok)
    throw new Error(`Group membership unavailable (${response.status})`);
  const payload = (await response.json()) as { data: GroupMembership[] };
  return payload.data;
}

export function previewUrl(
  pgc: number,
  definition: GroupDefinition,
  variant: GroupPreviewVariant = "hierarchy",
): string {
  return `/api/v1/group-preview/${pgc}?definition=${definition}&variant=${variant}`;
}

export async function previewExists(
  pgc: number,
  definition: GroupDefinition,
  variant: GroupPreviewVariant = "hierarchy",
): Promise<boolean> {
  const result = await fetch(previewUrl(pgc, definition, variant), {
    method: "HEAD",
    cache: "no-store",
  });
  if (result.status === 404) return false;
  if (!result.ok) throw new Error(`Cannot check preview (${result.status})`);
  return true;
}

export async function currentPhysicalRevision(): Promise<number> {
  const response = await fetch("/api/v1/physical/refresh-status", {
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error(`Physical revision unavailable (${response.status})`);
  const payload = (await response.json()) as {
    data: { source_revision: number; applied_revision: number };
  };
  if (
    payload.data.source_revision !== payload.data.applied_revision ||
    !Number.isSafeInteger(payload.data.applied_revision)
  ) {
    throw new Error("Physical catalogue is not refreshed");
  }
  return payload.data.applied_revision;
}

export async function uploadPreview(
  pgc: number,
  definition: GroupDefinition,
  blob: Blob,
  revision: number,
  variant: GroupPreviewVariant = "hierarchy",
): Promise<void> {
  if (blob.type !== "image/webp")
    throw new Error("Only WebP previews may be stored");
  const result = await fetch(previewUrl(pgc, definition, variant), {
    method: "PUT",
    headers: {
      "Content-Type": "image/webp",
      "X-LV-Physical-Revision": String(revision),
    },
    body: blob,
  });
  if (!result.ok)
    throw new Error(
      `Preview storage failed (${result.status}): ${await result.text()}`,
    );
}

/** The cache report contains metadata only. No WebP bytes are read into the UI. */
export type GroupPreviewCacheManifest = {
  revision: number;
  write_enabled: boolean;
  entries: {
    root_pgc: number;
    variant: GroupPreviewVariant;
    current: boolean;
    bytes: number;
  }[];
};

export async function fetchPreviewCacheManifest(
  definition: GroupDefinition,
): Promise<GroupPreviewCacheManifest> {
  const response = await fetch(
    `/api/v1/group-preview-cache?definition=${definition}`,
    { cache: "no-store" },
  );
  if (!response.ok) {
    throw new Error(
      `Preview cache status unavailable (${response.status}): ${await response.text()}`,
    );
  }
  const payload = (await response.json()) as {
    data: GroupPreviewCacheManifest;
  };
  return payload.data;
}
