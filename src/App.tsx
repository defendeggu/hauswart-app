import { Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider, useAuth } from "./lib/auth";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { HauswartHome } from "./pages/HauswartHome";
import { AdminHome } from "./pages/AdminHome";
import { Footer } from "./components/Footer";

function RoleHome() {
  const { profile } = useAuth();
  return profile?.rolle === "admin" ? <AdminHome /> : <HauswartHome />;
}

export default function App() {
  return (
    <AuthProvider>
      <div className="flex min-h-screen flex-col">
        <main className="flex flex-1 flex-col">
          <Routes>
            <Route path="/login" element={<LoginPage />} />
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
