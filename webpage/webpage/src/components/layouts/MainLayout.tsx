import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  LayoutDashboard, FileText, Table, Users, Truck,
  Wallet, List, UserCog, ClipboardList, LogOut, ArrowLeftRight,
  PanelLeftClose, PanelLeft, Map, FileSpreadsheet,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useTranslation } from 'react-i18next';
import i18n, { LANGUAGE_STORAGE_KEY } from '@/i18n';


interface MainLayoutProps {
  children: React.ReactNode;
}

const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = React.useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem('layout-sidebar-collapsed') === '1';
  });

  React.useEffect(() => {
    window.localStorage.setItem('layout-sidebar-collapsed', collapsed ? '1' : '0');
  }, [collapsed]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const handleLanguageToggle = () => {
    const nextLanguage = i18n.language === 'en' ? 'zh' : 'en';
    void i18n.changeLanguage(nextLanguage);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, nextLanguage);
  };

  const currentLanguageLabel = i18n.language === 'en' ? t('language.english') : t('language.chinese');

  const navItems = [
    { path: '/', label: t('nav.dashboard'), icon: LayoutDashboard },
    { path: '/expenses', label: t('nav.expenses'), icon: FileText },
    { path: '/summary', label: t('nav.summary'), icon: Table },
    { path: '/drivers', label: t('nav.drivers'), icon: Users },
    { path: '/vehicles', label: t('nav.vehicles'), icon: Truck },
    { path: '/vehicle-tracking', label: t('nav.vehicleTracking'), icon: Map },
    { path: '/advance-funds', label: t('nav.advanceFunds'), icon: Wallet },
    { path: '/fee-types', label: t('nav.feeTypes'), icon: List },
    ...(isAdmin ? [{ path: '/staff', label: t('nav.staff'), icon: UserCog }] : []),
    { path: '/logs', label: t('nav.logs'), icon: ClipboardList },
    { path: '/legal', label: t('nav.legal'), icon: FileSpreadsheet },
  ];

  const NavItem = ({ path, label, icon: Icon }: { path: string; label: string; icon: any }) => {
    const isActive = location.pathname === path;
    const content = (
      <Link
        to={path}
        className={cn(
          'relative flex items-center py-2.5 rounded-lg text-sm transition-all',
          collapsed ? 'justify-center px-0 gap-0' : 'gap-3 px-2',
          isActive
            ? 'bg-white text-[#0f2a5e] font-semibold shadow-sm'
            : 'text-white/80 hover:bg-white/10 hover:text-white'
        )}
      >
        {isActive && !collapsed && <span className="absolute -left-1 top-1.5 bottom-1.5 w-0.5 rounded-full bg-white" />}
        <Icon className="h-4 w-4 shrink-0" />
        <span
          className="overflow-hidden whitespace-nowrap transition-all duration-300"
          style={{ opacity: collapsed ? 0 : 1, maxWidth: collapsed ? 0 : 200 }}
        >
          {label}
        </span>
      </Link>
    );

    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="right">{label}</TooltipContent>
        </Tooltip>
      );
    }
    return content;
  };

  return (
    <TooltipProvider>
      <div className="h-screen flex overflow-hidden">
        <aside
          className={cn("relative h-screen flex flex-col shrink-0 transition-all duration-300 overflow-visible", collapsed ? "w-14" : "w-[9.5rem]")}
          style={{ background: 'linear-gradient(180deg, #0f2a5e 0%, #1a3f8f 60%, #1e4da8 100%)' }}
        >
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              'absolute right-0 top-1/2 z-30 -translate-y-1/2 translate-x-full border-l-0 px-0 transition-all',
              collapsed
                ? 'h-10 w-5 rounded-r-full rounded-l-none border border-[#7fb0ff] bg-[#0f2a5e] text-white shadow-[0_4px_10px_rgba(15,42,94,0.3)] hover:bg-[#1a3f8f]'
                : 'h-9 w-4 rounded-r-full rounded-l-none border border-[#0f2a5e]/40 bg-white text-[#0f2a5e] shadow-[0_3px_8px_rgba(15,42,94,0.18)] hover:bg-[#eef3ff]'
            )}
            onClick={() => setCollapsed(!collapsed)}
            title={collapsed ? t('nav.expandSidebar') : t('nav.collapseSidebar')}
          >
            {collapsed ? <PanelLeft className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3 w-3" />}
          </Button>

          {/* Logo区域 */}
          <div className="flex items-center border-b border-white/10 px-3 py-3 gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-white/10 text-white shrink-0">
              <Truck className="h-4 w-4" />
            </div>
            <div
              className="overflow-hidden whitespace-nowrap transition-all duration-300 flex-1"
              style={{ width: collapsed ? 0 : 120, opacity: collapsed ? 0 : 1 }}
            >
              <div className="text-white font-bold text-sm leading-tight">{t('brand.short')}</div>
            </div>
          </div>

          {/* 导航菜单 */}
          <nav className="flex-1 py-2 px-1 space-y-0.5 overflow-y-auto">
            {navItems.map((item) => (
              <NavItem key={item.path} {...item} />
            ))}
          </nav>

          {/* 底部用户信息 */}
          <div className="border-t border-white/10 px-2 py-3 shrink-0">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded-lg text-left transition-colors hover:bg-white/10',
                    collapsed ? 'justify-center p-1.5' : 'px-1 py-1.5'
                  )}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarFallback className="bg-white/15 text-white text-xs font-semibold">
                      {user?.name?.charAt(0) || '?'}
                    </AvatarFallback>
                  </Avatar>
                  {!collapsed && (
                    <div className="min-w-0 flex-1 overflow-hidden px-1">
                      <div className="truncate text-white text-xs font-medium">{user?.name}</div>
                      <div className="truncate text-white/60 text-xs">{user?.role === 'admin' ? t('common.admin') : t('common.staff')}</div>
                    </div>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                side="top"
                align={collapsed ? 'center' : 'start'}
                className="w-44"
              >
                <DropdownMenuItem onClick={handleLanguageToggle} className="justify-between">
                  <span>{currentLanguageLabel}</span>
                  <ArrowLeftRight className="h-4 w-4 text-muted-foreground" />
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="justify-between">
                  <span>{t('nav.logout')}</span>
                  <LogOut className="h-4 w-4 text-muted-foreground" />
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </aside>

        <main className="flex-1 bg-background overflow-auto">
          <div className="p-6">{children}</div>
        </main>
      </div>
    </TooltipProvider>
  );
};

export default MainLayout;
