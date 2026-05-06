import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layouts/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, RefreshCw } from 'lucide-react';
import { getAllServiceStaff, createServiceStaff, updateServiceStaff, deleteServiceStaff, createOperationLog } from '@/db/api';
import type { ServiceStaff } from '@/types/database';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useTranslation } from 'react-i18next';

const StaffPage: React.FC = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [staff, setStaff] = useState<ServiceStaff[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<ServiceStaff | null>(null);
  const [deleteStaff, setDeleteStaff] = useState<ServiceStaff | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    username: '',
    password: '123456',
    role: 'staff' as 'admin' | 'staff',
  });

  useEffect(() => {
    loadStaff();
  }, []);

  const loadStaff = async () => {
    setLoading(true);
    try {
      const data = await getAllServiceStaff();
      setStaff(data);
    } catch (error) {
      console.error('加载客服列表失败:', error);
      toast.error(t('toast.loadStaffFailed'));
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (staffMember?: ServiceStaff) => {
    if (staffMember) {
      setEditingStaff(staffMember);
      setFormData({
        name: staffMember.name,
        username: staffMember.username,
        password: '',
        role: staffMember.role,
      });
    } else {
      setEditingStaff(null);
      setFormData({
        name: '',
        username: '',
        password: '123456',
        role: 'staff',
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
      if (editingStaff) {
        const updates: any = {
          name: formData.name,
          role: formData.role,
        };
        if (formData.password) {
          updates.password = formData.password;
        }
        await updateServiceStaff(editingStaff.id, updates);
        await createOperationLog({
          operator_id: user.id,
          operator_name: user.name,
          action: 'update',
          target_type: 'staff',
          target_id: editingStaff.id,
          detail: `修改客服信息：${formData.name}`,
        });
        toast.success(t('toast.updateSuccess'));
      } else {
        const newStaff = await createServiceStaff({
          name: formData.name,
          username: formData.username,
          password: formData.password,
          role: formData.role,
        });
        await createOperationLog({
          operator_id: user.id,
          operator_name: user.name,
          action: 'create',
          target_type: 'staff',
          target_id: newStaff.id,
          detail: `新增客服：${formData.name}`,
        });
        toast.success(t('toast.createSuccess'));
      }
      setDialogOpen(false);
      loadStaff();
    } catch (error) {
      console.error('操作失败:', error);
      toast.error(t('toast.operationFailed'));
    }
  };

  const handleDelete = async () => {
    if (!user || !deleteStaff) return;

    if (deleteStaff.id === user.id) {
      toast.error(t('staff.cannotDeleteSelf'));
      return;
    }

    try {
      await deleteServiceStaff(deleteStaff.id);
      await createOperationLog({
        operator_id: user.id,
        operator_name: user.name,
        action: 'delete',
        target_type: 'staff',
        target_id: deleteStaff.id,
        detail: `删除客服：${deleteStaff.name}`,
      });
      toast.success(t('toast.deleteSuccess'));
      setDeleteDialogOpen(false);
      setDeleteStaff(null);
      loadStaff();
    } catch (error) {
      console.error('删除失败:', error);
      toast.error(t('toast.deleteFailed'));
    }
  };

  const getRoleName = (role: string) => {
    return role === 'admin' ? t('common.admin') : t('common.staff');
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold border-b pb-4 mb-6">{t('staff.title')}</h1>
          <div className="flex items-center gap-2">
            <Button onClick={loadStaff} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              {t('common.refresh')}
            </Button>
            <Button onClick={() => handleOpenDialog()} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              {t('staff.add')}
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">{t('common.loading')}</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('common.name')}</TableHead>
                    <TableHead>{t('common.username')}</TableHead>
                    <TableHead>{t('common.role')}</TableHead>
                    <TableHead>{t('common.createdAt')}</TableHead>
                    <TableHead>{t('common.actions')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staff.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        {t('common.noData')}
                      </TableCell>
                    </TableRow>
                  ) : (
                    staff.map((staffMember) => (
                      <TableRow key={staffMember.id}>
                        <TableCell className="font-medium">{staffMember.name}</TableCell>
                        <TableCell>{staffMember.username}</TableCell>
                        <TableCell>
                          {staffMember.role === 'admin' ? (
                            <Badge variant="outline" className="bg-primary/10 text-primary border-primary">
                              {t('common.admin')}
                            </Badge>
                          ) : (
                            <Badge variant="outline">{t('common.staff')}</Badge>
                          )}
                        </TableCell>
                        <TableCell>{format(new Date(staffMember.created_at), 'yyyy-MM-dd')}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenDialog(staffMember)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              {t('common.edit')}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                setDeleteStaff(staffMember);
                                setDeleteDialogOpen(true);
                              }}
                              disabled={staffMember.id === user?.id}
                            >
                              <Trash2 className="h-4 w-4 mr-1" />
                              {t('common.delete')}
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
            <DialogTitle>{editingStaff ? t('staff.edit') : t('staff.add')}</DialogTitle>
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
                disabled={!!editingStaff}
              />
            </div>
            {!editingStaff && (
              <div className="space-y-2">
                <Label>{t('common.password')}</Label>
                <Input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder={t('common.defaultPassword')}
                />
              </div>
            )}
            {editingStaff && (
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
            <div className="space-y-2">
              <Label>{t('common.role')}</Label>
              <Select
                value={formData.role}
                onValueChange={(value: 'admin' | 'staff') => setFormData({ ...formData, role: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{t('common.admin')}</SelectItem>
                  <SelectItem value="staff">{t('common.staff')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSubmit}>
              {editingStaff ? t('common.save') : t('common.add')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 删除确认对话框 */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('common.delete')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('staff.deleteDescription', { name: deleteStaff?.name })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>{t('common.delete')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
};

export default StaffPage;
