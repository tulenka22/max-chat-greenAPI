// боковая панель: заголовок «чаты» с плюсом, поиск и список чатов
// новый чат создаётся через модалку «найти по номеру»

import { useState } from 'react';

import { useChat } from '../../app/chatContext';
import { formatListTime, initialOf } from '../../utils/format';
import { FindByNumber } from '../FindByNumber/FindByNumber';
import { IconPlus, IconSearch } from '../icons';
import styles from './ChatSidebar.module.css';

const CONNECTION_LABELS = {
  idle: 'не подключено',
  connecting: 'подключение…',
  online: 'на связи',
  error: 'нет связи',
} as const;

export function ChatSidebar() {
  const { chats, activeChatId, connection, selectChat, logout } = useChat();

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [query, setQuery] = useState('');

  const normalized = query.trim().toLowerCase();
  const visibleChats =
    normalized === '' ? chats : chats.filter((chat) => chat.title.toLowerCase().includes(normalized));

  return (
    <aside className={styles.sidebar}>
      <header className={styles.header}>
        <h1 className={styles.title}>Чаты</h1>
        <button className={styles.add} type="button" onClick={() => setIsModalOpen(true)} title="Найти по номеру">
          <IconPlus />
        </button>
      </header>

      <div className={styles.search}>
        <IconSearch className={styles.searchIcon} width={16} height={16} />
        <input
          className={styles.searchInput}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Найти"
          type="search"
        />
      </div>

      <nav className={styles.list} aria-label="Список чатов">
        {visibleChats.length === 0 ? (
          <p className={styles.empty}>
            {chats.length === 0
              ? 'Пока нет ни одного чата. Создайте его по номеру кнопкой «+».'
              : 'Ничего не найдено.'}
          </p>
        ) : (
          visibleChats.map((chat) => (
            <button
              key={chat.id}
              type="button"
              className={styles.item}
              data-active={chat.id === activeChatId}
              onClick={() => selectChat(chat.id)}
            >
              <span className={styles.avatar} aria-hidden="true">
                {chat.avatar ? <img className={styles.avatarImg} src={chat.avatar} alt="" /> : initialOf(chat.title)}
              </span>
              <span className={styles.itemBody}>
                <span className={styles.itemTop}>
                  <span className={styles.itemTitle}>{chat.title}</span>
                  {chat.lastMessage !== undefined && (
                    <span className={styles.itemTime}>{formatListTime(chat.lastMessage.timestamp)}</span>
                  )}
                </span>
                <span className={styles.itemPreview}>
                  {chat.lastMessage === undefined
                    ? 'Нет сообщений'
                    : `${chat.lastMessage.outgoing ? 'Вы: ' : ''}${chat.lastMessage.text}`}
                </span>
              </span>
              {chat.unreadCount !== undefined && chat.unreadCount > 0 && (
                <span className={styles.badge}>{chat.unreadCount > 99 ? '99+' : chat.unreadCount}</span>
              )}
            </button>
          ))
        )}
      </nav>

      <footer className={styles.footer}>
        <span className={styles.connection} data-state={connection}>
          {CONNECTION_LABELS[connection]}
        </span>
        <button type="button" className={styles.logout} onClick={logout} title="Выйти">
          Выйти
        </button>
      </footer>

      {isModalOpen && <FindByNumber onClose={() => setIsModalOpen(false)} />}
    </aside>
  );
}