import { WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { Server } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws',
})
export class TokensGateway {
  @WebSocketServer()
  server: Server;

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
