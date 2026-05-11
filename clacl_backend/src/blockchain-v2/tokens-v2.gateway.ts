import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws-v2',
})
export class TokensV2Gateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly maxConnectionsPerIp = Number(
    process.env.WS_MAX_CONNECTIONS_PER_IP ?? 5,
  );
  private readonly ipConnectionCounts = new Map<string, number>();

  handleConnection(client: Socket) {
    const ip = this.getClientIp(client);
    const current = this.ipConnectionCounts.get(ip) ?? 0;
    if (current >= this.maxConnectionsPerIp) {
      client.emit('error', 'Too many websocket connections from this IP');
      client.disconnect(true);
      return;
    }
    this.ipConnectionCounts.set(ip, current + 1);
  }

  handleDisconnect(client: Socket) {
    const ip = this.getClientIp(client);
    const current = this.ipConnectionCounts.get(ip) ?? 0;
    if (current <= 1) {
      this.ipConnectionCounts.delete(ip);
      return;
    }
    this.ipConnectionCounts.set(ip, current - 1);
  }

  private getClientIp(client: Socket): string {
    return (
      String(client.handshake.headers['x-forwarded-for'] ?? '')
        .split(',')[0]
        .trim() || client.handshake.address
    );
  }

  emitTokenCreated(tokenAddress: string) {
    this.server.emit('tokenCreated', { tokenAddress });
  }

  emitTrade(tokenAddress: string, payload: unknown) {
    this.server.emit('trade', { tokenAddress, ...(payload as object) });
  }

  emitDeathRequested(tokenAddress: string, payload: unknown) {
    this.server.emit('deathRequested', {
      tokenAddress,
      ...(payload as object),
    });
  }

  emitDeathFinalized(tokenAddress: string, payload: unknown) {
    this.server.emit('deathFinalized', {
      tokenAddress,
      ...(payload as object),
    });
  }
}
