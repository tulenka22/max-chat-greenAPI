// экран входа с учётками green-api

import { useState } from 'react';
import type { FormEvent } from 'react';

import { API_URL } from '../../api/config';
import { useChat } from '../../app/chatContext';
import styles from './LoginForm.module.css';

export function LoginForm() {
  const { login } = useChat();

  const [idInstance, setIdInstance] = useState('');
  const [apiTokenInstance, setApiTokenInstance] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    setError(null);
    setPending(true);

    try {
      await login({ idInstance: idInstance.trim(), apiTokenInstance: apiTokenInstance.trim() });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Не удалось войти.');
    } finally {
      setPending(false);
    }
  };

  return (
    <main className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <div className={styles.brand}>
          <img className={styles.brandMark} src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" aria-hidden="true" />
          <div>
            <h1 className={styles.title}>Чат MAX</h1>
            <p className={styles.subtitle}>Прототип интерфейса на API GREEN-API</p>
          </div>
        </div>

        <label className={styles.field}>
          <span className={styles.label}>idInstance</span>
          <input
            className={styles.input}
            value={idInstance}
            onChange={(event) => setIdInstance(event.target.value)}
            placeholder="1101000001"
            autoComplete="username"
            inputMode="numeric"
            required
          />
        </label>

        <label className={styles.field}>
          <span className={styles.label}>apiTokenInstance</span>
          <input
            className={styles.input}
            value={apiTokenInstance}
            onChange={(event) => setApiTokenInstance(event.target.value)}
            placeholder="d75b3a66374942c5b3c019c698abc20"
            autoComplete="current-password"
            required
          />
        </label>

        <p className={styles.hint}>
          Взять в <a href="https://console.green-api.com" target="_blank" rel="noreferrer">личном кабинете GREEN-API</a>.
          Инстанс должен быть авторизован (отсканирован QR-код).
        </p>

        <p className={styles.endpoint}>
          API: <code>{API_URL}</code> — меняется в <code>.env</code>, см. README.
        </p>

        {error !== null && (
          <p className={styles.error} role="alert">
            {error}
          </p>
        )}

        <button className={styles.submit} type="submit" disabled={pending}>
          {pending ? 'Подключение…' : 'Войти'}
        </button>
      </form>
    </main>
  );
}
