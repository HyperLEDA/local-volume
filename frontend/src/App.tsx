import { lazy, Suspense, useDeferredValue } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { CatalogHeader } from "./components/CatalogHeader.tsx";
import { CatalogSidebar } from "./components/CatalogSidebar.tsx";
import {
  loadGroupPage,
  loadGroupPreviewBuilderPage,
  loadGroupsPage,
  loadObjectPage,
  loadObjectsPage,
  loadPublicationsPage,
} from "./pageLoaders.ts";

// React.lazy and navigation hints reuse the same cached loader promises.
const ObjectsPage = lazy(loadObjectsPage);
const ObjectPage = lazy(loadObjectPage);
const GroupsPage = lazy(loadGroupsPage);
const GroupPreviewBuilderPage = lazy(loadGroupPreviewBuilderPage);
const GroupPage = lazy(loadGroupPage);
const PublicationsPage = lazy(loadPublicationsPage);

// Keep the already rendered route visible while a new lazy page is loading.
// Initial direct visits still suspend until their route module is ready.
function PageRoutes() {
  const location = useLocation();
  const deferredLocation = useDeferredValue(location);

  return (
    <Suspense fallback={null}>
      <Routes location={deferredLocation}>
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
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <CatalogSidebar />
        <div className="app-workspace">
          <CatalogHeader />
          <PageRoutes />
        </div>
      </div>
    </BrowserRouter>
  );
}
