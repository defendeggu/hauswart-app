import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { EntryFormPage } from "./pages/EntryFormPage";
import { MyEntriesPage } from "./pages/MyEntriesPage";
import { AdminHome } from "./pages/AdminHome";
import { HauswartLayout } from "./layouts/HauswartLayout";
import { Footer } from "./components/Footer";

function RoleHome() {
  const { profile } = useAuth();
  return <Navigate to={profile?.rolle === "admin" ? "/admin" : "/erfassen"} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col">
        <main className="flex flex-1 flex-col">
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/admin"
              element={
                <ProtectedRoute requireRolle="admin">
                  <AdminHome />
                </ProtectedRoute>
              }
            />

            <Route
              element={
                <ProtectedRoute requireRolle="hauswart">
                  <HauswartLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/erfassen" element={<EntryFormPage />} />
              <Route path="/eintraege" element={<MyEntriesPage />} />
            </Route>

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <RoleHome />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </AuthProvider>
  );
}
