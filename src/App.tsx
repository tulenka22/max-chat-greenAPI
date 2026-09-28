// точка входа: экран авторизации или рабочее пространство чата

import { ChatProvider } from './app/ChatProvider';
import { useChat } from './app/chatContext';
import { ChatSidebar } from './components/ChatSidebar/ChatSidebar';
import { ChatWindow } from './components/ChatWindow/ChatWindow';
import { LoginForm } from './components/LoginForm/LoginForm';
import { Rail } from './components/Rail/Rail';
import styles from './App.module.css';

function Workspace() {
  const { credentials } = useChat();

  if (!credentials) return <LoginForm />;

  return (
    <div className={styles.workspace}>
      <Rail />
      <ChatSidebar />
      <ChatWindow />
    </div>
  );
}

export default function App() {
  return (
    <ChatProvider>
      <Workspace />
    </ChatProvider>
  );
}