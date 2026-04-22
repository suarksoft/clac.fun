import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';

describe('AppController', () => {
  let appController: AppController;
  const mockAppService = {
    getHealth: jest.fn(() => ({ status: 'ok' })),
    getReadiness: jest.fn(async () => ({ status: 'ready' })),
  };

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        {
          provide: AppService,
          useValue: mockAppService,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('health', () => {
    it('should return service health payload', () => {
      expect(appController.getHealth()).toEqual({ status: 'ok' });
    });

    it('should return readiness payload', async () => {
      await expect(appController.getReadiness()).resolves.toEqual({
        status: 'ready',
      });
    });
  });
});
