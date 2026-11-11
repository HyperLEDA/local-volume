import Markdown from "react-markdown";
import publications from "../content/publications.md?raw";

export function PublicationsPage() {
  return (
    <main className="catalog">
      <article className="publications">
        <Markdown>{publications}</Markdown>
      </article>
    </main>
  );
}
