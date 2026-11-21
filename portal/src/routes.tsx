import { Route, Routes } from "react-router-dom";

import { HomePage } from "./pages/HomePage";
import { PatientCallsPage } from "./pages/PatientCallsPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/patients/:id" element={<PatientCallsPage />} />
    </Routes>
  );
}
