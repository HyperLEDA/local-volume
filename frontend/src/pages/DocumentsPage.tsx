import type { ComponentProps } from "react";
import { useEffect } from "react";
import Markdown, { type Components } from "react-markdown";
import { Link, useLocation } from "react-router-dom";
import documents from "../content/documents.md?raw";

function DocumentHeading({ children }: ComponentProps<"h2">) {
  return (
    <h2
      id={
        children === "How to cite LV LEDA" ? "how-to-cite-lv-leda" : undefined
      }
    >
      {children}
    </h2>
  );
}

function DocumentLink({ href, children }: ComponentProps<"a">) {
  return href?.startsWith("/") ? (
    <Link to={href}>{children}</Link>
  ) : (
    <a href={href} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

const DOCUMENT_COMPONENTS: Components = {
  h2: DocumentHeading,
  a: DocumentLink,
};

/** Internal links retain the common site shell. */
export function DocumentsPage() {
  const { hash } = useLocation();
  useEffect(() => {
    if (hash !== "#how-to-cite-lv-leda") return;
    window.requestAnimationFrame(() =>
      document.getElementById("how-to-cite-lv-leda")?.scrollIntoView(),
    );
  }, [hash]);
  return (
    <main className="catalog">
      <article className="publications scientific-documents">
        <Markdown components={DOCUMENT_COMPONENTS}>{documents}</Markdown>
      </article>
    </main>
  );
}
