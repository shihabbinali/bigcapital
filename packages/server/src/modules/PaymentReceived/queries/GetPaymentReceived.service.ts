import { Inject, Injectable } from '@nestjs/common';
import { ERRORS } from '../constants';
import { PaymentReceiveTransfromer } from './PaymentReceivedTransformer';
import { PaymentReceived } from '../models/PaymentReceived';
import { TransformerInjectable } from '../../Transformer/TransformerInjectable.service';
import { ServiceError } from '../../Items/ServiceError';
import type { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { UserScopedQueryService } from '@/modules/Roles/UserScopedQuery.service';

@Injectable()
export class GetPaymentReceivedService {
  constructor(
    private readonly transformer: TransformerInjectable,
    private readonly userScopedQuery: UserScopedQueryService,

    @Inject(PaymentReceived.name)
    private readonly paymentReceiveModel: TenantModelProxy<
      typeof PaymentReceived
    >,
  ) {}

  /**
   * Retrieve payment receive details.
   * @param {number} paymentReceiveId - Payment receive id.
   * @return {Promise<IPaymentReceived>}
   */
  public async getPaymentReceive(
    paymentReceiveId: number,
  ): Promise<PaymentReceived> {
    const userScope = await this.userScopedQuery.getUserScope();
    const paymentReceive = await this.paymentReceiveModel()
      .query()
      .onBuild((builder) => {
        this.userScopedQuery.applyUserScopeSync(builder, userScope, 'userId');
      })
      .withGraphFetched('customer')
      .withGraphFetched('depositAccount')
      .withGraphFetched('entries.invoice')
      .withGraphFetched('transactions')
      .withGraphFetched('branch')
      .withGraphFetched('attachments')
      .findById(paymentReceiveId);

    if (!paymentReceive) {
      throw new ServiceError(ERRORS.PAYMENT_RECEIVE_NOT_EXISTS);
    }
    return this.transformer.transform(
      paymentReceive,
      new PaymentReceiveTransfromer(),
    );
  }
}
