export type Role = 'manager' | 'developer';
export type OrderStatus = 'open' | 'in_progress' | 'review' | 'revision' | 'completed';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
export type ChatType = 'direct' | 'group';

export interface Profile {
  id: string;
  full_name: string;
  role: Role;
  avatar_url: string;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: string;
  title: string;
  description: string;
  status: OrderStatus;
  priority: Priority;
  deadline: string | null;
  manager_id: string;
  developer_id: string | null;
  client_name: string;
  created_at: string;
  updated_at: string;
  manager?: Profile;
  developer?: Profile;
}

export interface OrderComment {
  id: string;
  order_id: string;
  author_id: string;
  content: string;
  created_at: string;
  author?: Profile;
}

export interface OrderPlan {
  id: string;
  order_id: string;
  developer_id: string;
  created_at: string;
  updated_at: string;
  stages?: OrderPlanStage[];
}

export interface OrderPlanStage {
  id: string;
  plan_id: string;
  title: string;
  description: string;
  sort_order: number;
  completed: boolean;
  completed_at: string | null;
  created_at: string;
}

export interface OrderFile {
  id: string;
  order_id: string;
  uploader_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  created_at: string;
  uploader?: Profile;
}

export interface Chat {
  id: string;
  name: string;
  type: ChatType;
  created_by: string;
  created_at: string;
  updated_at: string;
  members?: ChatMember[];
  last_message?: Message;
}

export interface ChatMember {
  id: string;
  chat_id: string;
  user_id: string;
  joined_at: string;
  profile?: Profile;
}

export interface Message {
  id: string;
  chat_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: Profile;
}

export const STATUS_LABELS: Record<OrderStatus, string> = {
  open: 'Открыт',
  in_progress: 'В работе',
  review: 'На проверке',
  revision: 'На доработке',
  completed: 'Выполнен',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  low: 'Низкий',
  medium: 'Средний',
  high: 'Высокий',
  urgent: 'Срочный',
};

export const STATUS_COLORS: Record<OrderStatus, string> = {
  open: 'bg-blue-100 text-blue-800',
  in_progress: 'bg-yellow-100 text-yellow-800',
  review: 'bg-purple-100 text-purple-800',
  revision: 'bg-orange-100 text-orange-800',
  completed: 'bg-green-100 text-green-800',
};

export const PRIORITY_COLORS: Record<Priority, string> = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-50 text-blue-700',
  high: 'bg-orange-50 text-orange-700',
  urgent: 'bg-red-50 text-red-700',
};
