import { useEffect, useState, useRef } from 'react';
import { useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import type { Order, OrderComment, OrderPlan, OrderPlanStage, OrderFile, Profile } from '../lib/types';
import { STATUS_LABELS, STATUS_COLORS, PRIORITY_LABELS, PRIORITY_COLORS } from '../lib/types';
import {
  ArrowLeft, Clock, Send, Plus, Check, Upload, FileText,
  ChevronDown, ChevronUp, RotateCcw, CheckCircle2, Trash2,
  Calendar, Pencil,
} from 'lucide-react';

interface OrderDetailProps {
  orderId: string;
  onNavigate: (page: string) => void;
}

export function OrderDetail({ orderId, onNavigate }: OrderDetailProps) {
  const { profile } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [manager, setManager] = useState<Profile | null>(null);
  const [developer, setDeveloper] = useState<Profile | null>(null);
  const [comments, setComments] = useState<OrderComment[]>([]);
  const [plan, setPlan] = useState<OrderPlan | null>(null);
  const [stages, setStages] = useState<OrderPlanStage[]>([]);
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [newStageTitle, setNewStageTitle] = useState('');
  const [newStageDesc, setNewStageDesc] = useState('');
  const [showAddStage, setShowAddStage] = useState(false);
  const [planExpanded, setPlanExpanded] = useState(true);
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineValue, setDeadlineValue] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    fetchOrderData();
  }, [orderId]);

  async function fetchOrderData() {
    const { data: orderData } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .maybeSingle();

    if (orderData) {
      setOrder(orderData as Order);
      if (orderData.deadline) {
        const d = new Date(orderData.deadline);
        setDeadlineValue(d.toISOString().split('T')[0]);
      }

      const { data: mgr } = await supabase.from('profiles').select('*').eq('id', orderData.manager_id).maybeSingle();
      if (mgr) setManager(mgr as Profile);

      if (orderData.developer_id) {
        const { data: dev } = await supabase.from('profiles').select('*').eq('id', orderData.developer_id).maybeSingle();
        if (dev) setDeveloper(dev as Profile);
      }
    }

    const { data: commentsData } = await supabase
      .from('order_comments')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: true });

    if (commentsData) {
      setComments(commentsData as OrderComment[]);
      const authorIds = [...new Set(commentsData.map((c: OrderComment) => c.author_id))];
      if (authorIds.length) {
        const { data: profs } = await supabase.from('profiles').select('*').in('id', authorIds);
        if (profs) {
          const map: Record<string, Profile> = {};
          profs.forEach((p: Profile) => { map[p.id] = p; });
          setComments((prev) =>
            prev.map((c) => ({ ...c, author: map[c.author_id] }))
          );
        }
      }
    }

    const { data: planData } = await supabase
      .from('order_plans')
      .select('*')
      .eq('order_id', orderId)
      .maybeSingle();

    if (planData) {
      setPlan(planData as OrderPlan);
      const { data: stagesData } = await supabase
        .from('order_plan_stages')
        .select('*')
        .eq('plan_id', planData.id)
        .order('sort_order', { ascending: true });
      if (stagesData) setStages(stagesData as OrderPlanStage[]);
    }

    const { data: filesData } = await supabase
      .from('order_files')
      .select('*')
      .eq('order_id', orderId)
      .order('created_at', { ascending: false });

    if (filesData) setFiles(filesData as OrderFile[]);

    setLoading(false);
  }

  async function addComment() {
    if (!commentText.trim() || !profile) return;
    const { data, error } = await supabase
      .from('order_comments')
      .insert({ order_id: orderId, author_id: profile.id, content: commentText.trim() })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error adding comment:', error);
      return;
    }
    if (data) {
      setComments((prev) => [...prev, { ...data, author: profile } as OrderComment]);
      setCommentText('');
    }
  }

  async function deleteComment(commentId: string) {
    const { error } = await supabase
      .from('order_comments')
      .delete()
      .eq('id', commentId);

    if (error) {
      console.error('Error deleting comment:', error);
      return;
    }
    setComments((prev) => prev.filter((c) => c.id !== commentId));
  }

  async function createPlan() {
    if (!profile) return;
    const { data, error } = await supabase
      .from('order_plans')
      .insert({ order_id: orderId, developer_id: profile.id })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error creating plan:', error);
      return;
    }
    if (data) setPlan(data as OrderPlan);
  }

  async function addStage() {
    if (!newStageTitle.trim() || !plan) return;
    const { data, error } = await supabase
      .from('order_plan_stages')
      .insert({
        plan_id: plan.id,
        title: newStageTitle.trim(),
        description: newStageDesc.trim(),
        sort_order: stages.length,
      })
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error adding stage:', error);
      return;
    }
    if (data) {
      setStages((prev) => [...prev, data as OrderPlanStage]);
      setNewStageTitle('');
      setNewStageDesc('');
      setShowAddStage(false);
    }
  }

  async function toggleStage(stage: OrderPlanStage) {
    const completed = !stage.completed;
    const { data, error } = await supabase
      .from('order_plan_stages')
      .update({ completed, completed_at: completed ? new Date().toISOString() : null })
      .eq('id', stage.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error toggling stage:', error);
      return;
    }
    if (data) {
      setStages((prev) => prev.map((s) => s.id === stage.id ? data as OrderPlanStage : s));
    }
  }

  async function updateOrderStatus(status: string) {
    if (!order) return;
    const { data, error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', order.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error updating order status:', error);
      return;
    }
    if (data) setOrder(data as Order);
  }

  async function updateDeadline() {
    if (!order) return;
    const { data, error } = await supabase
      .from('orders')
      .update({ deadline: deadlineValue || null })
      .eq('id', order.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('Error updating deadline:', error);
      return;
    }
    if (data) {
      setOrder(data as Order);
      setEditingDeadline(false);
    }
  }

  async function deleteOrder() {
    if (!order) return;
    const { error } = await supabase
      .from('orders')
      .delete()
      .eq('id', order.id);

    if (error) {
      console.error('Error deleting order:', error);
      return;
    }
    onNavigate('orders');
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files?.length || !profile || !order) return;
    setUploading(true);

    const file = e.target.files[0];
    const filePath = `${order.id}/${Date.now()}_${file.name}`;

    const { error: uploadError } = await supabase.storage
      .from('order-files')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    const { data: urlData } = supabase.storage.from('order-files').getPublicUrl(filePath);

    const { error: dbError } = await supabase
      .from('order_files')
      .insert({
        order_id: order.id,
        uploader_id: profile.id,
        file_name: file.name,
        file_url: urlData.publicUrl,
        file_size: file.size,
      });

    if (dbError) {
      console.error('Error saving file record:', dbError);
    } else {
      fetchOrderData();
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function deleteFile(fileId: string, fileUrl: string) {
    const path = fileUrl.split('/order-files/')[1];
    if (path) await supabase.storage.from('order-files').remove([path]);
    await supabase.from('order_files').delete().eq('id', fileId);
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  }

  if (loading || !order) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const isManager = profile?.id === order.manager_id;
  const isDeveloper = profile?.id === order.developer_id;
  const completedStages = stages.filter((s) => s.completed).length;
  const totalStages = stages.length;
  const progressPercent = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <button
        onClick={() => onNavigate('orders')}
        className="flex items-center gap-2 text-slate-500 hover:text-slate-700 text-sm"
      >
        <ArrowLeft className="w-4 h-4" />
        Назад к заказам
      </button>

      {/* Order header */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[order.status]}`}>
            {STATUS_LABELS[order.status]}
          </span>
          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${PRIORITY_COLORS[order.priority]}`}>
            {PRIORITY_LABELS[order.priority]}
          </span>
        </div>

        <h1 className="text-2xl font-bold text-slate-900">{order.title}</h1>
        <p className="text-slate-500 mt-2 whitespace-pre-wrap">{order.description}</p>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5 pt-5 border-t border-slate-100">
          <div>
            <p className="text-xs text-slate-400">Клиент</p>
            <p className="text-sm font-medium text-slate-700">{order.client_name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Менеджер</p>
            <p className="text-sm font-medium text-slate-700">{manager?.full_name || '—'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Разработчик</p>
            <p className="text-sm font-medium text-slate-700">{developer?.full_name || 'Не назначен'}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">Дедлайн</p>
            {editingDeadline ? (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={deadlineValue}
                  onChange={(e) => setDeadlineValue(e.target.value)}
                  className="px-2 py-1 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <button
                  onClick={updateDeadline}
                  className="p-1 text-emerald-600 hover:bg-emerald-50 rounded-lg"
                >
                  <Check className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    setEditingDeadline(false);
                    setDeadlineValue(order.deadline ? new Date(order.deadline).toISOString().split('T')[0] : '');
                  }}
                  className="p-1 text-slate-400 hover:bg-slate-50 rounded-lg"
                >
                  <span className="text-sm">✕</span>
                </button>
              </div>
            ) : (
              <p className="text-sm font-medium text-slate-700 flex items-center gap-1">
                {order.deadline ? (
                  <><Clock className="w-3.5 h-3.5" />{new Date(order.deadline).toLocaleDateString('ru-RU')}</>
                ) : '—'}
                {isManager && (
                  <button
                    onClick={() => setEditingDeadline(true)}
                    className="ml-1 text-slate-400 hover:text-emerald-600 transition-colors"
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Status actions */}
        <div className="flex flex-wrap gap-2 mt-5 pt-5 border-t border-slate-100">
          {isDeveloper && order.status === 'in_progress' && (
            <button
              onClick={() => updateOrderStatus('review')}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Отправить на проверку
            </button>
          )}
          {isManager && order.status === 'review' && (
            <>
              <button
                onClick={() => updateOrderStatus('completed')}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <Check className="w-4 h-4" />
                Принять
              </button>
              <button
                onClick={() => updateOrderStatus('revision')}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium rounded-xl transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                На доработку
              </button>
            </>
          )}
          {isDeveloper && order.status === 'revision' && (
            <button
              onClick={() => updateOrderStatus('in_progress')}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white text-sm font-medium rounded-xl transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Начать доработку
            </button>
          )}

          {/* Delete order button for managers */}
          {isManager && (
            <div className="ml-auto">
              {showDeleteConfirm ? (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-600">Удалить заказ?</span>
                  <button
                    onClick={deleteOrder}
                    className="px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white text-sm font-medium rounded-lg transition-colors"
                  >
                    Да, удалить
                  </button>
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="px-3 py-1.5 text-slate-500 text-sm hover:text-slate-700"
                  >
                    Отмена
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="flex items-center gap-2 px-4 py-2 text-red-500 hover:bg-red-50 text-sm font-medium rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Удалить заказ
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Plan section */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <button
          onClick={() => setPlanExpanded(!planExpanded)}
          className="w-full flex items-center justify-between p-6 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-900">План выполнения</h2>
            {totalStages > 0 && (
              <span className="text-sm text-slate-400">
                {completedStages}/{totalStages} ({progressPercent}%)
              </span>
            )}
          </div>
          {planExpanded ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
        </button>

        {planExpanded && (
          <div className="px-6 pb-6">
            {totalStages > 0 && (
              <div className="w-full bg-slate-100 rounded-full h-2 mb-4">
                <div
                  className="bg-emerald-500 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            )}

            {!plan && isDeveloper && order.developer_id === profile?.id ? (
              <button
                onClick={createPlan}
                className="flex items-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-600 text-sm font-medium rounded-xl hover:bg-emerald-100 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Создать план
              </button>
            ) : !plan ? (
              <p className="text-sm text-slate-400">План пока не создан</p>
            ) : plan ? (
              <div className="space-y-2">
                {stages.map((stage) => (
                  <div
                    key={stage.id}
                    className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                      stage.completed ? 'bg-emerald-50' : 'bg-slate-50'
                    }`}
                  >
                    <button
                      onClick={() => toggleStage(stage)}
                      className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                        stage.completed
                          ? 'bg-emerald-500 border-emerald-500'
                          : 'border-slate-300 hover:border-emerald-400'
                      }`}
                    >
                      {stage.completed && <Check className="w-3 h-3 text-white" />}
                    </button>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium ${stage.completed ? 'text-emerald-700 line-through' : 'text-slate-700'}`}>
                        {stage.title}
                      </p>
                      {stage.description && (
                        <p className="text-xs text-slate-400 mt-0.5">{stage.description}</p>
                      )}
                    </div>
                  </div>
                ))}

                {isDeveloper && order.developer_id === profile?.id && (
                  <div>
                    {showAddStage ? (
                      <div className="bg-slate-50 rounded-xl p-4 space-y-3">
                        <input
                          type="text"
                          value={newStageTitle}
                          onChange={(e) => setNewStageTitle(e.target.value)}
                          placeholder="Название этапа"
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                        <textarea
                          value={newStageDesc}
                          onChange={(e) => setNewStageDesc(e.target.value)}
                          placeholder="Описание (необязательно)"
                          rows={2}
                          className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={addStage}
                            className="px-4 py-2 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-500"
                          >
                            Добавить
                          </button>
                          <button
                            onClick={() => { setShowAddStage(false); setNewStageTitle(''); setNewStageDesc(''); }}
                            className="px-4 py-2 text-slate-500 text-sm hover:text-slate-700"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        onClick={() => setShowAddStage(true)}
                        className="flex items-center gap-2 px-3 py-2 text-emerald-600 text-sm font-medium hover:bg-emerald-50 rounded-lg transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                        Добавить этап
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* Files section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Файлы</h2>
          {(isDeveloper || isManager) && (
            <label className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 text-sm font-medium rounded-xl hover:bg-emerald-100 transition-colors cursor-pointer">
              <Upload className="w-4 h-4" />
              {uploading ? 'Загрузка...' : 'Загрузить'}
              <input
                ref={fileInputRef}
                type="file"
                onChange={uploadFile}
                className="hidden"
                disabled={uploading}
              />
            </label>
          )}
        </div>

        {files.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Файлов пока нет</p>
        ) : (
          <div className="space-y-2">
            {files.map((file) => (
              <div key={file.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <FileText className="w-5 h-5 text-slate-400 flex-shrink-0" />
                <a
                  href={file.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 text-sm text-slate-700 hover:text-emerald-600 truncate"
                >
                  {file.file_name}
                </a>
                <span className="text-xs text-slate-400">
                  {file.file_size > 0 ? `${(file.file_size / 1024).toFixed(1)} KB` : ''}
                </span>
                {(file.uploader_id === profile?.id || isManager) && (
                  <button
                    onClick={() => deleteFile(file.id, file.file_url)}
                    className="text-slate-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Comments section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Комментарии</h2>

        <div className="space-y-4 mb-4 max-h-96 overflow-y-auto">
          {comments.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4">Комментариев пока нет</p>
          ) : (
            comments.map((comment) => (
              <div key={comment.id} className="flex gap-3 group">
                <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600 flex-shrink-0">
                  {comment.author?.full_name?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-700">
                      {comment.author?.full_name || 'Неизвестный'}
                    </span>
                    <span className="text-xs text-slate-400">
                      {new Date(comment.created_at).toLocaleString('ru-RU')}
                    </span>
                    {/* Delete comment button - visible to author or order manager */}
                    {(comment.author_id === profile?.id || isManager) && (
                      <button
                        onClick={() => deleteComment(comment.id)}
                        className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all ml-auto"
                        title="Удалить комментарий"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 mt-1">{comment.content}</p>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="flex gap-2">
          <input
            type="text"
            value={commentText}
            onChange={(e) => setCommentText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && addComment()}
            placeholder="Написать комментарий..."
            className="flex-1 px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
          />
          <button
            onClick={addComment}
            disabled={!commentText.trim()}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl transition-colors disabled:opacity-50"
          >
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
