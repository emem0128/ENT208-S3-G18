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
import { useTranslation } from 'react-i18next';

const DriversPage: React.FC = () => {
  const { t } = useTranslation();
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
      toast.error(t('toast.loadDriversFailed'));
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
      toast.error(t('toast.fillRequired'));
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
        toast.success(t('toast.updateSuccess'));
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
        toast.success(t('toast.createSuccess'));
      }
      setDialogOpen(false);
      loadDrivers();
    } catch (error) {
      console.error('操作失败:', error);
      toast.error(t('toast.operationFailed'));
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
      toast.success(driver.is_active ? t('toast.disabled') : t('toast.enabled'));
      loadDrivers();
    } catch (error) {
      console.error('操作失败:', error);
      toast.error(t('toast.operationFailed'));
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
      toast.success(t('drivers.passwordReset'));
      setResetPasswordDriver(null);
    } catch (error) {
      console.error('重置密码失败:', error);
      toast.error(t('toast.operationFailed'));
    }
  };

  const filteredDrivers = drivers.filter(driver =>
    driver.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold border-b pb-4 mb-6">{t('drivers.title')}</h1>
          <div className="flex items-center gap-2">
            <Button onClick={loadDrivers} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('common.refresh')}
            </Button>
            <Button onClick={() => handleOpenDialog()} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t('drivers.add')}
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="mb-4">
              <Input
                placeholder={t('common.searchDriver')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="max-w-sm"
              />
            </div>

            {loading ? (
              <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead>{t('common.username')}</TableHead>
                    <TableHead>{t('common.status')}</TableHead>
                    <TableHead>{t('common.createdAt')}</TableHead>
                    <TableHead>{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDrivers.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        {t('common.noData')}
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
                              {t('common.active')}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-muted text-muted-foreground">
                              {t('common.inactive')}
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
                              {t('common.edit')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleActive(driver)}
                            >
                              <Power className="h-4 w-4 mr-1" />
                              {driver.is_active ? t('common.disabled') : t('common.enabled')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setResetPasswordDriver(driver)}
                            >
                              <Key className="h-4 w-4 mr-1" />
                              {t('drivers.resetPassword')}
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
            <DialogTitle>{editingDriver ? t('drivers.edit') : t('drivers.add')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('common.name')}</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder={t('common.inputName')}
              />
            </div>
            <div className="space-y-2">
              <Label>{t('common.username')}</Label>
              <Input
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder={t('common.inputUsername')}
                disabled={!!editingDriver}
              />
            </div>
            {!editingDriver && (
              <div className="space-y-2">
                <Label>{t('common.password')}</Label>
                <Input
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={t('common.defaultPassword')}
                />
              </div>
            )}
            {editingDriver && (
              <div className="space-y-2">
                <Label>{t('common.newPassword')}</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={t('common.leavePasswordBlank')}
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit}>
              {editingDriver ? t('common.save') : t('common.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 重置密码确认对话框 */}
      <AlertDialog open={!!resetPasswordDriver} onOpenChange={(open) => !open && setResetPasswordDriver(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('drivers.resetPasswordTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('drivers.resetPasswordDescription', { name: resetPasswordDriver?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleResetPassword}>{t('common.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default DriversPage;
