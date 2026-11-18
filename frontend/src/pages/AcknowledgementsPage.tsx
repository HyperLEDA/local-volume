import Markdown from "react-markdown";
import acknowledgements from "../content/acknowledgements.md?raw";

export function AcknowledgementsPage() {
  return (
    <main className="catalog">
      <article className="publications">
        <Markdown>{acknowledgements}</Markdown>
      </article>
    </main>
  );
}
