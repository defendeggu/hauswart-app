import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { AccountPage } from "./pages/AccountPage";
import { EntryFormPage } from "./pages/EntryFormPage";
import { MyEntriesPage } from "./pages/MyEntriesPage";
import { AdminOverviewPage } from "./pages/admin/AdminOverviewPage";
import { AdminEntriesPage } from "./pages/admin/AdminEntriesPage";
import { AdminFamiliesPage } from "./pages/admin/AdminFamiliesPage";
import { AdminActivitiesPage } from "./pages/admin/AdminActivitiesPage";
import { AdminLoginsPage } from "./pages/admin/AdminLoginsPage";
import { AdminPeriodsPage } from "./pages/admin/AdminPeriodsPage";
import { AdminAuditPage } from "./pages/admin/AdminAuditPage";
import { AdminReportsPage } from "./pages/admin/AdminReportsPage";
import { HauswartLayout } from "./layouts/HauswartLayout";
import { AdminLayout } from "./layouts/AdminLayout";
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
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<AdminOverviewPage />} />
              <Route path="eintraege" element={<AdminEntriesPage />} />
              <Route path="familien" element={<AdminFamiliesPage />} />
              <Route path="taetigkeiten" element={<AdminActivitiesPage />} />
              <Route path="logins" element={<AdminLoginsPage />} />
              <Route path="perioden" element={<AdminPeriodsPage />} />
              <Route path="abrechnung" element={<AdminReportsPage />} />
              <Route path="audit" element={<AdminAuditPage />} />
            </Route>

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
              path="/konto"
              element={
                <ProtectedRoute>
                  <AccountPage />
                </ProtectedRoute>
              }
            />

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
