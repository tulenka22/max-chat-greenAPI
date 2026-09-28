// обёртка над HTTP API GREEN-API для MAX, доки: https://green-api.com/v3/docs/
// почти у всех методов параметры в query, исключение — deleteNotification,
// у него receiptId идёт ПОСЛЕ токена, иначе инстанс отвечает 401

import { API_URL, POLLING } from './config';
import type {
  CheckAccountResponse,
  ContactInfo,
  InstanceSettings,
  InstanceState,
  ReceiveNotificationResponse,
  SendMessageResponse,
} from './types';

// очередь с задержкой для методов с лимитом 1 запрос/сек, на старте страницы их
// зовут сразу несколько мест и без разведения по времени все ловят один 429
const MIN_METHOD_INTERVAL_MS = 1100;
let lastThrottledCallAt = 0;
let throttleChain: Promise<unknown> = Promise.resolve();

function throttled<T>(fn: () => Promise<T>): Promise<T> {
  const run = throttleChain.then(async () => {
    const wait = MIN_METHOD_INTERVAL_MS - (Date.now() - lastThrottledCallAt);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    lastThrottledCallAt = Date.now();
    return fn();
  });
  // Ошибка потребителя не должна рвать очередь следующих вызовов.
  throttleChain = run.catch(() => undefined);
  return run;
}

// учётные данные инстанса из личного кабинета
export interface Credentials {
  idInstance: string;
  apiTokenInstance: string;
}

// сетевая проблема или неуспешный ответ GREEN-API
export class GreenApiError extends Error {
  readonly status: number | undefined;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'GreenApiError';
    this.status = status;
  }
}

// настройки для приёма по HTTP API, webhookUrl обязан быть пустым,
// иначе уведомления уедут на webhook и receive/delete отдают 400
export const HTTP_API_SETTINGS: InstanceSettings = {
  webhookUrl: '',
  incomingWebhook: 'yes',
  outgoingWebhook: 'yes',
  stateWebhook: 'yes',
};

type QueryValue = string | number;

interface CallOptions {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  query?: Record<string, QueryValue>;
  // доп. сегмент пути после токена, например receiptId у deleteNotification
  pathSuffixAfterToken?: string | number;
  signal?: AbortSignal;
}

function buildUrl(
  creds: Credentials,
  method: string,
  query?: Record<string, QueryValue>,
  pathSuffixAfterToken?: string | number,
): string {
  let base =
    `${API_URL}/waInstance${encodeURIComponent(creds.idInstance)}` +
    `/${method}/${encodeURIComponent(creds.apiTokenInstance)}`;

  if (pathSuffixAfterToken !== undefined) {
    base += `/${pathSuffixAfterToken}`;
  }

  if (!query) return base;

  const search = new URLSearchParams(
    Object.entries(query).map(([key, value]) => [key, String(value)] as [string, string]),
  );
  return `${base}?${search.toString()}`;
}

// вытаскивает человекочитаемый текст ошибки из тела ответа
function extractError(raw: string, status: number): string {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed !== null && typeof parsed === 'object') {
      const record = parsed as Record<string, unknown>;
      for (const key of ['message', 'reason', 'error'] as const) {
        const value = record[key];
        if (typeof value === 'string' && value.trim() !== '') return value.trim();
      }
    }
  } catch {
    // Тело не является JSON — покажем его как есть.
  }
  return raw.trim() || `Запрос завершился с кодом ${status}`;
}

// дёргает GREEN-API и парсит json-ответ, пустое тело даёт undefined
async function call<T>(creds: Credentials, method: string, options: CallOptions = {}): Promise<T | undefined> {
  const hasBody = options.body !== undefined;

  let response: Response;
  try {
    response = await fetch(buildUrl(creds, method, options.query, options.pathSuffixAfterToken), {
      method: options.method ?? 'GET',
      headers: hasBody ? { 'Content-Type': 'application/json' } : undefined,
      body: hasBody ? JSON.stringify(options.body) : undefined,
      signal: options.signal,
    });
  } catch (error) {
    // Отмена запроса пробрасывается как есть, её обрабатывает вызывающий код.
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new GreenApiError(
      `Не удалось соединиться с GREEN-API по адресу ${API_URL}. ` +
        'Проверьте значение VITE_GREEN_API_URL в файле .env.',
    );
  }

  const raw = await response.text().catch(() => '');

  if (!response.ok) {
    throw new GreenApiError(extractError(raw, response.status), response.status);
  }

  if (raw === '') return undefined;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

// состояние инстанса, starting — он ещё поднимается и авторизация может занять до 5 минут
export async function getStateInstance(creds: Credentials, signal?: AbortSignal): Promise<InstanceState> {
  const data = await throttled(() =>
    call<{ stateInstance?: InstanceState }>(creds, 'getStateInstance', { signal }),
  );
  if (!data?.stateInstance) {
    throw new GreenApiError('GREEN-API не вернул состояние инстанса. Проверьте idInstance и apiTokenInstance.');
  }
  return data.stateInstance;
}

// применяем настройки, но вызов перезапускает инстанс и настройки едут минут пять
export async function setSettings(
  creds: Credentials,
  settings: InstanceSettings,
  signal?: AbortSignal,
): Promise<boolean> {
  const data = await throttled(() =>
    call<{ saveSettings?: boolean }>(creds, 'setSettings', {
      method: 'POST',
      body: settings,
      signal,
    }),
  );
  return data?.saveSettings === true;
}

// результат проверки номера получателя
export interface CheckedAccount {
  // id чата в MAX, именно по нему и шлём
  chatId: string;
  fromCache: boolean;
}

// ищем аккаунт получателя в MAX и берём его chatId, номера только РФ и РБ
export async function checkAccount(
  creds: Credentials,
  phoneNumber: string,
  signal?: AbortSignal,
): Promise<CheckedAccount> {
  const digits = phoneNumber.replace(/\D/g, '');

  if (!/^\d{11,12}$/.test(digits)) {
    throw new GreenApiError('Номер должен содержать 11 или 12 цифр в международном формате, например 79991234567.');
  }

  const data = await call<CheckAccountResponse>(creds, 'checkAccount', {
    method: 'POST',
    body: { phoneNumber: Number(digits) },
    signal,
  });

  if (!data) throw new GreenApiError('GREEN-API не вернул ответ на проверку номера.');
  if (data.status === false) throw new GreenApiError(data.reason ?? 'Инстанс не готов к проверке номера.');
  if (!data.exist || !data.chatId) throw new GreenApiError('Аккаунт с таким номером не найден в MAX.');

  return { chatId: data.chatId, fromCache: data.fromCache === true };
}

// шлём текст в чат, снаружи узнаем idMessage
export async function sendMessage(
  creds: Credentials,
  chatId: string,
  text: string,
  signal?: AbortSignal,
): Promise<string> {
  const data = await call<SendMessageResponse>(creds, 'sendMessage', {
    method: 'POST',
    body: { chatId, message: text },
    signal,
  });

  if (!data?.idMessage) {
    throw new GreenApiError('GREEN-API не вернул идентификатор отправленного сообщения.');
  }
  return data.idMessage;
}

// инфо о контакте: имя, имя из контактной книги, аватар и последний заход,
// только для личных чатов, для групп отдельный метод
export async function getContactInfo(
  creds: Credentials,
  chatId: string,
  signal?: AbortSignal,
): Promise<ContactInfo> {
  const data = await call<ContactInfo>(creds, 'getContactInfo', {
    method: 'POST',
    body: { chatId },
    signal,
  });
  if (!data) throw new GreenApiError('GREEN-API не вернул информацию о контакте.');
  return data;
}

// берём одно уведомление из очереди, undefined если за receiveTimeout тишина —
// это штатно, поэтому разбираем ответ максимально мягко
export async function receiveNotification(
  creds: Credentials,
  signal?: AbortSignal,
): Promise<ReceiveNotificationResponse | undefined> {
  const data = await call<Partial<ReceiveNotificationResponse>>(creds, 'receiveNotification', {
    query: { receiveTimeout: POLLING.receiveTimeoutSeconds },
    signal,
  });

  const receiptId = Number(data?.receiptId);
  if (!Number.isFinite(receiptId) || receiptId <= 0 || !data?.body) return undefined;

  return { receiptId, body: data.body };
}

// подтверждаем обработку и чистим очередь, звать сразу после разбора body
// иначе уведомление вернётся повторно, receiptId тут идёт после токена
export async function deleteNotification(
  creds: Credentials,
  receiptId: number,
  signal?: AbortSignal,
): Promise<boolean> {
  const data = await call<{ result?: boolean }>(creds, 'deleteNotification', {
    method: 'DELETE',
    pathSuffixAfterToken: receiptId,
    signal,
  });
  return data?.result === true;
}
