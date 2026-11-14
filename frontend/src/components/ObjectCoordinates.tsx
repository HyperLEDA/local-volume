import type { CatalogObjectDetail } from "../api/objects.ts";
import {
  formatDecDms,
  formatDegrees,
  formatRaHms,
  icrsToGalactic,
  galacticToSupergalactic,
} from "../lib/coordinates.ts";

type ObjectCoordinatesProps = { object: CatalogObjectDetail };

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

  return (
    <section className="object-coordinates" aria-labelledby="object-coordinates-heading">
      <h3 id="object-coordinates-heading" className="object-section-heading">Coordinates</h3>
      <div className="coordinate-systems">
        <div className="coordinate-system">
          <h4>Equatorial <span>ICRS</span></h4>
          <div className="coordinate-grid">
            <CoordinateValue label="α" value={formatRaHms(ra)} secondary={formatDegrees(ra)} />
            <CoordinateValue label="δ" value={formatDecDms(dec)} secondary={formatDegrees(dec, 6, true)} />
          </div>
        </div>
        <div className="coordinate-system">
          <h4>Galactic</h4>
          <div className="coordinate-grid">
            <CoordinateValue label="l" value={formatDegrees(galactic?.longitude, 4)} />
            <CoordinateValue label="b" value={formatDegrees(galactic?.latitude, 4, true)} />
          </div>
        </div>
        <div className="coordinate-system">
          <h4>Supergalactic</h4>
          <div className="coordinate-grid">
            <CoordinateValue label="SGL" value={formatDegrees(supergalactic?.longitude, 4)} />
            <CoordinateValue label="SGB" value={formatDegrees(supergalactic?.latitude, 4, true)} />
          </div>
        </div>
      </div>
    </section>
  );
}
