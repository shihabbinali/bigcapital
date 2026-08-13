import { TransformerInjectable } from '@/modules/Transformer/TransformerInjectable.service';
import { ERRORS } from '../constants';
import { CreditNoteTransformer } from './CreditNoteTransformer';
import { Inject, Injectable } from '@nestjs/common';
import { CreditNote } from '../models/CreditNote';
import { ServiceError } from '@/modules/Items/ServiceError';
import type { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { UserScopedQueryService } from '@/modules/Roles/UserScopedQuery.service';

@Injectable()
export class GetCreditNoteService {
  constructor(
    private readonly transformer: TransformerInjectable,
    private readonly userScopedQuery: UserScopedQueryService,

    @Inject(CreditNote.name)
    private readonly creditNoteModel: TenantModelProxy<typeof CreditNote>,
  ) {}

  /**
   * Retrieve the credit note graph.
   * @param {number} creditNoteId
   */
  public async getCreditNote(creditNoteId: number) {
    // Retrieve the vendor credit model graph.
    const creditNote = await this.creditNoteModel()
      .query()
      .onBuild(async (builder) => {
        await this.userScopedQuery.applyUserScope(builder, 'userId');
      })
      .findById(creditNoteId)
      .withGraphFetched('entries.item')
      .withGraphFetched('customer')
      .withGraphFetched('branch')
      .withGraphFetched('attachments');

    if (!creditNote) {
      throw new ServiceError(ERRORS.CREDIT_NOTE_NOT_FOUND);
    }
    // Transforms the credit note model to POJO.
    return this.transformer.transform(creditNote, new CreditNoteTransformer());
  }
}
