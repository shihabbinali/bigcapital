import { Inject, Injectable } from '@nestjs/common';
import { ExpenseTransfromer } from './Expense.transformer';
import { TransformerInjectable } from '@/modules/Transformer/TransformerInjectable.service';
import { Expense } from '../models/Expense.model';
import type { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { UserScopedQueryService } from '@/modules/Roles/UserScopedQuery.service';

@Injectable()
export class GetExpenseService {
  constructor(
    private readonly transformerService: TransformerInjectable,
    private readonly userScopedQuery: UserScopedQueryService,

    @Inject(Expense.name)
    private readonly expenseModel: TenantModelProxy<typeof Expense>,
  ) {}

  /**
   * Retrieve expense details.
   * @param {number} expenseId
   * @return {Promise<IExpense>}
   */
  public async getExpense(expenseId: number): Promise<Expense> {
    const expense = await this.expenseModel()
      .query()
      .onBuild(async (builder) => {
        await this.userScopedQuery.applyUserScope(builder, 'userId');
      })
      .findById(expenseId)
      .withGraphFetched('categories.expenseAccount')
      .withGraphFetched('paymentAccount')
      .withGraphFetched('branch')
      .withGraphFetched('attachments')
      .throwIfNotFound();

    return this.transformerService.transform(expense, new ExpenseTransfromer());
  }
}
