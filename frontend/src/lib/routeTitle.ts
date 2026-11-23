// Browser-tab titles for client-side navigation. Direct HTTP visits keep the
// more specific, server-generated title for individual catalogue records.
export function routeDocumentTitle(pathname: string, search = ""): string {
  const path = pathname.replace(/\/+$/, "") || "/";
  const definition = new URLSearchParams(search).get("definition");
  if (path === "/") return "LV LEDA | Galaxies of the Nearby Universe";
  if (path === "/about") return "About LV LEDA | LV LEDA";
  if (path === "/groups")
    return definition === "suite"
      ? "MD suites | LV LEDA"
      : "Physical galaxy groups | LV LEDA";
  if (path === "/groups/preview-builder")
    return "Group preview builder | LV LEDA";
  const galaxy = /^\/object\/([1-9]\d*)$/.exec(path);
  if (galaxy) return `Galaxy PGC ${galaxy[1]} | LV LEDA`;
  const group = /^\/groups\/([1-9]\d*)$/.exec(path);
  if (group)
    return `${definition === "suite" ? "MD suite" : "Galaxy group"} PGC ${group[1]} | LV LEDA`;
  if (path === "/documents") return "Scientific documents | LV LEDA";
  if (path === "/publications") return "Publications | LV LEDA";
  if (path === "/acknowledgements") return "Acknowledgements | LV LEDA";
  return "LV LEDA | Galaxies of the Nearby Universe";
}
