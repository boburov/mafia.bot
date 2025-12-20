import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit {
  private readonly client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor(private configService: ConfigService) {
    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
      db: this.configService.get<number>('REDIS_DB', 0),
      retryStrategy: (times) => Math.min(times * 50, 2000),
    });

    this.client.on('error', (err) => {
      this.logger.error('Redis connection error:', err);
    });
  }

  async onModuleInit() {
    this.logger.log('Redis connected successfully 🔥');
  }

  async get(key: string): Promise<string | null> {
    return this.client.get(key);
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    if (ttl) {
      await this.client.set(key, value, 'EX', ttl);
    } else {
      await this.client.set(key, value);
    }
  }

  async del(key: string): Promise<void> {
    await this.client.del(key);
  }

  async exists(key: string): Promise<boolean> {
    return (await this.client.exists(key)) === 1;
  }

  // For email verification tokens
  async setVerificationToken(email: string, token: string, expiresIn = 600) {
    const key = `verify:${email}`;
    await this.set(key, token, expiresIn);
  }

  async getVerificationToken(email: string): Promise<string | null> {
    return this.get(`verify:${email}`);
  }

  async deleteVerificationToken(email: string): Promise<void> {
    await this.del(`verify:${email}`);
  }
}
