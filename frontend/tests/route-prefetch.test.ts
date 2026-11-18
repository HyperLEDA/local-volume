import { describe, expect, test } from "bun:test";
import { createCachedPageLoader, preloadPage } from "../src/pageLoaders.ts";

describe("route module prefetching", () => {
  test("does not start loading until requested", async () => {
    let calls = 0;
    const load = createCachedPageLoader(() => {
      calls++;
      return Promise.resolve({ default: "page" });
    });
    expect(calls).toBe(0);
    expect(await load()).toEqual({ default: "page" });
    expect(calls).toBe(1);
  });

  test("prefetch and navigation share the same in-flight request", async () => {
    let calls = 0;
    function unresolvedImport(): never {
      throw new Error("Deferred resolver was not initialized");
    }
    let resolveImport: (value: { default: string }) => void = unresolvedImport;
    const load = createCachedPageLoader(() => {
      calls++;
      return new Promise<{ default: string }>((resolve) => {
        resolveImport = resolve;
      });
    });
    const hint = preloadPage(load);
    const navigation = load();
    expect(calls).toBe(1);
    expect(navigation).toBe(load());
    resolveImport({ default: "groups" });
    await hint;
    expect(await navigation).toEqual({ default: "groups" });
    expect(await load()).toEqual({ default: "groups" });
    expect(calls).toBe(1);
  });

  test("failed prefetch is ignored and the loader can retry", async () => {
    let calls = 0;
    const load = createCachedPageLoader(() => {
      calls++;
      if (calls === 1) {
        return Promise.reject(new Error("temporary network failure"));
      }
      return Promise.resolve({ default: "publications" });
    });
    await expect(preloadPage(load)).resolves.toBeUndefined();
    expect(await load()).toEqual({ default: "publications" });
    expect(calls).toBe(2);
  });

  test("failed direct load rejects normally and can be retried", async () => {
    let calls = 0;
    const load = createCachedPageLoader(() => {
      calls++;
      if (calls === 1) {
        return Promise.reject(new Error("failed"));
      }
      return Promise.resolve("ready");
    });
    await expect(load()).rejects.toThrow("failed");
    expect(await load()).toBe("ready");
  });
});
