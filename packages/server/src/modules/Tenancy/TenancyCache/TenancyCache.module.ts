import type { RedisClientOptions } from 'redis';
import { Module } from '@nestjs/common';
import type { DynamicModule } from '@nestjs/common';
import { CacheModule } from '@nestjs/cache-manager';

interface TenancyCacheModuleConfig {
  tenantId: number;
}

@Module({})
export class TenancyCacheModule {
  static register(config: TenancyCacheModuleConfig): DynamicModule {
    return {
      module: TenancyCacheModule,
      imports: [CacheModule.register<RedisClientOptions>({})],
    };
  }
}
