import { describe, expect, test } from "bun:test";
import { popupObjectRoute } from "../src/lib/popupNavigation.ts";

const ordinaryClick = {
  button: 0,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  shiftKey: false,
};

describe("popup object link navigation", () => {
  test("handles internal galaxy links with normal left clicks", () => {
    expect(popupObjectRoute("/object/29146", ordinaryClick, "")).toBe(
      "/object/29146",
    );
    expect(popupObjectRoute("/object/40973", ordinaryClick, "_self")).toBe(
      "/object/40973",
    );
  });

  test("leaves modifier clicks and middle clicks to the browser", () => {
    expect(
      popupObjectRoute(
        "/object/29146",
        { ...ordinaryClick, ctrlKey: true },
        "",
      ),
    ).toBeNull();
    expect(
      popupObjectRoute(
        "/object/29146",
        { ...ordinaryClick, metaKey: true },
        "",
      ),
    ).toBeNull();
    expect(
      popupObjectRoute(
        "/object/29146",
        { ...ordinaryClick, shiftKey: true },
        "",
      ),
    ).toBeNull();
    expect(
      popupObjectRoute("/object/29146", { ...ordinaryClick, altKey: true }, ""),
    ).toBeNull();
    expect(
      popupObjectRoute("/object/29146", { ...ordinaryClick, button: 1 }, ""),
    ).toBeNull();
  });

  test("does not intercept external, malformed or new-tab links", () => {
    expect(popupObjectRoute(null, ordinaryClick, "")).toBeNull();
    expect(
      popupObjectRoute("https://leda.sao.ru/object/29146", ordinaryClick, ""),
    ).toBeNull();
    expect(
      popupObjectRoute("/object/29146?foo=bar", ordinaryClick, ""),
    ).toBeNull();
    expect(
      popupObjectRoute("/object/not-a-number", ordinaryClick, ""),
    ).toBeNull();
    expect(
      popupObjectRoute("/object/29146", ordinaryClick, "_blank"),
    ).toBeNull();
  });
});
