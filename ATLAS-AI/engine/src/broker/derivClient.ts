import WebSocket from "ws";

interface PendingRequest {
  resolve: (value: Record<string, unknown>) => void;
  reject: (reason: Error) => void;
}

export class DerivClient {
  private socket?: WebSocket;
  private nextRequestId = 1;
  private readonly pending = new Map<number, PendingRequest>();
  private keepAlive?: ReturnType<typeof setInterval>;

  constructor(
    private readonly appId: string,
    private readonly endpoint: string,
  ) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const url = `${this.endpoint}?app_id=${encodeURIComponent(this.appId)}&l=EN`;
      const socket = new WebSocket(url);
      this.socket = socket;

      socket.on("open", () => {
        this.keepAlive = setInterval(() => {
          if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ ping: 1 }));
        }, 30000);
        // unref: el heartbeat no debe impedir que el proceso termine si el trabajo ya acabó.
        this.keepAlive.unref?.();
        resolve();
      });
      socket.on("message", (data) => this.onMessage(data.toString()));
      socket.on("error", (error) => reject(error instanceof Error ? error : new Error(String(error))));
      socket.on("close", () => this.failAll(new Error("WebSocket cerrado")));
    });
  }

  send(payload: Record<string, unknown>): Promise<Record<string, unknown>> {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error("WebSocket no conectado"));
    }
    const requestId = this.nextRequestId++;
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      socket.send(JSON.stringify({ ...payload, req_id: requestId }));
    });
  }

  async disconnect(): Promise<void> {
    if (this.keepAlive) clearInterval(this.keepAlive);
    const socket = this.socket;
    if (!socket) return;
    socket.close();
    this.failAll(new Error("Desconectado"));
  }

  private onMessage(raw: string): void {
    const message = JSON.parse(raw) as Record<string, unknown>;
    const requestId = message.req_id as number | undefined;
    if (requestId === undefined) return;
    const pending = this.pending.get(requestId);
    if (!pending) return;
    this.pending.delete(requestId);
    if (message.error) {
      const error = message.error as { message?: string; code?: string };
      pending.reject(new Error(error.message ?? error.code ?? "Error de Deriv"));
      return;
    }
    pending.resolve(message);
  }

  private failAll(error: Error): void {
    for (const [, pending] of this.pending) pending.reject(error);
    this.pending.clear();
  }
}
