import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Login from './pages/Login';
import Layout from "./components/Layout";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import "./App.css";

// Lazy load pages for better initial load performance
const Dashboard = lazy(() => import("./pages/Dashboard"));
const UserDetail = lazy(() => import("./pages/UserDetail"));
const Users = lazy(() => import("./pages/Users"));
const UserAdd = lazy(() => import("./pages/UserAdd"));
const UserEdit = lazy(() => import("./pages/UserEdit"));
const Stores = lazy(() => import("./pages/Stores"));
const StoreDetail = lazy(() => import("./pages/StoreDetail"));
const StoreEdit = lazy(() => import("./pages/StoreEdit"));
const StoreAdd = lazy(() => import("./pages/StoreAdd"));
const StoreSurveyDetail = lazy(() => import("./pages/StoreSurveyDetail"));
const StoreSurveyList = lazy(() => import("./pages/StoreSurveyList"));
const Audits = lazy(() => import("./pages/Audits"));
const Distributors = lazy(() => import("./pages/Distributors"));
const ImportExport = lazy(() => import("./pages/ImportExport"));

// Loading component
const PageLoader = () => (
  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
    <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #0138C3', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
  </div>
);

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return <div>Loading...</div>;
  }

  // Only allow admin users
  if (!isAuthenticated || user?.role !== 'admin') {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
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
        <Route index element={
          <Suspense fallback={<PageLoader />}>
            <Dashboard />
          </Suspense>
        } />
        <Route path="dashboard/user/:userId" element={
          <Suspense fallback={<PageLoader />}>
            <UserDetail />
          </Suspense>
        } />
        <Route path="users" element={
          <Suspense fallback={<PageLoader />}>
            <Users />
          </Suspense>
        } />
        <Route path="users/new" element={
          <Suspense fallback={<PageLoader />}>
            <UserAdd />
          </Suspense>
        } />
        <Route path="users/:id/edit" element={
          <Suspense fallback={<PageLoader />}>
            <UserEdit />
          </Suspense>
        } />
        <Route path="stores" element={
          <Suspense fallback={<PageLoader />}>
            <Stores />
          </Suspense>
        } />
        <Route path="stores/new" element={
          <Suspense fallback={<PageLoader />}>
            <StoreAdd />
          </Suspense>
        } />
        <Route path="stores/:id/edit" element={
          <Suspense fallback={<PageLoader />}>
            <StoreEdit />
          </Suspense>
        } />
        <Route path="stores/:storeId/survey" element={
          <Suspense fallback={<PageLoader />}>
            <StoreSurveyDetail />
          </Suspense>
        } />
        <Route path="stores/:id" element={
          <Suspense fallback={<PageLoader />}>
            <StoreDetail />
          </Suspense>
        } />
        <Route path="store-surveys" element={
          <Suspense fallback={<PageLoader />}>
            <StoreSurveyList />
          </Suspense>
        } />
        <Route path="audits" element={
          <Suspense fallback={<PageLoader />}>
            <Audits />
          </Suspense>
        } />
        <Route path="distributors" element={
          <Suspense fallback={<PageLoader />}>
            <Distributors />
          </Suspense>
        } />
        <Route path="import-export" element={
          <Suspense fallback={<PageLoader />}>
            <ImportExport />
          </Suspense>
        } />
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
