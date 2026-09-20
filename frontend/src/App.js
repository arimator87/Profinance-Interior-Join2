import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { Toaster } from "@/components/ui/sonner";
import { Loader2 } from "lucide-react";
import AuthCallback from "@/components/AuthCallback";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import ProjectDetail from "@/pages/ProjectDetail";
import Pricing from "@/pages/Pricing";
import Account from "@/pages/Account";
import AdminSettings from "@/pages/AdminSettings";
import ClientPortal from "@/pages/ClientPortal";

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

function AppRoutes() {
  const location = useLocation();
  // Detect OAuth callback synchronously during render (prevents race conditions)
  if (location.hash?.includes("session_id=")) {
    return <AuthCallback />;
  }
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/portal/:slug" element={<ClientPortal />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/project/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
      <Route path="/pricing" element={<ProtectedRoute><Pricing /></ProtectedRoute>} />
      <Route path="/account" element={<ProtectedRoute><Account /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute><AdminSettings /></ProtectedRoute>} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
          <Toaster position="top-right" richColors />
        </AuthProvider>
      </BrowserRouter>
    </div>
  );
}

export default App;
