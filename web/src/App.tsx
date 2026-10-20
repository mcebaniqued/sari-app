import { Navigate, Route, Routes } from "react-router-dom";

import PantryPage from "@/features/food-items/pages/PantryPage";
import AppLayout from "@/layouts/AppLayout";
import AccessDeniedPage from "@/pages/AccessDeniedPage";
import NotFoundPage from "@/pages/NotFoundPage";

export default function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/pantry" replace />} />
        <Route path="/pantry" element={<PantryPage />} />
        <Route path="/access-denied" element={<AccessDeniedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}
