import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ObjectPage } from "./pages/ObjectPage.tsx";
import { ObjectsPage } from "./pages/ObjectsPage.tsx";
import { PublicationsPage } from "./pages/PublicationsPage.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ObjectsPage />} />
        <Route path="/object/:pgc" element={<ObjectPage />} />
        <Route path="/publications" element={<PublicationsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
