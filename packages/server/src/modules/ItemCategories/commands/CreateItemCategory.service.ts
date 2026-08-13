import { Injectable, Inject } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type { Knex } from 'knex';
import type { IItemCategoryCreatedPayload } from '../ItemCategory.interfaces';
import { events } from '@/common/events/events';
import { CommandItemCategoryValidatorService } from './CommandItemCategoryValidator.service';
import { ItemCategory } from '../models/ItemCategory.model';
import { UnitOfWork } from '@/modules/Tenancy/TenancyDB/UnitOfWork.service';
import { TenancyContext } from '@/modules/Tenancy/TenancyContext.service';
import { CreateItemCategoryDto } from '../dtos/ItemCategory.dto';

@Injectable()
export class CreateItemCategoryService {
  /**
   * @param {UnitOfWork} uow - Unit of work.
   * @param {CommandItemCategoryValidatorService} validator - Command item category validator service.
   * @param {EventEmitter2} eventEmitter - Event emitter.
   * @param {typeof ItemCategory} itemCategoryModel - Item category model.
   * @param {TenancyContext} tenancyContext - Tenancy context.
   */
  constructor(
    private readonly uow: UnitOfWork,
    private readonly validator: CommandItemCategoryValidatorService,
    private readonly eventEmitter: EventEmitter2,
    private readonly tenancyContext: TenancyContext,

    @Inject(ItemCategory.name)
    private readonly itemCategoryModel: () => typeof ItemCategory,
  ) {}

  /**
   * Transforms OTD to model object.
   * @param {CreateItemCategoryDto} itemCategoryOTD
   * @returns {Promise<Partial<ItemCategory>>}
   */
  private async transformOTDToObject(
    itemCategoryOTD: CreateItemCategoryDto,
  ): Promise<Partial<ItemCategory>> {
    const authorizedUser = await this.tenancyContext.getSystemUser();

    return {
      ...itemCategoryOTD,
      userId: authorizedUser?.id,
    };
  }
  /**
   * Inserts a new item category.
   * @param {number} tenantId
   * @param {IItemCategoryOTD} itemCategoryOTD
   * @return {Promise<ItemCategory>}
   */
  public async newItemCategory(
    itemCategoryOTD: CreateItemCategoryDto,
    trx?: Knex.Transaction,
  ): Promise<ItemCategory> {
    // Validate the category name uniquiness.
    await this.validator.validateCategoryNameUniquiness(itemCategoryOTD.name);

    if (itemCategoryOTD.sellAccountId) {
      await this.validator.validateSellAccount(itemCategoryOTD.sellAccountId);
    }
    if (itemCategoryOTD.costAccountId) {
      await this.validator.validateCostAccount(itemCategoryOTD.costAccountId);
    }
    if (itemCategoryOTD.inventoryAccountId) {
      await this.validator.validateInventoryAccount(
        itemCategoryOTD.inventoryAccountId,
      );
    }
    const itemCategoryObj = await this.transformOTDToObject(itemCategoryOTD);

    // Creates item category under unit-of-work evnirement.
    return this.uow.withTransaction(async (trx: Knex.Transaction) => {
      // Inserts the item category.
      const itemCategory = await this.itemCategoryModel()
        .query(trx)
        .insert({
          ...itemCategoryObj,
        });
      // Triggers `onItemCategoryCreated` event.
      await this.eventEmitter.emitAsync(events.itemCategory.onCreated, {
        itemCategory,
        trx,
      } as IItemCategoryCreatedPayload);

      return itemCategory;
    }, trx);
  }
}
