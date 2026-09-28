// состояние чата: подключение к GREEN-API, чтение очереди уведомлений и отправка сообщений

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ReactNode } from 'react';

import { CREDENTIALS_STORAGE_KEY, POLLING } from '../api/config';
import * as greenApi from '../api/greenApi';
import type { Credentials } from '../api/greenApi';
import type { GreenApiNotification, InstanceState } from '../api/types';
import type { ChatSummary, ConnectionState, MessageStatus } from '../types';
import { createLocalId, formatPhone, nowSeconds, resolveChatTitle } from '../utils/format';
import { ChatContext } from './chatContext';
import type { ChatContextValue } from './chatContext';
import { chatReducer, initialChatState } from './chatReducer';

// человекочитаемые пояснения к состояниям инстанса
const STATE_HINTS: Record<InstanceState, string> = {
  authorized: 'Инстанс авторизован.',
  notAuthorized: 'Инстанс не авторизован. Отсканируйте QR-код в личном кабинете GREEN-API.',
  starting: 'Инстанс запускается — авторизация может занять до 5 минут.',
  blocked: 'Инстанс временно недоступен (заблокирован на стороне GREEN-API).',
  suspended:
    'На аккаунте MAX действуют ограничения: отправка доступна только тем, кто сохранил ваш номер в контактах.',
  pendingPassword: 'Для инстанса требуется облачный пароль (метод SendAuthorizationPassword).',
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function loadCredentials(): Credentials | null {
  try {
    const raw = localStorage.getItem(CREDENTIALS_STORAGE_KEY);
    if (!raw) return null;

    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object') return null;

    const { idInstance, apiTokenInstance } = parsed as Record<string, unknown>;
    if (typeof idInstance !== 'string' || typeof apiTokenInstance !== 'string') return null;
    if (idInstance.trim() === '' || apiTokenInstance.trim() === '') return null;

    return { idInstance: idInstance.trim(), apiTokenInstance: apiTokenInstance.trim() };
  } catch {
    return null;
  }
}

function storeCredentials(creds: Credentials): void {
  try {
    localStorage.setItem(CREDENTIALS_STORAGE_KEY, JSON.stringify(creds));
  } catch {
    // Приватный режим браузера — просто продолжим без сохранения.
  }
}

function clearStoredCredentials(): void {
  try {
    localStorage.removeItem(CREDENTIALS_STORAGE_KEY);
  } catch {
    // Игнорируем.
  }
}

// приводит ошибку API к понятному пользователю виду
function describeError(error: unknown): string {
  if (error instanceof greenApi.GreenApiError) {
    if (error.status === 401) return 'Неверный apiTokenInstance.';
    if (error.status === 403) return 'Неверный idInstance или apiTokenInstance.';
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return 'Непредвиденная ошибка.';
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(chatReducer, initialChatState);
  const [credentials, setCredentials] = useState<Credentials | null>(loadCredentials);
  const [instanceState, setInstanceState] = useState<InstanceState | null>(null);
  const [connection, setConnection] = useState<ConnectionState>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // разбор одного уведомления из очереди, без зависимостей
  const handleNotification = useCallback((notification: GreenApiNotification) => {
    switch (notification.typeWebhook) {
      case 'incomingMessageReceived': {
        const { chatId, chatType, senderName } = notification.senderData;

        dispatch({
          type: 'chat/added',
          chat: { id: chatId, title: resolveChatTitle(senderName, chatType, chatId) },
        });

        dispatch({
          type: 'message/added',
          message: {
            id: notification.idMessage,
            chatId,
            text: notification.messageData.textMessageData.textMessage,
            outgoing: false,
            timestamp: notification.timestamp,
            status: 'received',
          },
        });
        break;
      }

      case 'outgoingMessageStatus': {
        const status: MessageStatus =
          notification.status === 'delivered' || notification.status === 'read' ? notification.status : 'failed';

        dispatch({
          type: 'message/status',
          idMessage: notification.idMessage,
          status,
          error: status === 'failed' ? (notification.description ?? 'Сообщение не доставлено') : undefined,
        });
        break;
      }

      case 'stateInstanceChanged':
        setInstanceState(notification.stateInstance);
        break;
    }
  }, []);

  // set chatId, для которых уже летит GetContactInfo, чтобы не дублировать
  const pendingContactInfo = useRef(new Set<string>());

  // лениво подтягиваем имя, аватар и время последнего захода, ошибки глотаем
  const enrichChatInfo = useCallback((chatId: string) => {
    if (!credentials || pendingContactInfo.current.has(chatId)) return;
    pendingContactInfo.current.add(chatId);

    void (async () => {
      try {
        const info = await greenApi.getContactInfo(credentials, chatId);

        const contactName = info.contactName?.trim() ?? '';
        const name = info.name?.trim() ?? '';
        const title = contactName || name;

        dispatch({
          type: 'chat/info',
          chatId,
          info: {
            ...(title !== '' ? { title } : {}),
            ...(info.avatar ? { avatar: info.avatar } : {}),
            ...(name !== '' ? { name } : {}),
            ...(contactName !== '' ? { contactName } : {}),
            ...(info.lastSeen !== undefined ? { lastSeen: info.lastSeen } : {}),
          },
        });
      } catch {
        // Данные не получились — не критично.
      } finally {
        pendingContactInfo.current.delete(chatId);
      }
    })();
  }, [credentials]);

  // крутим очередь уведомлений, пока заданы учётные данные, стоп через AbortController
  useEffect(() => {
    if (!credentials) return;

    const controller = new AbortController();

    const run = async () => {
      setConnection('connecting');

      while (!controller.signal.aborted) {
        try {
          const notification = await greenApi.receiveNotification(credentials, controller.signal);

          if (notification) {
            const { receiptId, body } = notification;

            try {
              handleNotification(body);

              // Для новых входящих из личных чатов подтягиваем имя/аватар (фоном).
              if (body.typeWebhook === 'incomingMessageReceived' && body.senderData.chatType === 'user') {
                enrichChatInfo(body.senderData.chatId);
              }
            } finally {
              // Подтверждаем приём обязательным DeleteNotification: пока оно не
              // удалено, уведомление стоит в голове очереди и блокирует входящие.
              let deleted = false;
              for (let attempt = 0; attempt < POLLING.deleteMaxAttempts && !deleted; attempt++) {
                try {
                  deleted = await greenApi.deleteNotification(credentials, receiptId, controller.signal);
                } catch {
                  deleted = false;
                }
                if (!deleted && !controller.signal.aborted) await sleep(POLLING.deleteRetryDelayMs);
              }

              // Не свалили молча в тапок: показываем причину блокировки в очереди.
              if (!deleted && !controller.signal.aborted) {
                setConnection('error');
                setConnectionError(
                  `Не удалось подтвердить приём уведомления №${receiptId}. Оно останется в очереди и будет перечитываться — входящие могут не отображаться.`,
                );
              }
            }
            continue;
          }

          setConnection('online');
          setConnectionError(null);
          await sleep(POLLING.idleDelayMs);
        } catch (error) {
          if (controller.signal.aborted) break;

          // Долгий опрос ReceiveNotification может быть оборван шлюзом/прокси
          // с 408 (Request Timeout). По смыслу это «уведомлений не было» —
          // молча ждём и продолжаем, а не вешаем красное «ошибка».
          if (error instanceof greenApi.GreenApiError && error.status === 408) {
            setConnection('online');
            setConnectionError(null);
            continue;
          }

          setConnection('error');
          setConnectionError(describeError(error));
          await sleep(POLLING.errorDelayMs);
        }
      }
    };

    void run();

    return () => {
      controller.abort();
    };
  }, [credentials, handleNotification, enrichChatInfo]);

  // при загрузке проверяем токен, протухший (401/403) сбрасываем на экран входа
  useEffect(() => {
    if (!credentials) return;

    const controller = new AbortController();

    const verify = async () => {
      try {
        const currentState = await greenApi.getStateInstance(credentials, controller.signal);
        if (controller.signal.aborted) return;

        setInstanceState(currentState);
        if (currentState !== 'authorized') {
          setConnection('error');
          setConnectionError(STATE_HINTS[currentState]);
        }
      } catch (error) {
        if (controller.signal.aborted) return;

        if (error instanceof greenApi.GreenApiError && (error.status === 401 || error.status === 403)) {
          clearStoredCredentials();
          setCredentials(null);
          return;
        }

        setConnectionError(describeError(error));
      }
    };

    void verify();

    return () => {
      controller.abort();
    };
  }, [credentials]);

  const login = useCallback(async (next: Credentials) => {
    setConnection('connecting');
    setConnectionError(null);

    const currentState = await greenApi.getStateInstance(next);
    setInstanceState(currentState);

    if (currentState !== 'authorized') {
      throw new greenApi.GreenApiError(STATE_HINTS[currentState]);
    }

    // Включаем получение уведомлений по HTTP API. Метод перезапускает инстанс,
    // поэтому его сбой не должен блокировать вход — предупреждаем и продолжаем.
    try {
      await greenApi.setSettings(next, greenApi.HTTP_API_SETTINGS);
    } catch (error) {
      setConnectionError(
        `Не удалось включить приём уведомлений: ${describeError(error)}. Отправка работает, входящие — нет.`,
      );
    }

    storeCredentials(next);
    dispatch({ type: 'reset' });
    setCredentials(next);
  }, []);

  const logout = useCallback(() => {
    clearStoredCredentials();
    setCredentials(null);
    setInstanceState(null);
    setConnection('idle');
    setConnectionError(null);
    dispatch({ type: 'reset' });
  }, []);

  const createChat = useCallback(
    async (phone: string) => {
      if (!credentials) throw new greenApi.GreenApiError('Нет подключения к GREEN-API.');

      const account = await greenApi.checkAccount(credentials, phone);
      // Временный лог для отладки: сырой ответ CheckAccount.
      console.log('checkAccount response:', account);

      const { chatId } = account;

      dispatch({
        type: 'chat/added',
        chat: { id: chatId, title: formatPhone(phone), phone },
        select: true,
      });

      // Подтягиваем имя/аватар/«был в сети» — чат создан по номеру, данных пока нет.
      enrichChatInfo(chatId);
    },
    [credentials, enrichChatInfo],
  );

  const selectChat = useCallback((chatId: string) => {
    dispatch({ type: 'chat/selected', chatId });
  }, []);

  const closeActiveChat = useCallback(() => {
    dispatch({ type: 'chat/selected', chatId: null });
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!credentials) throw new greenApi.GreenApiError('Нет подключения к GREEN-API.');

      const chatId = state.activeChatId;
      if (!chatId) throw new greenApi.GreenApiError('Сначала выберите чат.');

      const body = text.trim();
      if (body === '') return;

      // Оптимистичное добавление: пузырь появляется сразу, до ответа API.
      const tempId = createLocalId();
      dispatch({
        type: 'message/added',
        message: {
          id: tempId,
          chatId,
          text: body,
          outgoing: true,
          timestamp: nowSeconds(),
          status: 'pending',
        },
      });

      try {
        const idMessage = await greenApi.sendMessage(credentials, chatId, body);
        dispatch({ type: 'message/confirmed', tempId, idMessage });
      } catch (error) {
        dispatch({ type: 'message/status', idMessage: tempId, status: 'failed', error: describeError(error) });
      }
    },
    [credentials, state.activeChatId],
  );

  const clearConnectionError = useCallback(() => setConnectionError(null), []);

  const chats = useMemo<ChatSummary[]>(
    () =>
      Object.values(state.chats)
        .map((chat) => {
          const bucket = state.messages[chat.id] ?? [];
          const lastMessage = bucket[bucket.length - 1];
          return { ...chat, lastMessage, lastActivity: lastMessage?.timestamp ?? 0 };
        })
        .sort((a, b) => b.lastActivity - a.lastActivity),
    [state.chats, state.messages],
  );

  const activeMessages = useMemo(() => {
    if (!state.activeChatId) return [];
    return state.messages[state.activeChatId] ?? [];
  }, [state.activeChatId, state.messages]);

  const value = useMemo<ChatContextValue>(
    () => ({
      chats,
      activeMessages,
      activeChatId: state.activeChatId,
      credentials,
      instanceState,
      connection,
      connectionError,
      login,
      logout,
      createChat,
      selectChat,
      closeActiveChat,
      sendMessage,
      clearConnectionError,
    }),
    [
      chats,
      activeMessages,
      state.activeChatId,
      credentials,
      instanceState,
      connection,
      connectionError,
      login,
      logout,
      createChat,
      selectChat,
      closeActiveChat,
      sendMessage,
      clearConnectionError,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
