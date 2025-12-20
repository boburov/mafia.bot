import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DbModule } from './core/db/db.module';
import { RedisService } from './core/cache/redis';
import { MailerService } from './core/mail/mail';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthModule } from './core/auth/auth.module';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { ThrottlerStorageRedisService } from '@nest-lab/throttler-storage-redis';
import { APP_GUARD } from '@nestjs/core';
import { UsersModule } from './modules/users/users.module';
import { AnimeModule } from './modules/anime/anime.module';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL', 60),
            limit: config.get<number>('THROTTLE_LIMIT', 100),
          },
        ],
        storage: new ThrottlerStorageRedisService(
          config.get<string>('REDIS_URL'),
        ),
      }),
    }),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    DbModule,
    AuthModule,
    UsersModule,
    AnimeModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    RedisService,
    MailerService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
