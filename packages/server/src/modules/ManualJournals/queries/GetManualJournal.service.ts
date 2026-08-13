import { Inject, Injectable } from '@nestjs/common';
import { ManualJournal } from '../models/ManualJournal';
import { TransformerInjectable } from '@/modules/Transformer/TransformerInjectable.service';
import { ManualJournalTransfromer } from './ManualJournalTransformer';
import type { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { UserScopedQueryService } from '@/modules/Roles/UserScopedQuery.service';

@Injectable()
export class GetManualJournal {
  constructor(
    private readonly transformer: TransformerInjectable,
    private readonly userScopedQuery: UserScopedQueryService,

    @Inject(ManualJournal.name)
    private readonly manualJournalModel: TenantModelProxy<typeof ManualJournal>,
  ) {}

  /**
   * Retrieve manual journal details with associated journal transactions.
   * @param {number} tenantId
   * @param {number} manualJournalId
   */
  public getManualJournal = async (manualJournalId: number) => {
    const manualJournal = await this.manualJournalModel()
      .query()
      .onBuild(async (builder) => {
        await this.userScopedQuery.applyUserScope(builder, 'userId');
      })
      .findById(manualJournalId)
      .withGraphFetched('entries.account')
      .withGraphFetched('entries.contact')
      .withGraphFetched('entries.branch')
      .withGraphFetched('transactions')
      .withGraphFetched('attachments')
      .throwIfNotFound();

    return this.transformer.transform(
      manualJournal,
      new ManualJournalTransfromer(),
    );
  };
}
