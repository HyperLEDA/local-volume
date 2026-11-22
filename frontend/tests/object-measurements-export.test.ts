import { describe, expect, test } from "bun:test";
import {
  buildGalaxyExport,
  galaxyExportCsv,
  galaxyExportJson,
} from "../src/lib/objectMeasurementsExport.ts";
import type { CatalogObjectDetail, ParameterRow } from "../src/api/objects.ts";

const galaxy = {
  pgc: 2557,
  name: 'M 31, "Andromeda"',
  names: [],
  dist: 0.77,
  e_dist: null,
  ks_mag: null,
  ks_estimated: true,
  fuv_mag: 9.8,
  fuv_limit: ">",
  lvg_v_hel_kms: -296,
  lvg_e_v_hel_kms: 15,
} as CatalogObjectDetail;
const rows: ParameterRow[] = [
  { name: "dist", nice: "D", description: "Distance", unit: "Mpc", value: "0.77", error: null, errorUnit: null },
  { name: "ks_mag", nice: "Ks", description: "Estimated magnitude", unit: "mag", value: "1.00", error: null, errorUnit: null },
  { name: "fuv_mag", nice: "FUV", description: "FUV magnitude", unit: "mag", value: "9.8", error: null, errorUnit: null },
  { name: "lvg_v_hel_kms", nice: "Vh", description: "Velocity", unit: "km/s", value: "-296", error: "15", errorUnit: null },
];

describe("#66 object measurements export", () => {
  test("preserves raw nulls, estimated Ks, genuine velocity errors and FUV limits", () => {
    const doc = buildGalaxyExport(galaxy, rows, { physical_status: "ready", log_mhi_msun: 5.4, log_mhi_limit_flag: "<", theta1: 0 });
    const ks = doc.measurements.find((m) => m.field === "ks_mag")!;
    expect(ks.raw_value).toBeNull();
    expect(ks.display_value).toBe("1.00");
    expect(ks.raw_missing).toBe(true);
    expect(ks.status).toBe("estimated");
    expect(doc.measurements.find((m) => m.field === "fuv_mag")?.qualifier).toBe(">");
    expect(doc.measurements.find((m) => m.field === "lvg_v_hel_kms")?.raw_uncertainty).toBe(15);
    expect(doc.measurements.find((m) => m.field === "log_mhi_msun")?.qualifier).toBe("<");
    expect(doc.measurements.find((m) => m.field === "theta1")?.raw_missing).toBe(false);
    expect(doc.measurements.map((m) => m.measurement_source)).toEqual(
      Array(doc.measurements.length).fill(null),
    );
  });
  test("retains unavailable physical measurements as null, never invented zeros", () => {
    const doc = buildGalaxyExport(galaxy, rows, { physical_status: "pending", theta1: 10 });
    expect(doc.physical_status).toBe("pending");
    expect(doc.measurements.find((m) => m.field === "theta1")?.raw_value).toBeNull();
    expect(doc.measurements.find((m) => m.field === "theta1")?.raw_missing).toBe(true);
  });
  test("CSV handles quotes, commas and CRLF; JSON preserves nulls", () => {
    const doc = buildGalaxyExport(galaxy, rows, null);
    const csv = galaxyExportCsv(doc);
    expect(csv).toContain('"M 31, ""Andromeda"""');
    expect(csv).toContain("\r\n");
    expect(JSON.parse(galaxyExportJson(doc)).measurements[1].raw_value).toBeNull();
  });
});
