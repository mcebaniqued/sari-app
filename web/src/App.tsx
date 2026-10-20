import { Navigate, Route, Routes } from "react-router-dom";

import AuthBoundary from "@/features/auth/components/AuthBoundary";
import AuthProvider from "@/features/auth/context/AuthProvider";
import AuthPage from "@/features/auth/pages/AuthPage";
import PantryPage from "@/features/food-items/pages/PantryPage";
import AppLayout from "@/layouts/AppLayout";
import AccessDeniedPage from "@/pages/AccessDeniedPage";
import NotFoundPage from "@/pages/NotFoundPage";

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<AuthBoundary publicOnly />}>
          <Route path="/login" element={<AuthPage key="login" />} />
          <Route
            path="/register"
            element={<AuthPage key="register" register />}
          />
        </Route>
        <Route element={<AuthBoundary />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Navigate to="/pantry" replace />} />
            <Route path="/pantry" element={<PantryPage />} />
            <Route path="/access-denied" element={<AccessDeniedPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
    </AuthProvider>
  );
}
