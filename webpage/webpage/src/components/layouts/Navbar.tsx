import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, LogOut, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

const Navbar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isAdmin } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const navItems = [
    { path: '/', label: '数据看板' },
    { path: '/expenses', label: '报账管理' },
    { path: '/summary', label: '总表' },
    { path: '/drivers', label: '司机管理' },
    { path: '/vehicles', label: '车辆管理' },
    { path: '/advance-funds', label: '备用金' },
  ];

  const systemMenuItems = [
    { path: '/fee-types', label: '费用类型管理' },
    ...(isAdmin ? [{ path: '/staff', label: '客服账号管理' }] : []),
    { path: '/logs', label: '操作日志' },
  ];

  return (
    <nav className="bg-card border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <div className="flex items-center space-x-8">
            <div className="flex items-center space-x-2">
              <div className="text-xl font-bold text-primary">司机报账管理系统</div>
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
                    系统设置
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
            <div className="flex items-center space-x-2 text-sm">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-foreground">{user?.name}</span>
              <span className="text-muted-foreground">
                ({user?.role === 'admin' ? '管理员' : '普通客服'})
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              退出
            </Button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
