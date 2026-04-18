import React, { lazy } from 'react';

export interface RouteConfig {
  path: string;
  component: React.LazyExoticComponent<React.ComponentType>;
}

const LoginPage = lazy(() => import('@/pages/LoginPage'));
const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const ExpensesPage = lazy(() => import('@/pages/ExpensesPage'));
const SummaryPage = lazy(() => import('@/pages/SummaryPage'));
const DriversPage = lazy(() => import('@/pages/DriversPage'));
const VehiclesPage = lazy(() => import('@/pages/VehiclesPage'));
const AdvanceFundsPage = lazy(() => import('@/pages/AdvanceFundsPage'));
const FeeTypesPage = lazy(() => import('@/pages/FeeTypesPage'));
const StaffPage = lazy(() => import('@/pages/StaffPage'));
const LogsPage = lazy(() => import('@/pages/LogsPage'));
const NotFound = lazy(() => import('@/pages/NotFound'));

const routes: RouteConfig[] = [
  {
    path: '/login',
    component: LoginPage,
  },
  {
    path: '/',
    component: DashboardPage,
  },
  {
    path: '/expenses',
    component: ExpensesPage,
  },
  {
    path: '/summary',
    component: SummaryPage,
  },
  {
    path: '/drivers',
    component: DriversPage,
  },
  {
    path: '/vehicles',
    component: VehiclesPage,
  },
  {
    path: '/advance-funds',
    component: AdvanceFundsPage,
  },
  {
    path: '/fee-types',
    component: FeeTypesPage,
  },
  {
    path: '/staff',
    component: StaffPage,
  },
  {
    path: '/logs',
    component: LogsPage,
  },
  {
    path: '/404',
    component: NotFound,
  },
];

export default routes;
