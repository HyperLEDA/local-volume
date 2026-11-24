import { describe, expect, test } from "bun:test";
import { fetchObjects } from "../src/api/objects.ts";

const originalFetch = globalThis.fetch;

function payload(pgc = 42) {
  return {
    data: {
      pgc: [pgc],
      name: ["NGC 42"],
      ra: [12.5],
      dec: [-4.2],
      abs_b_mag: [-17.2],
      names: [["PGC 42", "LEDA 42"]],
    },
  };
}

describe("catalog in-flight request deduplication", () => {
  test("overlapping callers share one HTTP fetch but receive independent records", async () => {
    function uninitializedGate(): never {
      throw new Error("Response gate was not initialized");
    }
    let release: (response: Response) => void = uninitializedGate;
    const pending = new Promise<Response>((resolve) => {
      release = resolve;
    });
    const urls: string[] = [];
    globalThis.fetch = (input) => {
      urls.push(String(input));
      return pending;
    };
    try {
      const first = fetchObjects();
      const second = fetchObjects();
      expect(urls).toEqual(["/api/v1/objects"]);
      release(Response.json(payload()));
      const [a, b] = await Promise.all([first, second]);
      expect(a).toEqual(b);
      expect(a).not.toBe(b);
      expect(a[0]).not.toBe(b[0]);
      expect(a[0].names).not.toBe(b[0].names);
      a[0].names.push("CHANGED");
      expect(b[0].names).toEqual(["PGC 42", "LEDA 42"]);
      expect(a[0].dist).toBeNull();
      expect(a[0].abs_b_mag).toBe(-17.2);
    } finally {
      release(Response.json(payload()));
      globalThis.fetch = originalFetch;
    }
  });

  test("completed requests never cache stale catalogue responses", async () => {
    let calls = 0;
    globalThis.fetch = () => {
      calls += 1;
      return Promise.resolve(Response.json(payload(calls)));
    };
    try {
      const first = await fetchObjects();
      const second = await fetchObjects();
      expect(calls).toBe(2);
      expect(first[0].pgc).toBe(1);
      expect(second[0].pgc).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("HTTP failures propagate to all callers and allow retries", async () => {
    let calls = 0;
    globalThis.fetch = () => {
      calls += 1;
      return Promise.resolve(
        calls === 1
          ? new Response(null, { status: 503 })
          : Response.json(payload()),
      );
    };
    try {
      const first = fetchObjects();
      const second = fetchObjects();
      const failures = await Promise.allSettled([first, second]);
      expect(calls).toBe(1);
      for (const failure of failures) {
        expect(failure.status).toBe("rejected");
        if (failure.status === "rejected") {
          expect(String(failure.reason)).toContain(
            "Failed to load objects (503)",
          );
        }
      }
      expect((await fetchObjects())[0].pgc).toBe(42);
      expect(calls).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  test("JSON parse failures do not poison the next request", async () => {
    let calls = 0;
    globalThis.fetch = () => {
      calls += 1;
      return Promise.resolve(
        calls === 1
          ? new Response("{invalid", { status: 200 })
          : Response.json(payload()),
      );
    };
    try {
      await expect(fetchObjects()).rejects.toThrow();
      expect((await fetchObjects())[0].pgc).toBe(42);
      expect(calls).toBe(2);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
