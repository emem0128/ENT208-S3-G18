import React, { Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import IntersectObserver from '@/components/common/IntersectObserver';
import { Toaster } from '@/components/ui/sonner';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

import routes from './routes';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});

// 路由守卫组件
const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isReady } = useAuth();
  const location = useLocation();

  if (!isReady) {
    return <div className="p-6 text-muted-foreground">加载中...</div>;
  }

  if (!user && location.pathname !== '/login') {
    return <Navigate to="/login" replace />;
  }

  if (user && location.pathname === '/login') {
    return <Navigate to="/" replace />;
  }

  return children;
};

const AppRoutes: React.FC = () => {
  const { t } = useTranslation();

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
                <Suspense fallback={<div className="p-6 text-muted-foreground">{t('common.loading')}</div>}>
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
    <QueryClientProvider client={queryClient}>
      <Router>
        <AuthProvider>
          <IntersectObserver />
          <AppRoutes />
          <Toaster />
        </AuthProvider>
      </Router>
    </QueryClientProvider>
  );
};

export default App;
