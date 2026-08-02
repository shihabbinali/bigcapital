import {
  IFinancialSheetCommonMeta,
  INumberFormatQuery,
} from '../../types/Report.types';
import { IFinancialTable } from '../../types/Table.types';

export interface ISalesProfitQuery {
  fromDate: Date | string;
  toDate: Date | string;
  numberFormat: INumberFormatQuery;
  noneTransactions: boolean;
  onlyActive: boolean;
}

export interface ISalesProfitSheetMeta extends IFinancialSheetCommonMeta {
  formattedFromDate: string;
  formattedToDate: string;
  formattedDateRange: string;
}

export interface ISalesProfitRow {
  date: Date | string;
  docNumber: string;
  docType: string;
  customerName: string;
  itemName: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;

  dateFormatted: string;
  quantityFormatted: string;
  revenueFormatted: string;
  costFormatted: string;
  profitFormatted: string;
  marginPctFormatted: string;
  currencyCode: string;
}

export interface ISalesProfitTotal {
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  marginPct: number;

  quantityFormatted: string;
  revenueFormatted: string;
  costFormatted: string;
  profitFormatted: string;
  marginPctFormatted: string;
  currencyCode: string;
}

export type ISalesProfitSheetData = {
  rows: ISalesProfitRow[];
  total: ISalesProfitTotal;
};

export interface ISalesProfitSheet {
  data: ISalesProfitSheetData;
  query: ISalesProfitQuery;
  meta: ISalesProfitSheetMeta;
}

export interface ISalesProfitTable extends IFinancialTable {
  query: ISalesProfitQuery;
  meta: ISalesProfitSheetMeta;
}

/**
 * Parent document descriptor (sale invoice or sale receipt).
 */
export interface ISalesProfitParent {
  date: Date | string;
  number: string;
  customerName: string;
}
