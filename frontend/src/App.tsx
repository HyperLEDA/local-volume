import { lazy, Suspense, useDeferredValue } from "react";
import { BrowserRouter, Route, Routes, useLocation } from "react-router-dom";
import { CatalogHeader } from "./components/CatalogHeader.tsx";
import { CatalogSidebar } from "./components/CatalogSidebar.tsx";
import { RouteLoadErrorBoundary } from "./components/RouteLoadErrorBoundary.tsx";
import {
  loadGroupPage,
  loadGroupPreviewBuilderPage,
  loadGroupsPage,
  loadObjectPage,
  loadObjectsPage,
  loadPublicationsPage,
  loadAcknowledgementsPage,
  loadDocumentsPage,
} from "./pageLoaders.ts";

// React.lazy and navigation hints reuse the same cached loader promises.
const ObjectsPage = lazy(loadObjectsPage);
const ObjectPage = lazy(loadObjectPage);
const GroupsPage = lazy(loadGroupsPage);
const GroupPreviewBuilderPage = lazy(loadGroupPreviewBuilderPage);
const GroupPage = lazy(loadGroupPage);
const PublicationsPage = lazy(loadPublicationsPage);
const AcknowledgementsPage = lazy(loadAcknowledgementsPage);
const DocumentsPage = lazy(loadDocumentsPage);

// Keep the already rendered route visible while a new lazy page is loading.
// Initial direct visits still suspend until their route module is ready.
function PageRoutes() {
  const location = useLocation();
  const deferredLocation = useDeferredValue(location);

  return (
    <Suspense
      fallback={
        <p className="catalog-status" role="status">
          Loading page…
        </p>
      }
    >
      <Routes location={deferredLocation}>
        <Route
          path="/"
          element={
            <RouteLoadErrorBoundary key="atlas">
              <ObjectsPage />
            </RouteLoadErrorBoundary>
          }
        />
        <Route
          path="/object/:pgc"
          element={
            <RouteLoadErrorBoundary key="object">
              <ObjectPage />
            </RouteLoadErrorBoundary>
          }
        />
        <Route
          path="/groups"
          element={
            <RouteLoadErrorBoundary key="groups">
              <GroupsPage />
            </RouteLoadErrorBoundary>
          }
        />
        <Route
          path="/groups/preview-builder"
          element={
            <RouteLoadErrorBoundary key="preview-builder">
              <GroupPreviewBuilderPage />
            </RouteLoadErrorBoundary>
          }
        />
        <Route
          path="/groups/:rootPgc"
          element={
            <RouteLoadErrorBoundary key="group">
              <GroupPage />
            </RouteLoadErrorBoundary>
          }
        />
        <Route
          path="/publications"
          element={
            <RouteLoadErrorBoundary key="publications">
              <PublicationsPage />
            </RouteLoadErrorBoundary>
          }
        />
        <Route
          path="/documents"
          element={
            <RouteLoadErrorBoundary key="documents">
              <DocumentsPage />
            </RouteLoadErrorBoundary>
          }
        />
        <Route
          path="/acknowledgements"
          element={
            <RouteLoadErrorBoundary key="acknowledgements">
              <AcknowledgementsPage />
            </RouteLoadErrorBoundary>
          }
        />
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
