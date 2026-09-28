// конфиг подключения к GREEN-API
// apiUrl в доках не приводится, у каждого инстанса свой кластер вида
// https://<cluster>.api.green-api.com — но универсальный хост api.green-api.com
// сам роутит на нужный кластер, поэтому дефолт ниже работает для любого инстанса
// (проверено на кластере 3100), см .env если хочется закрепить свой кластер

// резервный хост, если VITE_GREEN_API_URL не задан
const FALLBACK_API_URL = 'https://api.green-api.com';

// базовый url api без слэша на конце
export const API_URL = (import.meta.env.VITE_GREEN_API_URL?.trim() || FALLBACK_API_URL).replace(/\/+$/, '');

// параметры long-polling очереди уведомлений
export const POLLING = {
  // 10 с хватает с запасом: длинный опрос через шлюз часто обрывается 408,
  // а это равносильно пустой очереди
  receiveTimeoutSeconds: 10,
  // пауза после пустого ответа, то есть очередь была пуста
  idleDelayMs: 300,
  // пауза после ошибки, чтобы не долбить api
  errorDelayMs: 5000,
  // если подтверждение падает, уведомление остаётся в голове очереди и блокирует
  // остальные, поэтому повторяем попытки вместо сдачи с первого раза
  deleteMaxAttempts: 3,
  deleteRetryDelayMs: 800,
} as const;

// максимум длины текста по документации
export const MAX_MESSAGE_LENGTH = 4000;

// ключ, под которым учётные данные лежат в localStorage
export const CREDENTIALS_STORAGE_KEY = 'max-chat.credentials';
