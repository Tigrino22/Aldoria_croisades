import { useState } from 'react';
import { getToken } from './api';
import Auth from './components/Auth';
import Layout from './components/Layout';
import { GameProvider } from './game';

export default function App() {
  const [logged, setLogged] = useState(!!getToken());
  if (!logged) return <Auth onLogin={() => setLogged(true)} />;
  return (
    <GameProvider onLogout={() => setLogged(false)}>
      <Layout />
    </GameProvider>
  );
}
