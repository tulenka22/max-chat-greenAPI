// доменные типы приложения, схемы GREEN-API лежат в src/api/types.ts

// у входящих всегда received, у исходящих — доставка
export type MessageStatus = 'received' | 'pending' | 'delivered' | 'read' | 'failed';

// сообщение в ленте чата
export interface Message {
  // idMessage из GREEN-API, до подтверждения отправки — временный local-uuid
  id: string;
  chatId: string;
  text: string;
  outgoing: boolean;
  // юникс-время в секундах
  timestamp: number;
  status: MessageStatus;
  // текст ошибки доставки, заполняется только при failed
  error?: string;
}

// чат с одним собеседником, id — это chatId в терминах MAX
export interface Chat {
  id: string;
  title: string;
  // номер телефона, если чат создан через CheckAccount
  phone?: string;
  // непрочитанные входящие, сбрасывается при открытии чата
  unreadCount?: number;
  // url аватара, приходит из GetContactInfo
  avatar?: string;
  // имя из профиля MAX, поле name в GetContactInfo
  name?: string;
  // имя из контактной книги — для заголовка приоритетнее
  contactName?: string;
  // когда был в сети последний раз (unix-сек), null если аккаунт не создан
  lastSeen?: number | null;
}

// чат с последним сообщением, для боковой панели
export interface ChatSummary extends Chat {
  lastMessage?: Message;
  lastActivity: number;
}

// состояние подключения к очереди уведомлений
export type ConnectionState = 'idle' | 'connecting' | 'online' | 'error';
