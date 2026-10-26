import Markdown from "react-markdown";
import { CatalogHeader } from "../components/CatalogHeader.tsx";
import publications from "../content/publications.md?raw";

export function PublicationsPage() {
  return (
    <main className="catalog">
      <CatalogHeader titleLinksHome />
      <article className="publications">
        <Markdown>{publications}</Markdown>
      </article>
    </main>
  );
}
