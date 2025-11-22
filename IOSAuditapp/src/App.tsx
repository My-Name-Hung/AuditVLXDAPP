import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import DeviceCheck from './components/DeviceCheck';
import PermissionModal from './components/PermissionModal';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Stores from './pages/Stores';
import StoreDetail from './pages/StoreDetail';
import Profile from './pages/Profile';
import './App.css';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading, user } = useAuth();

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #f3f3f3', borderTop: '4px solid #0138C3', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check if user needs to change password
  if (user?.isChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const [permissionModalOpen, setPermissionModalOpen] = useState(false);
  const [permissions, setPermissions] = useState({ camera: false, location: false });

  useEffect(() => {
    // Check permissions on mount
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      // Check camera permission
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
      cameraStream.getTracks().forEach((track) => track.stop());
      setPermissions((prev) => ({ ...prev, camera: true }));
    } catch {
      setPermissions((prev) => ({ ...prev, camera: false }));
    }

    // Check location permission
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        () => setPermissions((prev) => ({ ...prev, location: true })),
        () => setPermissions((prev) => ({ ...prev, location: false }))
      );
    }

    // Show modal if permissions not granted
    if (!permissions.camera || !permissions.location) {
      setPermissionModalOpen(true);
    }
  };

  const handlePermissionGrant = () => {
    setPermissionModalOpen(false);
    checkPermissions();
  };

  return (
    <>
      <PermissionModal
        isOpen={permissionModalOpen}
        onClose={() => setPermissionModalOpen(false)}
        onGrant={handlePermissionGrant}
        permissions={permissions}
      />
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/change-password"
          element={
            <ProtectedRoute>
              <ChangePassword />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stores"
          element={
            <ProtectedRoute>
              <Stores />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stores/:id"
          element={
            <ProtectedRoute>
              <StoreDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<Navigate to="/stores" replace />} />
      </Routes>
    </>
  );
}

function App() {
  return (
    <DeviceCheck>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </DeviceCheck>
  );
}

export default App;
