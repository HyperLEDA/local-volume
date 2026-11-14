declare module "aladin-lite" {
  export type AladinOptions = {
    fov?: number;
    projection?: string;
    cooFrame?: string;
    showReticle?: boolean;
    showSimbadPointerControl?: boolean;
    showFullscreenControl?: boolean;
    survey?: string;
    target?: string;
  };

  export type MarkerOptions = {
    popupTitle?: string;
    popupDesc?: string;
    useMarkerDefaultIcon?: boolean;
  };

  export type CatalogOptions = {
    name?: string;
    shape?:
      string | ((source: AladinSource, ctx: CanvasRenderingContext2D) => void);
    sourceSize?: number;
    color?: string | ((source: AladinSource) => string);
  };

  export type AladinSource = {
    data?: Record<string, unknown>;
    x?: number;
    y?: number;
    size?: number;
    setSize: (size: number) => void;
  };

  export type AladinCatalog = {
    addSources: (sources: AladinSource[]) => void;
    removeAll: () => void;
  };

  export type AladinView = {
    addCatalog: (catalog: AladinCatalog) => void;
    gotoRaDec: (ra: number, dec: number) => void;
    setFoV: (fov: number) => void;
    getFov: () => [number, number];
    setZoomFactor: (zoomFactor: number) => void;
    getSize: () => [number, number];
    world2pix: (ra: number, dec: number) => [number, number] | null;
    showPopup: (
      ra: number,
      dec: number,
      title: string,
      description: string,
    ) => void;
    hidePopup: () => void;
    on: {
      (event: "positionChanged" | "zoomChanged", listener: () => void): void;
      (
        event: "click",
        listener: (position: { isDragging: boolean }) => void,
      ): void;
      (
        event: "objectClicked",
        listener: (source: AladinSource | null) => void,
      ): void;
    };
    off?: (
      event: "positionChanged" | "zoomChanged" | "objectClicked" | "click",
    ) => void;
  };

  export type AladinApi = {
    init: Promise<void>;
    aladin: (
      target: HTMLElement | string,
      options?: AladinOptions,
    ) => AladinView;
    catalog: (options?: CatalogOptions) => AladinCatalog;
    source: (
      ra: number,
      dec: number,
      data?: Record<string, unknown>,
      options?: MarkerOptions,
    ) => AladinSource;
    marker: (
      ra: number,
      dec: number,
      options?: MarkerOptions,
      data?: Record<string, unknown>,
    ) => AladinSource;
  };

  const aladinApi: AladinApi;
  export default aladinApi;
}
