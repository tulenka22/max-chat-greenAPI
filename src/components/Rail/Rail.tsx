// узкая панель навигации, работает тут только переключатель темы

import { useState } from 'react';

import { useTheme } from '../../app/themeContext';
import { IconChats, IconMoon, IconSun } from '../icons';
import styles from './Rail.module.css';

export function Rail() {
  const { theme, toggleTheme } = useTheme();
  const [active, setActive] = useState(true);

  return (
    <nav className={styles.rail} aria-label="Навигация">
      <div className={styles.nav}>
        <button
          type="button"
          className={styles.tab}
          data-active={active}
          onClick={() => setActive(true)}
          title="Все"
        >
          <IconChats />
        </button>
      </div>

      <button
        type="button"
        className={styles.tab}
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Светлая тема' : 'Тёмная тема'}
      >
        {theme === 'dark' ? <IconSun /> : <IconMoon />}
      </button>
    </nav>
  );
}