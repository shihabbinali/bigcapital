import { Inject, Injectable } from '@nestjs/common';
import type { Knex } from 'knex';
import { SaleInvoice } from '../../SaleInvoices/models/SaleInvoice';
import type { IPaymentReceivedEntryDTO } from '../types/PaymentReceived.types';
import { entriesAmountDiff } from '@/utils/entries-amount-diff';
import type { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';

@Injectable()
export class PaymentReceivedInvoiceSync {
  constructor(
    @Inject(SaleInvoice.name)
    private readonly saleInvoiceModel: TenantModelProxy<typeof SaleInvoice>,
  ) {}

  /**
   * Saves difference changing between old and new invoice payment amount.
   * @param {Array} paymentReceiveEntries
   * @param {Array} newPaymentReceiveEntries
   * @return {Promise<void>}
   */
  public async saveChangeInvoicePaymentAmount(
    newPaymentReceiveEntries: IPaymentReceivedEntryDTO[],
    oldPaymentReceiveEntries?: IPaymentReceivedEntryDTO[],
    trx?: Knex.Transaction,
  ): Promise<void> {
    const opers: Promise<void>[] = [];

    const diffEntries = entriesAmountDiff(
      newPaymentReceiveEntries,
      oldPaymentReceiveEntries,
      'paymentAmount',
      'invoiceId',
    );
    diffEntries.forEach((diffEntry: any) => {
      if (diffEntry.paymentAmount === 0) {
        return;
      }
      const oper = this.saleInvoiceModel().changePaymentAmount(
        diffEntry.invoiceId,
        diffEntry.paymentAmount,
        trx,
      );
      opers.push(oper);
    });
    await Promise.all([...opers]);
  }
}
