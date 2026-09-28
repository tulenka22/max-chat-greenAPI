// окно чата: шапка с собеседником, лента и поле ввода

import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, KeyboardEvent } from 'react';

import { MAX_MESSAGE_LENGTH } from '../../api/config';
import { useChat } from '../../app/chatContext';
import type { Message } from '../../types';
import { formatDayLabel, formatLastSeen, initialOf } from '../../utils/format';
import { IconBack, IconSend } from '../icons';
import { MessageBubble } from '../MessageBubble/MessageBubble';
import styles from './ChatWindow.module.css';

const INSTANCE_STATE_TEXT = {
  authorized: 'Инстанс авторизован',
  notAuthorized: 'Инстанс не авторизован — отсканируйте QR-код в личном кабинете',
  starting: 'Инстанс запускается, это занимает до 5 минут',
  blocked: 'Инстанс временно заблокирован',
  suspended: 'На аккаунте MAX действуют ограничения на отправку',
  pendingPassword: 'Требуется облачный пароль инстанса',
} as const;

// группируем сообщения по дням для разделителей в ленте
function groupByDay(messages: Message[]): { label: string; items: Message[] }[] {
  const groups: { label: string; items: Message[] }[] = [];

  for (const message of messages) {
    const label = formatDayLabel(message.timestamp);
    const last = groups[groups.length - 1];

    if (last !== undefined && last.label === label) {
      last.items.push(message);
    } else {
      groups.push({ label, items: [message] });
    }
  }

  return groups;
}

export function ChatWindow() {
  const {
    chats,
    activeChatId,
    activeMessages,
    instanceState,
    connectionError,
    clearConnectionError,
    closeActiveChat,
    sendMessage,
  } = useChat();

  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeChat = chats.find((chat) => chat.id === activeChatId) ?? null;
  const groups = useMemo(() => groupByDay(activeMessages), [activeMessages]);

  // Прокручиваем ленту вниз при появлении нового сообщения.
  useEffect(() => {
    const node = scrollRef.current;
    if (node) node.scrollTop = node.scrollHeight;
  }, [activeMessages.length, activeChatId]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const text = draft.trim();
    if (text === '') return;

    setDraft('');
    void sendMessage(text);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  };

  if (activeChat === null) {
    return (
      <section className={styles.placeholder}>
        <p className={styles.placeholderText}>
          Выберите чат слева или создайте новый по номеру телефона кнопкой «+».
        </p>
      </section>
    );
  }

  const remaining = MAX_MESSAGE_LENGTH - draft.length;
  const showCounter = remaining <= MAX_MESSAGE_LENGTH * 0.1;

  return (
    <section className={styles.window}>
      <header className={styles.header}>
        <button
          type="button"
          className={styles.headerAction}
          data-role="back"
          onClick={closeActiveChat}
          aria-label="К списку чатов"
        >
          <IconBack />
        </button>

        <span className={styles.avatar} aria-hidden="true">
          {activeChat.avatar ? (
            <img className={styles.avatarImg} src={activeChat.avatar} alt="" />
          ) : (
            initialOf(activeChat.title)
          )}
        </span>

        <div className={styles.headerText}>
          <span className={styles.title}>{activeChat.title}</span>
          <span className={styles.status}>
            {formatLastSeen(activeChat.lastSeen) ?? activeChat.phone ?? 'В сети'}
          </span>
        </div>
      </header>

      {instanceState !== null && instanceState !== 'authorized' && (
        <p className={styles.warning} role="status">
          {INSTANCE_STATE_TEXT[instanceState]}
        </p>
      )}

      {connectionError !== null && (
        <p className={styles.error} role="alert">
          <span>{connectionError}</span>
          <button type="button" className={styles.errorClose} onClick={clearConnectionError} aria-label="Скрыть">
            ×
          </button>
        </p>
      )}

      <div className={styles.stream} ref={scrollRef}>
        {activeMessages.length === 0 ? (
          <p className={styles.emptyStream}>Сообщений пока нет — напишите первым.</p>
        ) : (
          groups.map((group) => (
            <div key={group.label}>
              <div className={styles.daySeparator}>
                <span className={styles.dayPill}>{group.label}</span>
              </div>
              {group.items.map((message) => (
                <MessageBubble key={message.id} message={message} />
              ))}
            </div>
          ))
        )}
      </div>

      <form className={styles.composer} onSubmit={handleSubmit}>
        <div className={styles.pill}>
          <textarea
            className={styles.input}
            value={draft}
            onChange={(event) => setDraft(event.target.value.slice(0, MAX_MESSAGE_LENGTH))}
            onKeyDown={handleKeyDown}
            placeholder="Сообщение"
            rows={1}
          />
        </div>
        {showCounter && <span className={styles.counter}>осталось {remaining}</span>}
        <button className={styles.send} type="submit" disabled={draft.trim() === ''} aria-label="Отправить">
          <IconSend />
        </button>
      </form>
    </section>
  );
}