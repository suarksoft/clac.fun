import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { getAllowedOrigins } from '../config/cors.config';

@WebSocketGateway({
  cors: { origin: getAllowedOrigins() },
  namespace: '/ws',
})
export class TokensGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;
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

  emitTokenCreated(data: unknown) {
    this.server.emit('tokenCreated', data);
  }

  emitTrade(data: unknown) {
    this.server.emit('trade', data);
  }

  emitDeath(data: unknown) {
    this.server.emit('tokenClacced', data);
  }

  emitLotteryWin(data: unknown) {
    this.server.emit('lotteryWin', data);
  }

  emitTickerUpdate(data: unknown) {
    this.server.emit('ticker', data);
  }
}
