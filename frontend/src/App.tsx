import { BrowserRouter, Route, Routes } from "react-router-dom";
import { CatalogHeader } from "./components/CatalogHeader.tsx";
import { CatalogSidebar } from "./components/CatalogSidebar.tsx";
import { ObjectPage } from "./pages/ObjectPage.tsx";
import { ObjectsPage } from "./pages/ObjectsPage.tsx";
import { PublicationsPage } from "./pages/PublicationsPage.tsx";
import { GroupsPage } from "./pages/GroupsPage.tsx";
import { GroupPreviewBuilderPage } from "./pages/GroupPreviewBuilderPage.tsx";
import { GroupPage } from "./pages/GroupPage.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <CatalogSidebar />
        <div className="app-workspace">
          <CatalogHeader />
          <Routes>
            <Route path="/" element={<ObjectsPage />} />
            <Route path="/object/:pgc" element={<ObjectPage />} />
            <Route path="/groups" element={<GroupsPage />} />
            <Route path="/groups/preview-builder" element={<GroupPreviewBuilderPage />} />
            <Route path="/groups/:rootPgc" element={<GroupPage />} />
            <Route path="/publications" element={<PublicationsPage />} />
          </Routes>
        </div>
      </div>
    </BrowserRouter>
  );
}
