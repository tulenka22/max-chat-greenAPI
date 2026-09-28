// пузырь одного сообщения

import type { Message } from '../../types';
import { formatTime } from '../../utils/format';
import styles from './MessageBubble.module.css';

function StatusMark({ status }: { status: Message['status'] }) {
  if (status === 'failed') return <span className={styles.failedMark}>!</span>;
  if (status === 'pending') return <span className={styles.pendingMark}>◷</span>;
  if (status === 'read') return <span className={styles.readMark}>✓✓</span>;
  return <span className={styles.deliveredMark}>✓</span>;
}

export function MessageBubble({ message }: { message: Message }) {
  return (
    <div className={styles.row} data-outgoing={message.outgoing}>
      <div className={styles.bubble} data-outgoing={message.outgoing} data-failed={message.status === 'failed'}>
        <p className={styles.text}>{message.text}</p>
        <span className={styles.meta}>
          <span className={styles.time}>{formatTime(message.timestamp)}</span>
          {message.outgoing && <StatusMark status={message.status} />}
        </span>
        {message.error !== undefined && message.error !== '' && <span className={styles.error}>{message.error}</span>}
      </div>
    </div>
  );
}
