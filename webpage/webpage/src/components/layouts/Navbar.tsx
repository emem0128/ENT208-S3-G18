import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, LogOut, User, ArrowLeftRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';
import i18n, { LANGUAGE_STORAGE_KEY } from '@/i18n';

const Navbar: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();

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
    { path: '/', label: t('nav.dashboard') },
    { path: '/expenses', label: t('nav.expenses') },
    { path: '/summary', label: t('nav.summary') },
    { path: '/drivers', label: t('nav.drivers') },
    { path: '/vehicles', label: t('nav.vehicles') },
    { path: '/advance-funds', label: t('nav.advanceFunds') },
  ];

  const systemMenuItems = [
    { path: '/fee-types', label: t('nav.feeTypes') },
    ...(isAdmin ? [{ path: '/staff', label: t('nav.staff') }] : []),
    { path: '/logs', label: t('nav.logs') },
  ];

  return (
    <nav className="bg-card border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <div className="text-xl font-bold text-primary">{t('brand.legacySystem')}</div>
            </div>
            <div className="flex space-x-1">
              {navItems.map((item) => (
                <Button
                  key={item.path}
                  asChild
                  variant={location.pathname === item.path ? 'default' : 'ghost'}
                  className="text-sm"
                >
                  <Link to={item.path}>
                    {item.label}
                  </Link>
                </Button>
              ))}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant={
                      systemMenuItems.some((item) => location.pathname === item.path)
                        ? 'default'
                        : 'ghost'
                    }
                    className="text-sm"
                  >
                    {t('nav.systemSettings')}
                    <ChevronDown className="ml-1 h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {systemMenuItems.map((item) => (
                    <DropdownMenuItem key={item.path} asChild>
                      <Link to={item.path} className="cursor-pointer">
                        {item.label}
                      </Link>
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="text-foreground">{user?.name}</span>
                  <span className="text-muted-foreground">
                    ({user?.role === 'admin' ? t('common.admin') : t('common.staff')})
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
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
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
