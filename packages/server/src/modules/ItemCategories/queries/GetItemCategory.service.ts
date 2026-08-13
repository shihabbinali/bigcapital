import { Inject, Injectable } from '@nestjs/common';
import { ItemCategory } from '../models/ItemCategory.model';
import type { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { UserScopedQueryService } from '@/modules/Roles/UserScopedQuery.service';

@Injectable()
export class GetItemCategoryService {
  /**
   * @param {typeof ItemCategory} itemCategoryModel - Item category model.
   */
  constructor(
    @Inject(ItemCategory.name)
    private readonly itemCategoryModel: TenantModelProxy<typeof ItemCategory>,
    private readonly userScopedQuery: UserScopedQueryService,
  ) {}

  /**
   * Retrieves item category by id.
   * @param {number} itemCategoryId
   * @returns {Promise<IItemCategory>}
   */
  public async getItemCategory(itemCategoryId: number) {
    const userScope = await this.userScopedQuery.getUserScope();
    const itemCategory = await this.itemCategoryModel()
      .query()
      .onBuild((builder) => {
        this.userScopedQuery.applyUserScopeSync(builder, userScope, 'userId');
      })
      .findById(itemCategoryId)
      .throwIfNotFound();

    return itemCategory;
  }
}
