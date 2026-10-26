declare module "aladin-lite" {
  export type AladinOptions = {
    fov?: number;
    projection?: string;
    cooFrame?: string;
    showSimbadPointerControl?: boolean;
    showFullscreenControl?: boolean;
    target?: string;
  };

  export type MarkerOptions = {
    popupTitle?: string;
    popupDesc?: string;
  };

  export type CatalogOptions = {
    name?: string;
    shape?: string;
    sourceSize?: number;
    color?: string;
  };

  export type AladinSource = object;

  export type AladinCatalog = {
    addSources: (sources: AladinSource[]) => void;
    removeAll: () => void;
  };

  export type AladinView = {
    addCatalog: (catalog: AladinCatalog) => void;
    gotoRaDec: (ra: number, dec: number) => void;
    setFoV: (fov: number) => void;
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
      data?: Record<string, string>,
      options?: MarkerOptions,
    ) => AladinSource;
  };

  const aladinApi: AladinApi;
  export default aladinApi;
}
