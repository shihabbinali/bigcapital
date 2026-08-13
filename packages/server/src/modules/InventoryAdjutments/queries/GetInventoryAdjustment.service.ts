import { Inject, Injectable } from '@nestjs/common';
import { TransformerInjectable } from '@/modules/Transformer/TransformerInjectable.service';
import { InventoryAdjustment } from '../models/InventoryAdjustment';
import { InventoryAdjustmentTransformer } from '../InventoryAdjustmentTransformer';
import type { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import { UserScopedQueryService } from '@/modules/Roles/UserScopedQuery.service';

@Injectable()
export class GetInventoryAdjustmentService {
  constructor(
    private readonly transformer: TransformerInjectable,
    private readonly userScopedQuery: UserScopedQueryService,

    @Inject(InventoryAdjustment.name)
    private readonly inventoryAdjustmentModel: TenantModelProxy<
      typeof InventoryAdjustment
    >,
  ) {}

  /**
   * Retrieve specific inventory adjustment transaction details.
   * @param {number} inventoryAdjustmentId - Inventory adjustment id.
   */
  async getInventoryAdjustment(inventoryAdjustmentId: number) {
    // Retrieve inventory adjustment transation with associated models.
    const inventoryAdjustment = await this.inventoryAdjustmentModel()
      .query()
      .onBuild(async (builder) => {
        await this.userScopedQuery.applyUserScope(builder, 'userId');
      })
      .findById(inventoryAdjustmentId)
      .withGraphFetched('entries.item')
      .withGraphFetched('adjustmentAccount')
      .throwIfNotFound();

    return this.transformer.transform(
      inventoryAdjustment,
      new InventoryAdjustmentTransformer(),
    );
  }
}
