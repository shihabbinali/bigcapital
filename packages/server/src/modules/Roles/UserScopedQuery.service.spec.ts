import { UserScopedQueryService } from './UserScopedQuery.service';
import type { ClsService } from 'nestjs-cls';
import type { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import type { TenantUser } from '../Tenancy/TenancyModels/models/TenantUser.model';

describe('UserScopedQueryService', () => {
  let clsService: { get: jest.Mock };
  let tenantUserModel: jest.Mock;
  let service: UserScopedQueryService;

  const mockAdminUser = () => ({
    id: 1,
    role: { slug: 'admin' },
  });
  const mockStaffUser = () => ({
    id: 2,
    role: { slug: 'staff' },
  });

  const setupTenantUser = (tenantUser: Record<string, any> | undefined) => {
    tenantUserModel.mockReturnValue({
      query: jest.fn().mockReturnValue({
        findOne: jest.fn().mockReturnValue({
          withGraphFetched: jest.fn().mockResolvedValue(tenantUser),
        }),
      }),
    });
  };

  beforeEach(() => {
    clsService = { get: jest.fn() };
    tenantUserModel = jest.fn();
    service = new UserScopedQueryService(
      clsService as unknown as ClsService,
      tenantUserModel as unknown as TenantModelProxy<typeof TenantUser>,
    );
  });

  describe('isAdmin()', () => {
    it('should return true when the tenant user role slug is admin', async () => {
      clsService.get.mockReturnValue(10);
      setupTenantUser(mockAdminUser());

      await expect(service.isAdmin()).resolves.toBe(true);
    });

    it('should return false for a staff role', async () => {
      clsService.get.mockReturnValue(10);
      setupTenantUser(mockStaffUser());

      await expect(service.isAdmin()).resolves.toBe(false);
    });

    it('should return false when there is no current user', async () => {
      clsService.get.mockReturnValue(undefined);
      setupTenantUser(undefined);

      await expect(service.isAdmin()).resolves.toBe(false);
    });
  });

  describe('getUserScope()', () => {
    it('should resolve admin scope without a user id filter', async () => {
      clsService.get.mockReturnValue(10);
      setupTenantUser(mockAdminUser());

      await expect(service.getUserScope()).resolves.toEqual({
        userId: 10,
        isAdmin: true,
      });
    });

    it('should resolve non-admin scope with the current user id', async () => {
      clsService.get.mockReturnValue(10);
      setupTenantUser(mockStaffUser());

      await expect(service.getUserScope()).resolves.toEqual({
        userId: 10,
        isAdmin: false,
      });
    });
  });

  describe('applyUserScopeSync()', () => {
    let builder: { where: jest.Mock };

    beforeEach(() => {
      builder = { where: jest.fn().mockReturnThis() };
    });

    it('should add a user id filter for non-admin users', () => {
      const result = service.applyUserScopeSync(builder as any, {
        userId: 10,
        isAdmin: false,
      });

      expect(builder.where).toHaveBeenCalledWith('user_id', 10);
      expect(result).toBe(builder);
    });

    it('should use the provided user id column name', () => {
      service.applyUserScopeSync(builder as any, {
        userId: 10,
        isAdmin: false,
      }, 'userId');

      expect(builder.where).toHaveBeenCalledWith('userId', 10);
    });

    it('should not filter for admin users', () => {
      service.applyUserScopeSync(builder as any, {
        userId: 10,
        isAdmin: true,
      });

      expect(builder.where).not.toHaveBeenCalled();
    });

    it('should not filter when there is no user id', () => {
      service.applyUserScopeSync(builder as any, {
        userId: undefined,
        isAdmin: false,
      });

      expect(builder.where).not.toHaveBeenCalled();
    });
  });

  describe('applyUserScope()', () => {
    it('should apply the scope for a non-admin user', async () => {
      const builder = { where: jest.fn().mockReturnThis() };
      clsService.get.mockReturnValue(10);
      setupTenantUser(mockStaffUser());

      const result = await service.applyUserScope(builder as any, 'userId');

      expect(builder.where).toHaveBeenCalledWith('userId', 10);
      expect(result).toBe(builder);
    });

    it('should leave the query untouched for an admin', async () => {
      const builder = { where: jest.fn().mockReturnThis() };
      clsService.get.mockReturnValue(10);
      setupTenantUser(mockAdminUser());

      const result = await service.applyUserScope(builder as any, 'userId');

      expect(builder.where).not.toHaveBeenCalled();
      expect(result).toBe(builder);
    });
  });
});
