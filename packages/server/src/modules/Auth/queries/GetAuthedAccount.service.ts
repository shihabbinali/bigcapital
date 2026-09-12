import { Injectable } from '@nestjs/common';
import { TenancyContext } from '@/modules/Tenancy/TenancyContext.service';
import { TransformerInjectable } from '@/modules/Transformer/TransformerInjectable.service';
import { GetAuthedAccountTransformer } from './GetAuthedAccount.transformer';
import { UserScopedQueryService } from '@/modules/Roles/UserScopedQuery.service';

@Injectable()
export class GetAuthenticatedAccount {
  constructor(
    private readonly tenancyContext: TenancyContext,
    private readonly transformer: TransformerInjectable,
    private readonly userScopedQuery: UserScopedQueryService,
  ) {}

  async getAccount() {
    const account = await this.tenancyContext.getSystemUser();
    const isAdmin = await this.userScopedQuery.isAdmin();

    return this.transformer.transform(
      { ...account, isAdmin },
      new GetAuthedAccountTransformer(),
    );
  }
}
