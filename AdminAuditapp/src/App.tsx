import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Login from './pages/Login';
import Dashboard from "./pages/Dashboard";
import Users from "./pages/Users";
import Stores from "./pages/Stores";
import Audits from "./pages/Audits";
import Distributors from "./pages/Distributors";
import ImportExport from "./pages/ImportExport";
import Layout from "./components/Layout";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import "./App.css";

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="users" element={<Users />} />
        <Route path="stores" element={<Stores />} />
        <Route path="audits" element={<Audits />} />
        <Route path="distributors" element={<Distributors />} />
        <Route path="import-export" element={<ImportExport />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}

export default App;
