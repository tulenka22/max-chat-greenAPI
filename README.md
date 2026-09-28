# Чат MAX — тестовое задание для GREEN-API

Прототип веб-интерфейса для переписки в мессенджере MAX через [GREEN-API](https://green-api.com/max).
React 19 + TypeScript (strict) + Vite + CSS Modules, состояние — `useReducer` + Context,
зависимостей кроме React нет.

## 1. Что умеет

- Вход по `idInstance` + `apiTokenInstance` (хранятся в `localStorage`).
- Создание чата по номеру телефона (`CheckAccount` → `chatId`).
- Подтягивание данных собеседника: имя, аватар, «был в сети» (`GetContactInfo`).
- Отправка текста с оптимистичным обновлением и приём входящих/статусов доставки
  в реальном времени (long polling очереди уведомлений).
- Счётчик непрочитанных, разделители дат в ленте, тёмная/светлая темы.

## 2. Запуск

```bash
cd max-chat
npm install
cp .env.example .env     # Windows PowerShell: copy .env.example .env
npm run dev
```

Откройте `http://localhost:5173`.

### Что нужно от GREEN-API

1. Зарегистрироваться на [console.green-api.com](https://console.green-api.com).
2. Создать инстанс типа **MAX**, отсканировать QR-код авторизации.
3. Взять из карточки инстанса `idInstance` и `apiTokenInstance` и ввести их в форму на сайте.

Адрес API настраивать **не нужно**: по умолчанию работает универсальный хост
`https://api.green-api.com`, который сам направляет запросы на кластер вашего инстанса.
Хотите ходить напрямую — укажите свой `apiUrl` из кабинета в `.env`
(`VITE_GREEN_API_URL=https://<кластер>.api.green-api.com`).

### Команды

| Команда | Что делает |
|---|---|
| `npm run dev` | dev-сервер с HMR |
| `npm run build` | проверка типов + продакшен-сборка в `dist/` |
| `npm run preview` | просмотр собранной версии |
| `npm run lint` | линтер oxlint |

## 3. Структура проекта

```
src/
├── main.tsx              точка входа
├── App.tsx               экран входа ИЛИ рабочее пространство
├── index.css             дизайн-токены тем (CSS-переменные)
├── types.ts              доменные типы: Chat, Message
├── vite-env.d.ts         типизация import.meta.env
│
├── api/                  работа с GREEN-API, без React
│   ├── config.ts         базовый URL, таймауты long polling
│   ├── types.ts          схемы GREEN-API: уведомления, контакты, состояния
│   └── greenApi.ts       HTTP-обёртка: методы и ошибки API
│
├── app/                  состояние
│   ├── chatReducer.ts    редьюсер: чаты, сообщения, статусы
│   ├── chatContext.ts    хук useChat()
│   ├── ChatProvider.tsx  логин, отправка, polling-цикл, GetContactInfo
│   ├── themeContext.ts   тип темы, хук useTheme(), ключ localStorage
│   └── ThemeProvider.tsx переключение тёмной/светлой темы
│
└── components/
    ├── icons.tsx         инлайн-SVG-иконки
    ├── Rail/             панель навигации + тема
    ├── FindByNumber/     модалка «Найти по номеру»
    ├── LoginForm/        форма входа
    ├── ChatSidebar/      «Чаты», список чатов с бейджами
    ├── ChatWindow/       шапка, лента сообщений, поле ввода
    └── MessageBubble/    один пузырь: текст, время, статус
```