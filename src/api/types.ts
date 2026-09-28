// схемы GREEN-API для HTTP API мессенджера MAX, доки: https://green-api.com/v3/docs/

// состояние инстанса, приходит из GetStateInstance и в stateInstanceChanged
export type InstanceState =
  | 'authorized'
  | 'notAuthorized'
  | 'blocked'
  | 'starting'
  | 'suspended'
  | 'pendingPassword';

// тип собеседника в MAX
export type ChatType = 'user' | 'group' | 'channel' | 'bot';

// общие для всех уведомлений данные инстанса
export interface InstanceData {
  idInstance: number;
  wid: string;
  // v3 — мессенджер MAX, whatsapp — WhatsApp
  typeInstance: string;
}

// отправитель/чат внутри уведомления о входящем сообщении
export interface SenderData {
  chatId: string;
  chatName: string;
  chatType: ChatType;
  // ид отправителя
  sender: string;
  senderName: string;
  senderType: string;
  senderContactName: string;
  // 0, если номер скрыт или чат групповой
  senderPhoneNumber: number;
}

// тело входящего текстового сообщения
export interface TextMessageData {
  // сам текст
  textMessage: string;
  isForwarded?: boolean;
  forwardingScore?: number;
}

// уведомление о входящем текстовом сообщении
export interface IncomingMessageNotification {
  typeWebhook: 'incomingMessageReceived';
  instanceData: InstanceData;
  // юникс-время в секундах
  timestamp: number;
  idMessage: string;
  senderData: SenderData;
  messageData: {
    typeMessage: 'textMessage';
    textMessageData: TextMessageData;
    quotedMessage?: {
      stanzaId: string;
      participant: string;
    };
  };
}

// статусы исходящего сообщения, значения sent в api нет — после отправки первым приходит delivered
export type OutgoingMessageStatus = 'delivered' | 'read' | 'failed' | 'noAccount' | 'notInGroup';

// уведомление о смене статуса отправленного сообщения
export interface OutgoingMessageStatusNotification {
  typeWebhook: 'outgoingMessageStatus';
  // ид чата лежит на верхнем уровне, а не внутри senderData
  chatId: string;
  instanceData: InstanceData;
  timestamp: number;
  idMessage: string;
  status: OutgoingMessageStatus;
  // описание ошибки, заполняется при неуспешном статусе
  description?: string;
}

// уведомление о смене состояния инстанса
export interface StateInstanceChangedNotification {
  typeWebhook: 'stateInstanceChanged';
  instanceData: InstanceData;
  timestamp: number;
  stateInstance: InstanceState;
}

// любое уведомление, которое может прийти в очередь
export type GreenApiNotification =
  | IncomingMessageNotification
  | OutgoingMessageStatusNotification
  | StateInstanceChangedNotification;

// ответ ReceiveNotification
export interface ReceiveNotificationResponse {
  receiptId: number;
  body: GreenApiNotification;
}

// ответ CheckAccount
export interface CheckAccountResponse {
  // есть ли аккаунт получателя в MAX
  exist?: boolean;
  // ид чата в MAX, пустая строка если exist === false
  chatId?: string;
  fromCache?: boolean;
  // 200, но метод описал проблему — значит ответ неуспешный
  status?: boolean;
  reason?: string;
}

// ответ SendMessage
export interface SendMessageResponse {
  idMessage: string;
}

// ответ GetContactInfo
export interface ContactInfo {
  // ссылка на аватар
  avatar?: string;
  // имя из профиля мессенджера MAX
  name?: string;
  // имя из контактной книги, если номер там сохранён
  contactName?: string;
  chatId: string;
  chatType?: ChatType;
  // когда был в сети последний раз (unix-сек), null если аккаунт не создан
  lastSeen?: number | null;
  // номер телефона, 0 если скрыт
  phoneNumber?: number;
}

// тело SetSettings для включения уведомлений по HTTP API
export interface InstanceSettings {
  // для HTTP API обязательно пустая строка, иначе уведомления улетят на webhook
  webhookUrl: string;
  // уведомления о входящих
  incomingWebhook: 'yes' | 'no';
  // уведомления о статусах отправленных
  outgoingWebhook: 'yes' | 'no';
  // уведомления о смене состояния инстанса
  stateWebhook: 'yes' | 'no';
}
