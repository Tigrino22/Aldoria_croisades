import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { CharacterView, WorldInfo } from '@aldoria/shared';
import { api, ApiError, getToken, setToken } from './api';

interface Toast {
  id: number;
  text: string;
  kind: 'info' | 'error' | 'success';
}

interface GameState {
  me: CharacterView | null;
  world: (WorldInfo & { population: Record<string, number> }) | null;
  setMe: (me: CharacterView) => void;
  refresh: () => Promise<void>;
  /** Exécute une action et affiche l'erreur éventuelle. Renvoie le résultat ou null. */
  run: <T>(fn: () => Promise<T>, success?: string) => Promise<T | null>;
  toast: (text: string, kind?: Toast['kind']) => void;
  toasts: Toast[];
  logout: () => void;
  /** Incrémenté à chaque notification du serveur : les pages s'en servent pour se rafraîchir. */
  tick: number;
}

const Ctx = createContext<GameState>(null!);
export const useGame = () => useContext(Ctx);

export function GameProvider({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  const [me, setMe] = useState<CharacterView | null>(null);
  const [world, setWorld] = useState<GameState['world']>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [tick, setTick] = useState(0);
  const nextId = useRef(1);

  const toast = useCallback((text: string, kind: Toast['kind'] = 'info') => {
    const id = nextId.current++;
    setToasts((t) => [...t.slice(-3), { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4500);
  }, []);

  const logout = useCallback(() => {
    api('/api/auth/logout', { method: 'POST', body: {} }).catch(() => undefined);
    setToken(null);
    onLogout();
  }, [onLogout]);

  const refresh = useCallback(async () => {
    try {
      const [m, w] = await Promise.all([api<CharacterView>('/api/me'), api('/api/world')]);
      setMe(m);
      setWorld(w);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) logout();
    }
  }, [logout]);

  const run = useCallback(
    async <T,>(fn: () => Promise<T>, success?: string) => {
      try {
        const res = await fn();
        if (res && typeof res === 'object' && 'hpMax' in (res as object)) setMe(res as unknown as CharacterView);
        if (success) toast(success, 'success');
        return res;
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Erreur inattendue', 'error');
        return null;
      }
    },
    [toast],
  );

  useEffect(() => {
    refresh();
  }, [refresh]);

  // Quand une action se termine, on rafraîchit le personnage à l'heure dite.
  useEffect(() => {
    if (!me?.action) return;
    const ms = new Date(me.action.endsAt).getTime() - Date.now() + 700;
    const t = setTimeout(refresh, Math.max(500, ms));
    return () => clearTimeout(t);
  }, [me?.action, refresh]);

  // Canal temps réel avec reconnexion automatique.
  useEffect(() => {
    let ws: WebSocket | null = null;
    let closed = false;
    let retry: ReturnType<typeof setTimeout>;
    const connect = () => {
      const proto = location.protocol === 'https:' ? 'wss' : 'ws';
      ws = new WebSocket(`${proto}://${location.host}/ws?token=${getToken()}`);
      ws.onmessage = (e) => {
        const n = JSON.parse(e.data);
        if (n.type === 'hello') return;
        if (n.type === 'report') toast(n.title);
        if (n.type === 'levelup') toast(`Niveau ${n.level} atteint ! De nouveaux points vous attendent.`, 'success');
        if (n.type === 'attacked') toast(`${n.by} marche sur vous pour vous piller !`, 'error');
        if (n.type === 'battle') toast('Les batailles de la semaine ont eu lieu. Consultez la carte.', 'success');
        refresh();
        setTick((t) => t + 1);
      };
      ws.onclose = () => {
        if (!closed) retry = setTimeout(connect, 3000);
      };
    };
    connect();
    return () => {
      closed = true;
      clearTimeout(retry);
      ws?.close();
    };
  }, [refresh, toast]);

  return <Ctx.Provider value={{ me, world, setMe, refresh, run, toast, toasts, logout, tick }}>{children}</Ctx.Provider>;
}

/** Re-rend le composant chaque seconde (comptes à rebours). */
export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
