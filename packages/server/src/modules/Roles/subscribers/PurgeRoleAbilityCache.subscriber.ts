import { OnEvent } from '@nestjs/event-emitter';
import { Injectable } from '@nestjs/common';
import { events } from '@/common/events/events';
import { ABILITIES_CACHE } from '../TenantAbilities';

@Injectable()
export class PurgeRoleAbilityCacheSubscriber {
  /**
   * Resets the abilities cache once a role is mutated, so the new
   * permissions take effect immediately for all users of the role.
   */
  @OnEvent(events.roles.onEdited)
  @OnEvent(events.roles.onDeleted)
  purgeRoleAbilityCache() {
    ABILITIES_CACHE.reset();
  }
}
