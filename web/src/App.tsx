import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import UnsavedChangesProvider from "@/contexts/UnsavedChangesContext";
import AuthBoundary from "@/features/auth/components/AuthBoundary";
import AuthProvider from "@/features/auth/context/AuthProvider";
import AuthPage from "@/features/auth/pages/AuthPage";
import EditItemPage from "@/features/food-items/pages/EditItemPage";
import ItemDetailsPage from "@/features/food-items/pages/ItemDetailsPage";
import PantryPage from "@/features/food-items/pages/PantryPage";
import { pantryRouteNavigationState } from "@/features/food-items/pantryRouteNavigation";
import AppLayout from "@/layouts/AppLayout";
import AccessDeniedPage from "@/pages/AccessDeniedPage";
import NotFoundPage from "@/pages/NotFoundPage";

export default function App() {
  const location = useLocation();
  const navigationState = pantryRouteNavigationState(location.state);
  const detailsPath = navigationState
    ? `/pantry/items/${navigationState.seedItem.id}`
    : "";
  const editPath = detailsPath ? `${detailsPath}/edit` : "";
  const contextualRoute =
    navigationState &&
    (location.pathname === detailsPath || location.pathname === editPath)
      ? navigationState
      : null;

  return (
    <AuthProvider>
      <UnsavedChangesProvider>
        <div data-route-background>
          <Routes location={contextualRoute?.pantryLocation ?? location}>
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
                <Route
                  path="/pantry/items/:itemId"
                  element={<ItemDetailsPage />}
                />
                <Route
                  path="/pantry/items/:itemId/edit"
                  element={<EditItemPage />}
                />
                <Route path="/access-denied" element={<AccessDeniedPage />} />
                <Route path="*" element={<NotFoundPage />} />
              </Route>
            </Route>
          </Routes>
        </div>
        {contextualRoute && (
          <Routes>
            <Route
              path="/pantry/items/:itemId"
              element={
                <ItemDetailsPage
                  contextual
                  navigationState={contextualRoute}
                  seedItem={contextualRoute.seedItem}
                />
              }
            />
            <Route
              path="/pantry/items/:itemId/edit"
              element={
                <EditItemPage
                  contextual
                  navigationState={contextualRoute}
                  seedItem={contextualRoute.seedItem}
                />
              }
            />
          </Routes>
        )}
      </UnsavedChangesProvider>
    </AuthProvider>
  );
}
