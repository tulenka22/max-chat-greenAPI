// чистый редьюсер: чаты, сообщения, статусы, непрочитанные
// вынесен отдельно, чтобы логику читать и тестировать без react

import type { Chat, Message, MessageStatus } from '../types';

export interface ChatState {
  // чаты по chatId
  chats: Record<string, Chat>;
  // сообщения по chatId, по порядку
  messages: Record<string, Message[]>;
  // какой чат открыт сейчас
  activeChatId: string | null;
}

export const initialChatState: ChatState = {
  chats: {},
  messages: {},
  activeChatId: null,
};

export type ChatAction =
  | { type: 'chat/added'; chat: Chat; select?: boolean }
  | { type: 'chat/selected'; chatId: string | null }
  | { type: 'chat/info'; chatId: string; info: Partial<Pick<Chat, 'title' | 'avatar' | 'name' | 'contactName' | 'lastSeen' | 'phone'>> }
  | { type: 'message/added'; message: Message }
  | { type: 'message/confirmed'; tempId: string; idMessage: string }
  | { type: 'message/status'; idMessage: string; status: MessageStatus; error?: string }
  | { type: 'reset' };

// добавить чат, опционально сделать активным
function withChat(state: ChatState, chat: Chat, select: boolean): ChatState {
  // Слияние, а не замена: чат, созданный по номеру телефона, сохраняет `phone`,
  // когда позже приходит уведомление с реальным именем собеседника из MAX.
  const existing = state.chats[chat.id];
  const chats = {
    ...state.chats,
    [chat.id]: { ...existing, ...chat, unreadCount: existing?.unreadCount ?? chat.unreadCount ?? 0 },
  };

  return {
    ...state,
    chats,
    activeChatId: select ? chat.id : (state.activeChatId ?? chat.id),
  };
}

function appendMessage(state: ChatState, message: Message): ChatState {
  const bucket = state.messages[message.chatId] ?? [];

  // Идемпотентность: одно и то же уведомление может прийти повторно,
  // если DeleteNotification не успел подтвердить приём.
  if (bucket.some((item) => item.id === message.id)) return state;

  const chats = { ...state.chats };

  // Входящее в неактивный чат — копим непрочитанные.
  if (!message.outgoing && message.chatId !== state.activeChatId) {
    const chat = chats[message.chatId];
    if (chat) chats[message.chatId] = { ...chat, unreadCount: (chat.unreadCount ?? 0) + 1 };
  }

  return {
    ...state,
    chats,
    messages: { ...state.messages, [message.chatId]: [...bucket, message] },
  };
}

// найти, в каком чате лежит сообщение с таким id
function findChatIdByMessageId(state: ChatState, idMessage: string): string | undefined {
  for (const [chatId, bucket] of Object.entries(state.messages)) {
    if (bucket.some((item) => item.id === idMessage)) return chatId;
  }
  return undefined;
}

export function chatReducer(state: ChatState, action: ChatAction): ChatState {
  switch (action.type) {
    case 'chat/added':
      return withChat(state, action.chat, action.select ?? false);

    case 'chat/selected': {
      const selected = action.chatId;
      // Открытие чата обнуляет счётчик непрочитанных. `null` — закрытие чата.
      const chats =
        selected !== null && (state.chats[selected]?.unreadCount ?? 0) > 0
          ? { ...state.chats, [selected]: { ...state.chats[selected], unreadCount: 0 } }
          : state.chats;

      return { ...state, chats, activeChatId: selected };
    }

    case 'chat/info': {
      // Дополнение чата данными из GetContactInfo. Не затрагивает activeChatId
      // и счётчик непрочитанных, в отличие от chat/added.
      const existing = state.chats[action.chatId];
      if (!existing) return state;

      return {
        ...state,
        chats: {
          ...state.chats,
          [action.chatId]: { ...existing, ...action.info, unreadCount: existing.unreadCount ?? 0 },
        },
      };
    }

    case 'message/added':
      return appendMessage(state, action.message);

    case 'message/confirmed': {
      const chatId = findChatIdByMessageId(state, action.tempId);
      if (!chatId) return state;

      return {
        ...state,
        messages: {
          ...state.messages,
          [chatId]: state.messages[chatId].map((item) =>
            item.id === action.tempId ? { ...item, id: action.idMessage } : item,
          ),
        },
      };
    }

    case 'message/status': {
      const chatId = findChatIdByMessageId(state, action.idMessage);
      if (!chatId) return state;

      return {
        ...state,
        messages: {
          ...state.messages,
          [chatId]: state.messages[chatId].map((item) =>
            item.id === action.idMessage
              ? {
                  ...item,
                  // Прочитанное не откатываем обратно в «доставлено».
                  status: item.status === 'read' && action.status === 'delivered' ? 'read' : action.status,
                  error: action.error,
                }
              : item,
          ),
        },
      };
    }

    case 'reset':
      return initialChatState;

    default:
      return state;
  }
}
