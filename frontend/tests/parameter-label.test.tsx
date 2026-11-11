import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import { ParameterLabel } from "../src/components/ParameterLabel.tsx";

function rendered(nice: string | null | undefined, fallback = "bt") {
  return renderToStaticMarkup(
    <ParameterLabel nice={nice} fallback={fallback} />,
  );
}

describe("ParameterLabel", () => {
  test("renders subscripts from metadata", () => {
    expect(rendered("B<sub>T</sub>")).toBe("B<sub>T</sub>");
    expect(rendered("V<sub>LG</sub>")).toBe("V<sub>LG</sub>");
    expect(rendered("a<sub>50</sub>")).toBe("a<sub>50</sub>");
  });

  test("supports Greek letters and superscripts", () => {
    expect(rendered("α", "ra")).toBe("α");
    expect(rendered("δ", "dec")).toBe("δ");
    expect(rendered("R<sup>2</sup>")).toBe("R<sup>2</sup>");
  });

  test("falls back to the technical name when nice is missing", () => {
    expect(rendered(null, "v_hel")).toBe("v_hel");
    expect(rendered("", "v_hel")).toBe("v_hel");
    expect(rendered("  ", "v_hel")).toBe("v_hel");
  });

  test("never interprets arbitrary HTML or attribute-bearing tags", () => {
    expect(rendered('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
    expect(rendered('<sub onclick="x">T</sub>')).toBe(
      "&lt;sub onclick=&quot;x&quot;&gt;T&lt;/sub&gt;",
    );
  });
});
