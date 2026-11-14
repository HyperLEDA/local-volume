import type { CatalogObjectDetail } from "../api/objects.ts";
import {
  formatDecDms,
  formatDegrees,
  formatRaHms,
  icrsToGalactic,
  galacticToSupergalactic,
} from "../lib/coordinates.ts";

type ObjectCoordinatesProps = {
  object: CatalogObjectDetail;
};

function CoordinateValue({
  label,
  value,
  secondary,
}: {
  label: string;
  value: string;
  secondary?: string;
}) {
  return (
    <div className="coordinate-value">
      <span className="coordinate-label">{label}</span>
      <span className="coordinate-number">{value}</span>
      {secondary ? <span className="coordinate-secondary">{secondary}</span> : null}
    </div>
  );
}

export function ObjectCoordinates({ object }: ObjectCoordinatesProps) {
  const ra = object.ra ?? null;
  const dec = object.dec ?? null;
  const galactic = ra !== null && dec !== null ? icrsToGalactic(ra, dec) : null;
  const supergalactic = galactic ? galacticToSupergalactic(galactic) : null;

  const raError = typeof object.e_ra === "number" && Number.isFinite(object.e_ra)
    ? `± ${Math.abs(object.e_ra).toPrecision(2)}°`
    : undefined;
  const decError = typeof object.e_dec === "number" && Number.isFinite(object.e_dec)
    ? `± ${Math.abs(object.e_dec).toPrecision(2)}°`
    : undefined;

  return (
    <section className="object-coordinates" aria-labelledby="object-coordinates-heading">
      <h3 id="object-coordinates-heading" className="object-section-heading">Coordinates</h3>
      <div className="coordinate-systems">
        <div className="coordinate-system">
          <h4>Equatorial <span>ICRS</span></h4>
          <div className="coordinate-grid">
            <CoordinateValue
              label="Right ascension α"
              value={formatRaHms(ra)}
              secondary={`${formatDegrees(ra)}${raError ? `  ${raError}` : ""}`}
            />
            <CoordinateValue
              label="Declination δ"
              value={formatDecDms(dec)}
              secondary={`${formatDegrees(dec, 6, true)}${decError ? `  ${decError}` : ""}`}
            />
          </div>
        </div>
        <div className="coordinate-system">
          <h4>Galactic <span>derived</span></h4>
          <div className="coordinate-grid">
            <CoordinateValue label="Longitude l" value={formatDegrees(galactic?.longitude, 4)} />
            <CoordinateValue label="Latitude b" value={formatDegrees(galactic?.latitude, 4, true)} />
          </div>
        </div>
        <div className="coordinate-system">
          <h4>Supergalactic <span>derived</span></h4>
          <div className="coordinate-grid">
            <CoordinateValue label="Longitude SGL" value={formatDegrees(supergalactic?.longitude, 4)} />
            <CoordinateValue label="Latitude SGB" value={formatDegrees(supergalactic?.latitude, 4, true)} />
          </div>
        </div>
      </div>
    </section>
  );
}
