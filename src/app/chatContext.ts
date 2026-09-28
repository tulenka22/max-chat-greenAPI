//
// Контекст дохода к состоянию чата.
//
//Вынесен отдельно от <ChatProvider>, чтобы файл содержал только не-компоненты:
// это нужно для корректного Fast Refresh при разработке.
//

import { createContext, useContext } from 'react';

import type { Credentials } from '../api/greenApi';
import type { InstanceState } from '../api/types';
import type { ChatSummary, ConnectionState, Message } from '../types';

export interface ChatContextValue {
  //  Чаты, отсортированные по свежести последнего сообщения. 
  chats: ChatSummary[];
  // Сообщения открытого чата. 
  activeMessages: Message[];
  activeChatId: string | null;
  credentials: Credentials | null;
  instanceState: InstanceState | null;
  connection: ConnectionState;
  connectionError: string | null;
  login: (creds: Credentials) => Promise<void>;
  logout: () => void;
  createChat: (phone: string) => Promise<void>;
  selectChat: (chatId: string) => void;
  closeActiveChat: () => void;
  sendMessage: (text: string) => Promise<void>;
  clearConnectionError: () => void;
}

export const ChatContext = createContext<ChatContextValue | null>(null);

export function useChat(): ChatContextValue {
  const context = useContext(ChatContext);
  if (!context) throw new Error('useChat можно вызывать только внутри <ChatProvider>.');
  return context;
}
