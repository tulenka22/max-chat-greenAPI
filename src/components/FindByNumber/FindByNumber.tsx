// модалка «найти по номеру»
// ждём 10 цифр после +7 или 11 с кодом страны, иначе кнопка неактивна

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';

import { useChat } from '../../app/chatContext';
import { FlagRu } from '../icons';
import styles from './FindByNumber.module.css';

interface FindByNumberProps {
  onClose: () => void;
}

// 10 цифр РФ или 11 с кодом страны
function isValidLength(digits: string): boolean {
  return digits.length === 10 || digits.length === 11;
}

export function FindByNumber({ onClose }: FindByNumberProps) {
  const { createChat } = useChat();

  const [digits, setDigits] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = isValidLength(digits);

  // Закрытие по Escape.
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!valid || pending) return;

    setError(null);
    setPending(true);

    try {
      // Для 10 цифр перед ними был +7; для 11 — пользователь ввёл код страны.
      const phone = digits.length === 10 ? `7${digits}` : digits;
      await createChat(phone);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось найти номер.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="find-title" onClick={(e) => e.stopPropagation()}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Закрыть">
          ×
        </button>

        <h2 id="find-title" className={styles.title}>
          Найти по номеру
        </h2>

        <form onSubmit={handleSubmit}>
          <label className={styles.label} htmlFor="find-phone">
            Номер получателя
          </label>

          <div className={styles.phoneBox}>
            <FlagRu />
            <span className={styles.code}>+7</span>
            <input
              id="find-phone"
              className={styles.input}
              value={digits}
              onChange={(event) => {
                setDigits(event.target.value.replace(/\D/g, '').slice(0, 11));
              }}
              placeholder="999 123-45-67"
              inputMode="tel"
              autoFocus
            />
          </div>

          {error !== null && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <button className={styles.submit} type="submit" disabled={!valid || pending}>
            {pending ? 'Поиск…' : 'Найти в MAX'}
          </button>

          <p className={styles.hint}>РФ: 10 цифр после +7. РБ: 11 цифр, например 37529…</p>
        </form>
      </div>
    </div>
  );
}