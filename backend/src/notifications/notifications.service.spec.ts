import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../prisma/prisma.service';
import { WebPushSender } from './push-sender';

describe('NotificationsService', () => {
  let service: NotificationsService;
  let prismaService: PrismaService;

  const mockUserId = 'user-id-123';
  const mockSubscription = {
    id: 'sub-id-456',
    userId: mockUserId,
    endpoint: 'https://push.example.com/endpoint',
    keys: {
      p256dh: 'test-key',
      auth: 'test-auth',
    },
    createdAt: new Date(),
  };

  const mockPreferences = {
    id: 'pref-id-789',
    userId: mockUserId,
    types: {
      nourrissage: true,
      nettoyage: true,
      uvb: true,
      sante: true,
    },
    schedule: {
      start: '08:00',
      end: '22:00',
    },
    snooze: 15,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockPrismaService = {
    pushSubscription: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      delete: jest.fn(),
    },
    notificationPreference: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockPushSender = { deliver: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NotificationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        { provide: WebPushSender, useValue: mockPushSender },
      ],
    }).compile();

    service = module.get<NotificationsService>(NotificationsService);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('subscribeToPush', () => {
    const subscriptionData = {
      endpoint: 'https://push.example.com/endpoint',
      keys: {
        p256dh: 'test-key',
        auth: 'test-auth',
      },
    };

    it('should create a new push subscription', async () => {
      mockPrismaService.pushSubscription.findUnique.mockResolvedValue(null);
      mockPrismaService.pushSubscription.create.mockResolvedValue(
        mockSubscription,
      );

      const result = await service.subscribeToPush(
        mockUserId,
        subscriptionData,
      );

      expect(result).toEqual(mockSubscription);
      expect(mockPrismaService.pushSubscription.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          endpoint: subscriptionData.endpoint,
          keys: subscriptionData.keys,
        },
      });
    });

    it('should update the keys of the owner own subscription', async () => {
      mockPrismaService.pushSubscription.findUnique.mockResolvedValue(
        mockSubscription,
      );
      mockPrismaService.pushSubscription.update.mockResolvedValue(
        mockSubscription,
      );

      await service.subscribeToPush(mockUserId, subscriptionData);

      expect(mockPrismaService.pushSubscription.update).toHaveBeenCalledWith({
        where: { id: mockSubscription.id },
        data: { keys: subscriptionData.keys },
      });
      expect(mockPrismaService.pushSubscription.create).not.toHaveBeenCalled();
    });

    it('should refuse (403) an endpoint that belongs to another user', async () => {
      mockPrismaService.pushSubscription.findUnique.mockResolvedValue({
        ...mockSubscription,
        userId: 'someone-else',
      });

      await expect(
        service.subscribeToPush(mockUserId, subscriptionData),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.pushSubscription.update).not.toHaveBeenCalled();
      expect(mockPrismaService.pushSubscription.create).not.toHaveBeenCalled();
    });

    it('should refuse (403) when a concurrent creation by another user wins', async () => {
      mockPrismaService.pushSubscription.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ ...mockSubscription, userId: 'someone-else' });
      mockPrismaService.pushSubscription.create.mockRejectedValue({
        code: 'P2002',
      });

      await expect(
        service.subscribeToPush(mockUserId, subscriptionData),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrismaService.pushSubscription.update).not.toHaveBeenCalled();
    });
  });

  describe('unsubscribeFromPush', () => {
    it('should delete subscription if found', async () => {
      mockPrismaService.pushSubscription.findFirst.mockResolvedValue(
        mockSubscription,
      );
      mockPrismaService.pushSubscription.delete.mockResolvedValue(
        mockSubscription,
      );

      const result = await service.unsubscribeFromPush(
        mockUserId,
        mockSubscription.endpoint,
      );

      expect(result).toEqual({ success: true });
      expect(mockPrismaService.pushSubscription.delete).toHaveBeenCalledWith({
        where: { id: mockSubscription.id },
      });
    });

    it('should return success even if subscription not found', async () => {
      mockPrismaService.pushSubscription.findFirst.mockResolvedValue(null);

      const result = await service.unsubscribeFromPush(
        mockUserId,
        'invalid-endpoint',
      );

      expect(result).toEqual({ success: true });
      expect(mockPrismaService.pushSubscription.delete).not.toHaveBeenCalled();
    });
  });

  describe('getUserSubscriptions', () => {
    it('should return all user subscriptions', async () => {
      const subscriptions = [mockSubscription];
      mockPrismaService.pushSubscription.findMany.mockResolvedValue(
        subscriptions,
      );

      const result = await service.getUserSubscriptions(mockUserId);

      expect(result).toEqual(subscriptions);
      expect(mockPrismaService.pushSubscription.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
      });
    });
  });

  describe('sendNotification', () => {
    it('delegates to the push sender and reports the counts', async () => {
      mockPushSender.deliver.mockResolvedValue({
        sent: 2,
        failed: 1,
        removed: 1,
      });
      const payload = { title: 'Test Notification', body: 'Test message' };

      const result = await service.sendNotification(mockUserId, payload);

      expect(mockPushSender.deliver).toHaveBeenCalledWith(mockUserId, payload);
      expect(result).toEqual({ sent: 2, failed: 2, removed: 1 });
    });

    it('reports nothing sent when push is disabled', async () => {
      mockPushSender.deliver.mockResolvedValue({
        sent: 0,
        failed: 0,
        removed: 0,
      });

      const result = await service.sendNotification(mockUserId, {
        title: 'T',
        body: 'B',
      });

      expect(result).toEqual({ sent: 0, failed: 0, removed: 0 });
    });
  });

  describe('getNotificationPreferences', () => {
    it('should return existing preferences', async () => {
      mockPrismaService.notificationPreference.findUnique.mockResolvedValue(
        mockPreferences,
      );

      const result = await service.getNotificationPreferences(mockUserId);

      expect(result).toEqual(mockPreferences);
    });

    it('should create default preferences if none exist', async () => {
      mockPrismaService.notificationPreference.findUnique.mockResolvedValue(
        null,
      );
      mockPrismaService.notificationPreference.create.mockResolvedValue(
        mockPreferences,
      );

      const result = await service.getNotificationPreferences(mockUserId);

      expect(result).toEqual(mockPreferences);
      expect(
        mockPrismaService.notificationPreference.create,
      ).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          types: {
            nourrissage: true,
            nettoyage: true,
            uvb: true,
            sante: true,
          },
          schedule: {
            start: '08:00',
            end: '22:00',
          },
          snooze: 15,
          deliveryChannel: 'push',
        },
      });
    });
  });

  describe('updateNotificationPreferences', () => {
    it('should update preferences', async () => {
      mockPrismaService.notificationPreference.findUnique.mockResolvedValue(
        mockPreferences,
      );
      mockPrismaService.notificationPreference.update.mockResolvedValue({
        ...mockPreferences,
        snooze: 30,
      });

      const updateData = { snooze: 30 };

      const result = await service.updateNotificationPreferences(
        mockUserId,
        updateData,
      );

      expect(result.snooze).toEqual(30);
      expect(
        mockPrismaService.notificationPreference.update,
      ).toHaveBeenCalledWith({
        where: { id: mockPreferences.id },
        data: updateData,
      });
    });

    it('should create preferences if not exist before updating', async () => {
      mockPrismaService.notificationPreference.findUnique
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(mockPreferences);
      mockPrismaService.notificationPreference.create.mockResolvedValue(
        mockPreferences,
      );
      mockPrismaService.notificationPreference.update.mockResolvedValue(
        mockPreferences,
      );

      await service.updateNotificationPreferences(mockUserId, { snooze: 20 });

      expect(
        mockPrismaService.notificationPreference.create,
      ).toHaveBeenCalled();
    });
  });

  describe('checkIfShouldNotify', () => {
    it('should return true if type is enabled and within time window', async () => {
      // Mock time to be 10:00
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-02-01T10:00:00'));

      mockPrismaService.notificationPreference.findUnique.mockResolvedValue(
        mockPreferences,
      );

      const result = await service.checkIfShouldNotify(
        mockUserId,
        'nourrissage',
      );

      expect(result).toBe(true);

      jest.useRealTimers();
    });

    it('should return false if type is disabled', async () => {
      mockPrismaService.notificationPreference.findUnique.mockResolvedValue({
        ...mockPreferences,
        types: {
          nourrissage: false,
        },
      });

      const result = await service.checkIfShouldNotify(
        mockUserId,
        'nourrissage',
      );

      expect(result).toBe(false);
    });

    it('should return false if outside time window (before start)', async () => {
      // Mock time to be 07:00 (before 08:00 start)
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-02-01T07:00:00'));

      mockPrismaService.notificationPreference.findUnique.mockResolvedValue(
        mockPreferences,
      );

      const result = await service.checkIfShouldNotify(
        mockUserId,
        'nourrissage',
      );

      expect(result).toBe(false);

      jest.useRealTimers();
    });

    it('should not throw when schedule or types are null (no time restriction)', async () => {
      mockPrismaService.notificationPreference.findUnique.mockResolvedValue({
        ...mockPreferences,
        schedule: null,
      });
      await expect(
        service.checkIfShouldNotify(mockUserId, 'nourrissage'),
      ).resolves.toBe(true);

      mockPrismaService.notificationPreference.findUnique.mockResolvedValue({
        ...mockPreferences,
        types: null,
      });
      await expect(
        service.checkIfShouldNotify(mockUserId, 'nourrissage'),
      ).resolves.toBe(false);
    });

    it('should return false if outside time window (after end)', async () => {
      // Mock time to be 23:00 (after 22:00 end)
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-02-01T23:00:00'));

      mockPrismaService.notificationPreference.findUnique.mockResolvedValue(
        mockPreferences,
      );

      const result = await service.checkIfShouldNotify(
        mockUserId,
        'nourrissage',
      );

      expect(result).toBe(false);

      jest.useRealTimers();
    });
  });
});
