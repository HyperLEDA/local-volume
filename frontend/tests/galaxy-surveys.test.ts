import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { GALAXY_SURVEYS, galaxySurvey, isGalaxySurveyKey } from "../src/lib/galaxySurveys.ts";
import { createGalaxySurveySwitcher } from "../src/lib/galaxySurveySwitcher.ts";

describe("scientific sky-survey choices", () => {
  test("uses four named, immutable optical/UV/IR HiPS identifiers", () => {
    expect(GALAXY_SURVEYS.map((survey) => survey.key)).toEqual([
      "dss2", "galex", "2mass", "allwise",
    ]);
    expect(galaxySurvey("galex").hips).toBe("P/GALEXGR6/AIS/color");
    expect(galaxySurvey("allwise").hips).toBe("P/allWISE/color");
    expect(isGalaxySurveyKey("unknown")).toBe(false);
    expect(isGalaxySurveyKey("2mass")).toBe(true);
  });

  test("serializes rapid choices and applies the latest one without remounting", async () => {
    const applied: string[] = [];
    const completed: (() => void)[] = [];
    const reports: (string | null)[] = [];
    const switcher = createGalaxySurveySwitcher(
      "dss2",
      (id) => {
        applied.push(id);
        return new Promise<void>((resolve) => { completed.push(resolve); });
      },
      (error) => reports.push(error),
    );
    switcher.request("galex");
    switcher.request("2mass");
    switcher.request("allwise");
    expect(applied).toEqual(["galex"]);
    completed[0]();
    await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
    expect(applied).toEqual(["galex", "allwise"]);
    completed[1]();
    await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
    expect(reports).toEqual([null]);
    switcher.dispose();
  });

  test("ignores stale completion or failure after dispose", async () => {
    function uninitializedReject(): never {
      throw new Error("Promise reject callback was not initialized");
    }
    let reject: (reason: Error) => void = uninitializedReject;
    const reports: (string | null)[] = [];
    const switcher = createGalaxySurveySwitcher(
      "dss2",
      () => new Promise<void>((_, fail) => { reject = fail; }),
      (message) => reports.push(message),
    );
    switcher.request("galex");
    switcher.dispose();
    reject(new Error("network"));
    await new Promise<void>((resolve) => { setTimeout(resolve, 0); });
    expect(reports).toEqual([]);
  });
});


describe("galaxy sky-survey controls", () => {
  test("uses accessible mutually exclusive buttons, not a select menu", () => {
    const page = readFileSync(
      new URL("../src/pages/ObjectPage.tsx", import.meta.url), "utf8",
    );
    const controls = readFileSync(
      new URL("../src/components/galaxySurveyControls.css", import.meta.url), "utf8",
    );
    expect(page).toContain('className="galaxy-survey-choices"');
    expect(page).toContain('role="group"');
    expect(page).toContain('aria-pressed={surveyKey === item.key}');
    expect(page).toContain('aria-label={item.label}');
    expect(page).toContain('setSurveyKey(item.key)');
    expect(page).not.toContain('id="galaxy-survey-select"');
    expect(page).not.toContain('Survey coverage varies by position.');
    expect(controls).toContain('.galaxy-survey-choices button[aria-pressed="true"]');
    expect(controls).toContain(':focus-visible');
  });
});
