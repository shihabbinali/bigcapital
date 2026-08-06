import { Processor } from '@nestjs/bullmq';
import { WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Scope } from '@nestjs/common';
import { UseCls } from 'nestjs-cls';
import { ClsService } from 'nestjs-cls';
import {
  SEND_PAYMENT_RECEIVED_MAIL_JOB,
  SEND_PAYMENT_RECEIVED_MAIL_QUEUE,
} from '../constants';
import { SendPaymentReceiveMailNotification } from '../commands/PaymentReceivedMailNotification';
import type { SendPaymentReceivedMailPayload } from '../types/PaymentReceived.types';

@Processor({
  name: SEND_PAYMENT_RECEIVED_MAIL_QUEUE,
  scope: Scope.REQUEST,
})
export class SendPaymentReceivedMailProcessor extends WorkerHost {
  constructor(
    private readonly sendPaymentReceivedMail: SendPaymentReceiveMailNotification,
    private readonly clsService: ClsService,
  ) {
    super();
  }

  @UseCls()
  async process(job: Job<SendPaymentReceivedMailPayload>) {
    const { messageOptions, paymentReceivedId, organizationId, userId } =
      job.data;

    this.clsService.set('organizationId', organizationId);
    this.clsService.set('userId', userId);

    try {
      await this.sendPaymentReceivedMail.sendMail(
        paymentReceivedId,
        messageOptions,
      );
    } catch (error) {
      console.error('Failed to process payment received mail job:', error);
      throw error;
    }
  }
}
