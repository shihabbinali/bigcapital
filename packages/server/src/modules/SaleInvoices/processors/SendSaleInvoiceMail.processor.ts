import { Processor } from '@nestjs/bullmq';
import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SendSaleInvoiceMailJob, SendSaleInvoiceQueue } from '../constants';
import { SendSaleInvoiceMail } from '../commands/SendSaleInvoiceMail';
import { Scope } from '@nestjs/common';
import { UseCls } from 'nestjs-cls';
import { ClsService } from 'nestjs-cls';
import type { SendSaleInvoiceMailJobPayload } from '../SaleInvoice.types';

@Processor({
  name: SendSaleInvoiceQueue,
  scope: Scope.REQUEST,
})
export class SendSaleInvoiceMailProcessor extends WorkerHost {
  constructor(
    private readonly sendSaleInvoiceMail: SendSaleInvoiceMail,
    private readonly clsService: ClsService,
  ) {
    super();
  }

  @UseCls()
  async process(job: Job<SendSaleInvoiceMailJobPayload>) {
    const { messageOptions, saleInvoiceId, organizationId, userId } = job.data;

    this.clsService.set('organizationId', organizationId);
    this.clsService.set('userId', userId);

    try {
      await this.sendSaleInvoiceMail.sendMail(saleInvoiceId, messageOptions);
    } catch (error) {
      console.error('Failed to process invoice mail job:', error);
      throw error;
    }
  }
}
