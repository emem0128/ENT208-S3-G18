import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import IntersectObserver from '@/components/common/IntersectObserver';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

import routes from './routes';

// 路由守卫组件
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const location = useLocation();

  if (!user && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  if (user && location.pathname === '/login') {
    return <Navigate to="/" replace />;
  }

  return children;
};

const AppRoutes: React.FC = () => {
  return (
    <Routes>
      {routes.map((route, index) => {
        const Component = route.component;
        return (
          <Route
            key={index}
            path={route.path}
            element={
              <ProtectedRoute>
                <Suspense fallback={<div className="p-6 text-muted-foreground">页面加载中...</div>}>
                  <Component />
                </Suspense>
              </ProtectedRoute>
            }
          />
        );
      })}
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <IntersectObserver />
        <AppRoutes />
        <Toaster />
      </AuthProvider>
    </Router>
  );
};

export default App;
