import { Inject, Injectable } from '@nestjs/common';
import { TransformerInjectable } from '../../Transformer/TransformerInjectable.service';
import { BillPayment } from '../models/BillPayment';
import { BillPaymentTransformer } from './BillPaymentTransformer';
import type { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { UserScopedQueryService } from '@/modules/Roles/UserScopedQuery.service';

@Injectable()
export class GetBillPayment {
  constructor(
    private readonly transformer: TransformerInjectable,
    private readonly userScopedQuery: UserScopedQueryService,

    @Inject(BillPayment.name)
    private readonly billPaymentModel: TenantModelProxy<typeof BillPayment>,
  ) {}

  /**
   * Retrieves bill payment.
   * @param {number} billPyamentId
   * @return {Promise<BillPayment>}
   */
  public async getBillPayment(billPyamentId: number): Promise<BillPayment> {
    const userScope = await this.userScopedQuery.getUserScope();
    const billPayment = await this.billPaymentModel()
      .query()
      .onBuild((builder) => {
        this.userScopedQuery.applyUserScopeSync(builder, userScope, 'userId');
      })
      .withGraphFetched('entries.bill')
      .withGraphFetched('vendor')
      .withGraphFetched('paymentAccount')
      .withGraphFetched('transactions')
      .withGraphFetched('branch')
      .withGraphFetched('attachments')
      .findById(billPyamentId)
      .throwIfNotFound();

    return this.transformer.transform(
      billPayment,
      new BillPaymentTransformer(),
    );
  }
}
