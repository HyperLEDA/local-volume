import { BrowserRouter, Route, Routes } from "react-router-dom";
import { ObjectsPage } from "./pages/ObjectsPage.tsx";
import { PublicationsPage } from "./pages/PublicationsPage.tsx";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ObjectsPage />} />
        <Route path="/publications" element={<PublicationsPage />} />
      </Routes>
    </BrowserRouter>
  );
}
