import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { CatalogHeader } from "./components/CatalogHeader.tsx";
import { CatalogSidebar } from "./components/CatalogSidebar.tsx";

// Page components are imported only for the active route. In particular,
// Publications and the Groups catalogue do not need Aladin Lite to start.
const ObjectsPage = lazy(() =>
  import("./pages/ObjectsPage.tsx").then((module) => ({
    default: module.ObjectsPage,
  })),
);
const ObjectPage = lazy(() =>
  import("./pages/ObjectPage.tsx").then((module) => ({
    default: module.ObjectPage,
  })),
);
const GroupsPage = lazy(() =>
  import("./pages/GroupsPage.tsx").then((module) => ({
    default: module.GroupsPage,
  })),
);
const GroupPreviewBuilderPage = lazy(() =>
  import("./pages/GroupPreviewBuilderPage.tsx").then((module) => ({
    default: module.GroupPreviewBuilderPage,
  })),
);
const GroupPage = lazy(() =>
  import("./pages/GroupPage.tsx").then((module) => ({
    default: module.GroupPage,
  })),
);
const PublicationsPage = lazy(() =>
  import("./pages/PublicationsPage.tsx").then((module) => ({
    default: module.PublicationsPage,
  })),
);

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <CatalogSidebar />
        <div className="app-workspace">
          <CatalogHeader />
          <Suspense fallback={null}>
            <Routes>
              <Route path="/" element={<ObjectsPage />} />
              <Route path="/object/:pgc" element={<ObjectPage />} />
              <Route path="/groups" element={<GroupsPage />} />
              <Route
                path="/groups/preview-builder"
                element={<GroupPreviewBuilderPage />}
              />
              <Route path="/groups/:rootPgc" element={<GroupPage />} />
              <Route path="/publications" element={<PublicationsPage />} />
            </Routes>
          </Suspense>
        </div>
      </div>
    </BrowserRouter>
  );
}
