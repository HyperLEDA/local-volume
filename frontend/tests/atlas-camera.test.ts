import { describe, expect, test } from "bun:test";
import { captureAtlasCamera, restoreAtlasCamera, type AtlasCamera } from "../src/lib/atlasCamera.ts";

describe("#77 Atlas fullscreen — camera continuity", () => {
  test("captures finite equatorial center and horizontal FoV", () => {
    const camera = {
      getRaDec: () => [10.6848, 41.2689],
      getFov: () => [12.5, 6.25],
    } as AtlasCamera;
    expect(captureAtlasCamera(camera)).toEqual({ra:10.6848,dec:41.2689,fov:12.5});
  });
  test("never invents a sky center from a half initialized view", () => {
    const camera = { getRaDec: () => [NaN, 0], getFov: () => [360, 180] } as AtlasCamera;
    expect(captureAtlasCamera(camera)).toBeNull();
  });
  test("restores center and angular width after a responsive resize", () => {
    let position = [10, 20]; let fov = 12;
    const camera: AtlasCamera = {
      getRaDec: () => position,
      getFov: () => [fov, fov/2],
      getSize: () => [640, 360],
      gotoRaDec: (ra,dec) => {position=[ra,dec]},
      setFoV: (value) => {fov=value},
    };
    const original = captureAtlasCamera(camera);
    position = [18, 21]; fov=24;
    expect(restoreAtlasCamera(camera,original)).toBe(true);
    expect(camera.getRaDec()).toEqual([10,20]);
    expect(camera.getFov()[0]).toBe(12);
  });
  test("does not mutate an unchanged camera or alter an existing projection", () => {
    let updated=0;
    const camera: AtlasCamera = {
      getRaDec: () => [359.999999,0],getFov:()=>[360,180],getSize:()=>[900,500],
      gotoRaDec:()=>{updated++},setFoV:()=>{updated++},
    };
    const snapshot=captureAtlasCamera(camera);
    expect(restoreAtlasCamera(camera,snapshot)).toBe(true);
    expect(updated).toBe(0);
  });
});
