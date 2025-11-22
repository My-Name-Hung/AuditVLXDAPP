import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import DeviceCheck from './components/DeviceCheck';
import PermissionModal from './components/PermissionModal';
import ErrorBoundary from './components/ErrorBoundary';
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
  const [permissionsChecked, setPermissionsChecked] = useState(false);

  useEffect(() => {
    // Check permissions on mount with error handling
    checkPermissions().catch((error) => {
      console.error('Error checking permissions:', error);
      setPermissionsChecked(true);
    });
  }, []);

  const checkPermissions = async () => {
    try {
      // Check if mediaDevices is available (may not be on some browsers)
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.warn('MediaDevices API not available');
        setPermissions((prev) => ({ ...prev, camera: false }));
        setPermissionsChecked(true);
        return;
      }

      // Check camera permission
      try {
        const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true });
        cameraStream.getTracks().forEach((track) => track.stop());
        setPermissions((prev) => ({ ...prev, camera: true }));
      } catch (error) {
        console.warn('Camera permission denied or not available:', error);
        setPermissions((prev) => ({ ...prev, camera: false }));
      }

      // Check location permission
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          () => setPermissions((prev) => ({ ...prev, location: true })),
          (error) => {
            console.warn('Location permission denied or not available:', error);
            setPermissions((prev) => ({ ...prev, location: false }));
          },
          { timeout: 5000 }
        );
      } else {
        console.warn('Geolocation API not available');
        setPermissions((prev) => ({ ...prev, location: false }));
      }
    } catch (error) {
      console.error('Error in checkPermissions:', error);
      // Don't block the app if permission check fails
    } finally {
      setPermissionsChecked(true);
    }
  };

  const handlePermissionGrant = () => {
    setPermissionModalOpen(false);
    checkPermissions();
  };

  // Only show permission modal after permissions are checked
  useEffect(() => {
    if (permissionsChecked && (!permissions.camera || !permissions.location)) {
      setPermissionModalOpen(true);
    }
  }, [permissionsChecked, permissions]);

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
    <ErrorBoundary>
      <DeviceCheck>
        <ThemeProvider>
          <AuthProvider>
            <BrowserRouter>
              <AppRoutes />
            </BrowserRouter>
          </AuthProvider>
        </ThemeProvider>
      </DeviceCheck>
    </ErrorBoundary>
  );
}

export default App;
