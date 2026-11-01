import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AuthBoundary from "@/features/auth/components/AuthBoundary";
import AuthProvider from "@/features/auth/context/AuthProvider";
import AuthPage from "@/features/auth/pages/AuthPage";
import { itemDetailsNavigationState } from "@/features/food-items/itemDetailsNavigation";
import ItemDetailsPage from "@/features/food-items/pages/ItemDetailsPage";
import PantryPage from "@/features/food-items/pages/PantryPage";
import AppLayout from "@/layouts/AppLayout";
import AccessDeniedPage from "@/pages/AccessDeniedPage";
import NotFoundPage from "@/pages/NotFoundPage";

export default function App() {
  const location = useLocation();
  const navigationState = itemDetailsNavigationState(location.state);
  const contextualDetails =
    navigationState &&
    location.pathname === `/pantry/items/${navigationState.seedItem.id}`
      ? navigationState
      : null;

  return (
    <AuthProvider>
      <Routes location={contextualDetails?.pantryLocation ?? location}>
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
            <Route path="/pantry/items/:itemId" element={<ItemDetailsPage />} />
            <Route path="/access-denied" element={<AccessDeniedPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
        </Route>
      </Routes>
      {contextualDetails && (
        <Routes>
          <Route
            path="/pantry/items/:itemId"
            element={
              <ItemDetailsPage
                contextual
                seedItem={contextualDetails.seedItem}
              />
            }
          />
        </Routes>
      )}
    </AuthProvider>
  );
}
