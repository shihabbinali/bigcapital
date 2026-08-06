import type { ISortOrder } from '@/interfaces/Model';
import { BaseModel } from '@/models/Model';
import type { ICustomViewBaseModel } from '@/modules/CustomViews/CustomViewBaseModel';
import type { IFilterRole } from '../DynamicFilter/DynamicFilter.types';
import type { IMetadataModel } from '../models/MetadataModel';
import type { ISearchableBaseModel } from '../models/SearchableBaseModel';

export interface IDynamicListFilter {
  customViewId?: number;
  filterRoles?: IFilterRole[];
  columnSortBy: ISortOrder;
  sortOrder: string;
  stringifiedFilterRoles: string;
  searchKeyword?: string;
}

export type MetableModel = typeof BaseModel &
  IMetadataModel &
  ISearchableBaseModel &
  ICustomViewBaseModel;
