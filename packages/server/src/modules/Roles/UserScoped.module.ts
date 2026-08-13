import { Global, Module } from '@nestjs/common';
import { UserScopedQueryService } from './UserScopedQuery.service';

@Global()
@Module({
  providers: [UserScopedQueryService],
  exports: [UserScopedQueryService],
})
export class UserScopedModule {}
