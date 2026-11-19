import { Link, useLocation } from "react-router-dom";
import {
  collectionNeighbors,
  loadCollection,
  markCollectionReturn,
} from "../lib/collectionNavigation.ts";

export function ObjectCollectionNavigation({ pgc }: { pgc: number }) {
  const { search } = useLocation();
  const token = new URLSearchParams(search).get("nav");
  const context = loadCollection(token);
  const neighbors = collectionNeighbors(context, pgc);
  if (!context || !neighbors || !token) return null;
  const activeToken = token;
  function target(id: number): string {
    return `/object/${id}?nav=${encodeURIComponent(activeToken)}`;
  }
  return (
    <nav
      className="object-collection-navigation"
      aria-label="Collection navigation"
    >
      <Link
        to={context.returnTo}
        className="object-collection-back"
        onClick={() => {
          markCollectionReturn(context.scrollY);
        }}
      >
        ← Back to {context.label}
      </Link>
      <span className="object-collection-position">
        {neighbors.index + 1} / {context.pgcs.length}
      </span>
      {neighbors.previous === null ? (
        <button type="button" disabled>
          ← Previous
        </button>
      ) : (
        <Link to={target(neighbors.previous)} rel="prev">
          ← Previous
        </Link>
      )}
      {neighbors.next === null ? (
        <button type="button" disabled>
          Next →
        </button>
      ) : (
        <Link to={target(neighbors.next)} rel="next">
          Next →
        </Link>
      )}
    </nav>
  );
}
