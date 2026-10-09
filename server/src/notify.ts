import type { WebSocket } from 'ws';

export type Notice =
  | { type: 'me' }
  | { type: 'report'; title: string }
  | { type: 'levelup'; level: number }
  | { type: 'attacked'; by: string; arriveAt: string }
  | { type: 'battle'; week: number };

const sockets = new Map<number, Set<WebSocket>>();

export function register(playerId: number, socket: WebSocket) {
  let set = sockets.get(playerId);
  if (!set) sockets.set(playerId, (set = new Set()));
  set.add(socket);
  socket.on('close', () => {
    set!.delete(socket);
    if (set!.size === 0) sockets.delete(playerId);
  });
}

export function broadcast(notice: Notice) {
  const payload = JSON.stringify(notice);
  for (const set of sockets.values()) for (const s of set) if (s.readyState === 1) s.send(payload);
}

/** Les notifications sont collectées pendant une transaction puis envoyées après le COMMIT. */
export class Outbox {
  private items: { playerId: number | 'all'; notice: Notice }[] = [];
  push(playerId: number | null | undefined, notice: Notice) {
    if (playerId) this.items.push({ playerId, notice });
  }
  pushAll(notice: Notice) {
    this.items.push({ playerId: 'all', notice });
  }
  flush() {
    for (const { playerId, notice } of this.items) {
      if (playerId === 'all') {
        broadcast(notice);
        continue;
      }
      const payload = JSON.stringify(notice);
      for (const s of sockets.get(playerId) ?? []) if (s.readyState === 1) s.send(payload);
    }
    this.items = [];
  }
}
