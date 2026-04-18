import React, { useState, useEffect } from 'react';
import MainLayout from '@/components/layouts/MainLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Power, RefreshCw } from 'lucide-react';
import { getAllFeeTypes, createFeeType, updateFeeType, createOperationLog } from '@/db/api';
import type { FeeType } from '@/types/database';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const FeeTypesPage: React.FC = () => {
  const { user } = useAuth();
  const [feeTypes, setFeeTypes] = useState<FeeType[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFeeType, setEditingFeeType] = useState<FeeType | null>(null);
  const [formData, setFormData] = useState({
    field_name: '',
    display_name: '',
    sort_order: 0,
  });

  useEffect(() => {
    loadFeeTypes();
  }, []);

  const loadFeeTypes = async () => {
    setLoading(true);
    try {
      const data = await getAllFeeTypes();
      setFeeTypes(data);
    } catch (error) {
      console.error('加载费用类型失败:', error);
      toast.error('加载费用类型失败');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (feeType?: FeeType) => {
    if (feeType) {
      setEditingFeeType(feeType);
      setFormData({
        field_name: feeType.field_name,
        display_name: feeType.display_name,
        sort_order: feeType.sort_order,
      });
    } else {
      setEditingFeeType(null);
      setFormData({
        field_name: '',
        display_name: '',
        sort_order: 0,
      });
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!user) return;

    if (!formData.field_name || !formData.display_name) {
      toast.error('请填写完整信息');
      return;
    }

    try {
      if (editingFeeType) {
        await updateFeeType(editingFeeType.id, {
          display_name: formData.display_name,
          sort_order: formData.sort_order,
        });
        await createOperationLog({
          operator_id: user.id,
          operator_name: user.name,
          action: 'update',
          target_type: 'fee_type',
          target_id: editingFeeType.id,
          detail: `修改费用类型：${formData.display_name}`,
        });
        toast.success('修改成功');
      } else {
        const newFeeType = await createFeeType({
          ...formData,
          is_active: true,
        });
        await createOperationLog({
          operator_id: user.id,
          operator_name: user.name,
          action: 'create',
          target_type: 'fee_type',
          target_id: newFeeType.id,
          detail: `新增费用类型：${formData.display_name}`,
        });
        toast.success('新增成功');
      }
      setDialogOpen(false);
      loadFeeTypes();
    } catch (error) {
      console.error('操作失败:', error);
      toast.error('操作失败，请重试');
    }
  };

  const handleToggleActive = async (feeType: FeeType) => {
    if (!user) return;

    if (feeType.field_name === 'other') {
      toast.error('"其他"类型不可停用');
      return;
    }

    try {
      await updateFeeType(feeType.id, { is_active: !feeType.is_active });
      await createOperationLog({
        operator_id: user.id,
        operator_name: user.name,
        action: 'update',
        target_type: 'fee_type',
        target_id: feeType.id,
        detail: `${feeType.is_active ? '停用' : '启用'}费用类型：${feeType.display_name}`,
      });
      toast.success(feeType.is_active ? '已停用' : '已启用');
      loadFeeTypes();
    } catch (error) {
      console.error('操作失败:', error);
      toast.error('操作失败，请重试');
    }
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold border-b pb-4 mb-6">费用类型管理</h1>
          <div className="flex items-center gap-2">
            <Button onClick={loadFeeTypes} variant="outline" size="sm">
              <RefreshCw className="h-4 w-4 mr-2" />
              刷新
            </Button>
            <Button onClick={() => handleOpenDialog()} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              新增费用类型
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="pt-6">
            {loading ? (
              <div className="text-center py-8 text-muted-foreground">加载中...</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>字段名</TableHead>
                    <TableHead>显示名</TableHead>
                    <TableHead>排序</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feeTypes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground">
                        暂无数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    feeTypes.map((feeType) => (
                      <TableRow key={feeType.id}>
                        <TableCell className="font-mono text-sm">{feeType.field_name}</TableCell>
                        <TableCell className="font-medium">{feeType.display_name}</TableCell>
                        <TableCell>{feeType.sort_order}</TableCell>
                        <TableCell>
                          {feeType.is_active ? (
                            <Badge variant="outline" className="bg-success/10 text-success border-success">
                              启用
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-muted text-muted-foreground">
                              停用
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleOpenDialog(feeType)}
                            >
                              <Edit className="h-4 w-4 mr-1" />
                              编辑
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleToggleActive(feeType)}
                              disabled={feeType.field_name === 'other'}
                            >
                              <Power className="h-4 w-4 mr-1" />
                              {feeType.is_active ? '停用' : '启用'}
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

        <div className="text-sm text-muted-foreground">
          <p>注意：</p>
          <ul className="list-disc list-inside space-y-1 mt-2">
            <li>字段名创建后不可修改</li>
            <li>"其他"类型不可停用或删除</li>
            <li>新增费用类型后，需要在数据库中添加对应字段才能使用</li>
          </ul>
        </div>
      </div>

      {/* 新增/编辑对话框 */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFeeType ? '编辑费用类型' : '新增费用类型'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>字段名（英文）</Label>
              <Input
                value={formData.field_name}
                onChange={(e) => setFormData({ ...formData, field_name: e.target.value })}
                placeholder="例如：fee_example"
                disabled={!!editingFeeType}
              />
              {!editingFeeType && (
                <p className="text-xs text-muted-foreground">
                  字段名创建后不可修改，建议使用 fee_ 开头
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>显示名（中文）</Label>
              <Input
                value={formData.display_name}
                onChange={(e) => setFormData({ ...formData, display_name: e.target.value })}
                placeholder="例如：示例费用"
              />
            </div>
            <div className="space-y-2">
              <Label>排序号</Label>
              <Input
                type="number"
                value={formData.sort_order}
                onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) })}
                placeholder="数字越小越靠前"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSubmit}>
              {editingFeeType ? '保存' : '新增'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
};

export default FeeTypesPage;
