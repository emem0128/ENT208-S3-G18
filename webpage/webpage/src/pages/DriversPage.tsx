import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layouts/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Power, RefreshCw, Key } from 'lucide-react';
import { getAllDrivers, createDriver, updateDriver, createOperationLog } from '@/db/api';
import type { Driver } from '@/types/database';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const DriversPage: React.FC = () => {
  const { user } = useAuth();
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingDriver, setEditingDriver] = useState<Driver | null>(null);
  const [resetPasswordDriver, setResetPasswordDriver] = useState<Driver | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '123456',
  });

  useEffect(() => {
    loadDrivers();
  }, []);

  const loadDrivers = async () => {
    setLoading(true);
    try {
      const data = await getAllDrivers();
      setDrivers(data);
    } catch (error) {
      console.error('加载司机列表失败:', error);
      toast.error('加载司机列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (driver?: Driver) => {
    if (driver) {
      setEditingDriver(driver);
      setFormData({
        name: driver.name,
        username: driver.username,
        password: '',
      });
    } else {
      setEditingDriver(null);
      setFormData({
        name: '',
        username: '',
        password: '123456',
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (!formData.name || !formData.username) {
      toast.error('请填写完整信息');
      return;
    }

    try {
      if (editingDriver) {
        const updates: any = {
          name: formData.name,
        };
        if (formData.password) {
          updates.password = formData.password;
        }
        await updateDriver(editingDriver.id, updates);
        await createOperationLog({
          operator_id: user.id,
          operator_name: user.name,
          action: 'update',
          target_type: 'driver',
          target_id: editingDriver.id,
          detail: `修改司机信息：${formData.name}`,
        });
        toast.success('修改成功');
      } else {
        const newDriver = await createDriver({
          name: formData.name,
          username: formData.username,
          password: formData.password,
          is_active: true,
        });
        await createOperationLog({
          operator_id: user.id,
          operator_name: user.name,
          action: 'create',
          target_type: 'driver',
          target_id: newDriver.id,
          detail: `新增司机：${formData.name}`,
        });
        toast.success('新增成功');
      }
      setDialogOpen(false);
      loadDrivers();
    } catch (error) {
      console.error('操作失败:', error);
      toast.error('操作失败，请重试');
    }
  };

  const handleToggleActive = async (driver: Driver) => {
    if (!user) return;
    try {
      await updateDriver(driver.id, { is_active: !driver.is_active });
      await createOperationLog({
        operator_id: user.id,
        operator_name: user.name,
        action: 'update',
        target_type: 'driver',
        target_id: driver.id,
        detail: `${driver.is_active ? '停用' : '启用'}司机：${driver.name}`,
      });
      toast.success(driver.is_active ? '已停用' : '已启用');
      loadDrivers();
    } catch (error) {
      console.error('操作失败:', error);
      toast.error('操作失败，请重试');
    }
  };

  const handleResetPassword = async () => {
    if (!user || !resetPasswordDriver) return;
    try {
      await updateDriver(resetPasswordDriver.id, { password: '123456' });
      await createOperationLog({
        operator_id: user.id,
        operator_name: user.name,
        action: 'update',
        target_type: 'driver',
        target_id: resetPasswordDriver.id,
        detail: `重置密码：${resetPasswordDriver.name}`,
      });
      toast.success('密码已重置为 123456');
      setResetPasswordDriver(null);
    } catch (error) {
      console.error('重置密码失败:', error);
      toast.error('重置密码失败，请重试');
    }
  };

  const filteredDrivers = drivers.filter(driver =>
    driver.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold border-b pb-4 mb-6">司机管理</h1>
          <div className="flex items-center gap-2">
            <Button onClick={loadDrivers} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
            <Button onClick={() => handleOpenDialog()} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              新增司机
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="mb-4">
              <Input
                placeholder="搜索司机姓名..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>姓名</TableHead>
                    <TableHead>账号</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>创建时间</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDrivers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    filteredDrivers.map((driver) => (
                      <TableRow key={driver.id}>
                        <TableCell className="font-medium">{driver.name}</TableCell>
                        <TableCell>{driver.username}</TableCell>
                        <TableCell>
                          {driver.is_active ? (
                            <Badge variant="outline" className="bg-success/10 text-success border-success">
                              在职
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-muted text-muted-foreground">
                              离职
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>{format(new Date(driver.created_at), 'yyyy-MM-dd')}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenDialog(driver)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              编辑
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleActive(driver)}
                            >
                              <Power className="h-4 w-4 mr-1" />
                              {driver.is_active ? '停用' : '启用'}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setResetPasswordDriver(driver)}
                            >
                              <Key className="h-4 w-4 mr-1" />
                              重置密码
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 新增/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingDriver ? '编辑司机' : '新增司机'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>姓名</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="请输入姓名"
              />
            </div>
            <div className="space-y-2">
              <Label>账号</Label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="请输入账号"
                disabled={!!editingDriver}
              />
            </div>
            {!editingDriver && (
              <div className="space-y-2">
                <Label>密码</Label>
                <Input
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="默认密码：123456"
                />
              </div>
            )}
            {editingDriver && (
              <div className="space-y-2">
                <Label>新密码（留空则不修改）</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="留空则不修改密码"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit}>
              {editingDriver ? '保存' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置密码确认对话框 */}
      <AlertDialog open={!!resetPasswordDriver} onOpenChange={(open) => !open && setResetPasswordDriver(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认重置密码</AlertDialogTitle>
            <AlertDialogDescription>
              确定要将 {resetPasswordDriver?.name} 的密码重置为 123456 吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword}>确认</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default DriversPage;
