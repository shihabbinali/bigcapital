import { Inject, Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Model, QueryBuilder } from 'objection';
import { TenantUser } from '../Tenancy/TenancyModels/models/TenantUser.model';
import type { TenantModelProxy } from '../System/models/TenantBaseModel';

@Injectable()
export class UserScopedQueryService {
  /**
   * @param {ClsService} clsService - CLS service holding the current user id.
   * @param {TenantModelProxy<typeof TenantUser>} tenantUserModel - Tenant users model.
   */
  constructor(
    private readonly clsService: ClsService,

    @Inject(TenantUser.name)
    private readonly tenantUserModel: TenantModelProxy<typeof TenantUser>,
  ) {}

  /**
   * Retrieves the current tenant user with its role.
   * @returns {Promise<TenantUser | undefined>}
   */
  private async getTenantUser(): Promise<TenantUser | undefined> {
    const userId = this.clsService.get('userId');

    if (!userId) {
      return undefined;
    }
    return this.tenantUserModel()
      .query()
      .findOne('systemUserId', userId)
      .withGraphFetched('role');
  }

  /**
   * Determines whether the current user is an admin (role slug 'admin').
   * @returns {Promise<boolean>}
   */
  public async isAdmin(): Promise<boolean> {
    const tenantUser = await this.getTenantUser();

    return tenantUser?.role?.slug === 'admin';
  }

  /**
   * Retrieves the current system user id from the CLS store.
   * @returns {Promise<number | undefined>}
   */
  public async getCurrentUserId(): Promise<number | undefined> {
    return this.clsService.get('userId');
  }

  /**
   * Applies per-user row-level scoping to a query builder.
   * Non-admin users only see records they created; admins see everything.
   * @param {QueryBuilder} builder - Objection query builder.
   * @param {string} userIdColumn - The user id column name (default 'user_id').
   * @returns {Promise<QueryBuilder>}
   */
  public async applyUserScope<T extends Model>(
    builder: QueryBuilder<T>,
    userIdColumn: string = 'user_id',
  ): Promise<QueryBuilder<T>> {
    if (await this.isAdmin()) {
      return builder;
    }
    const userId = this.clsService.get('userId');

    if (!userId) {
      return builder;
    }
    return builder.where(userIdColumn, userId);
  }
}
