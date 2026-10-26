import type { CatalogObject } from "../api/objects.ts";

type ObjectCardProps = {
  object: CatalogObject;
  onLocate: (object: CatalogObject) => void;
};

function LocateIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true">
      <circle
        cx="8"
        cy="8"
        r="2.25"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
      />
      <path
        d="M8 1.25v3.1M8 11.65v3.1M1.25 8h3.1M11.65 8h3.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ObjectCard({ object, onLocate }: ObjectCardProps) {
  const canLocate = object.ra !== null && object.dec !== null;

  return (
    <article className="object-card">
      <span className="object-card-name">{object.name}</span>
      {canLocate ? (
        <button
          type="button"
          className="object-card-locate"
          aria-label={`Show ${object.name} on the sky`}
          onClick={() => {
            onLocate(object);
          }}
        >
          <LocateIcon />
        </button>
      ) : null}
    </article>
  );
}
