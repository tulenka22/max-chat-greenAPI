// мелкие утилиты форматирования

import type { ChatType } from '../api/types';

// текущее время в секундах, как ожидает грин апи в timestamp
export function nowSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

// id для оптимистично отправленного сообщения
export function createLocalId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `local-${crypto.randomUUID()}`;
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

// приводит номер к читаемому виду, макс знает только номера РФ и РБ
export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if (digits.length === 11) {
    return `+${digits[0]} ${digits.slice(1, 4)} ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  }
  if (digits.length === 12) {
    return `+${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6, 9)}-${digits.slice(9, 11)}-${digits.slice(11, 12)}`;
  }
  return raw;
}

// заголовок чата: имя, иначе группа/канал, иначе сам chatId
export function resolveChatTitle(name: string, chatType: ChatType, chatId: string): string {
  const trimmed = name.trim();
  if (trimmed !== '') return trimmed;
  if (chatType === 'group') return 'Группа';
  if (chatType === 'channel') return 'Канал';
  return chatId;
}

const timeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

// время сообщения, например 14:32
export function formatTime(timestampSeconds: number): string {
  return timeFormatter.format(new Date(timestampSeconds * 1000));
}

// короткая метка для сайдбара: сегодня время, иначе дата
export function formatListTime(timestampSeconds: number): string {
  const date = new Date(timestampSeconds * 1000);
  const today = new Date();

  const isSameDay =
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate();

  if (isSameDay) return formatTime(timestampSeconds);
  if (date.getFullYear() === today.getFullYear()) {
    return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit' }).format(date);
  }
  return new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(date);
}

// заголовок разделителя дней: сегодня, вчера или дата
export function formatDayLabel(timestampSeconds: number): string {
  const date = new Date(timestampSeconds * 1000);
  const today = new Date();

  const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diffDays = Math.round((startOfDay(today) - startOfDay(date)) / 86_400_000);

  if (diffDays === 0) return 'Сегодня';
  if (diffDays === 1) return 'Вчера';
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'long' }).format(date);
}

// первая буква имени для заглушки-аватара
export function initialOf(title: string): string {
  return title.trim().charAt(0).toUpperCase() || '?';
}

const lastSeenTimeFormatter = new Intl.DateTimeFormat('ru-RU', { hour: '2-digit', minute: '2-digit' });

// человекочитаемое «последний раз в сети», null если данных нет
export function formatLastSeen(lastSeen?: number | null): string | null {
  if (typeof lastSeen !== 'number') return null;

  const diff = nowSeconds() - lastSeen;
  if (diff >= 0 && diff < 120) return 'в сети недавно';
  if (diff >= 0 && diff < 3600) return `в сети ${Math.floor(diff / 60)} мин назад`;

  const date = new Date(lastSeen * 1000);
  const today = new Date();
  const startOfDay = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(today) - startOfDay(date)) / 86_400_000);
  const hhmm = lastSeenTimeFormatter.format(date);

  if (dayDiff === 0) return `в сети сегодня в ${hhmm}`;
  if (dayDiff === 1) return `в сети вчера в ${hhmm}`;
  return `в сети ${new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(date)}`;
}
