import { get, sumBy } from 'lodash';
import * as R from 'ramda';
import type { ModelObject } from 'objection';
import type {
  ISalesProfitQuery,
  ISalesProfitRow,
  ISalesProfitTotal,
  ISalesProfitSheetData,
  ISalesProfitParent,
} from './SalesProfit.types';
import { FinancialSheet } from '../../common/FinancialSheet';
import { ItemEntry } from '@/modules/TransactionItemEntry/models/ItemEntry';
import { allPassedConditionsPass } from '@/utils/all-conditions-passed';
import { DEFAULT_REPORT_META } from '../../types/Report.types';

export class SalesProfitReport extends FinancialSheet {
  readonly query: ISalesProfitQuery;
  readonly entries: ModelObject<ItemEntry>[];
  readonly invoiceMap: Map<string, ISalesProfitParent>;
  readonly receiptMap: Map<string, ISalesProfitParent>;

  /**
   * Constructor method.
   * @param {ISalesProfitQuery} query
   * @param {ModelObject<ItemEntry>[]} entries
   * @param {Map<string, ISalesProfitParent>} invoiceMap
   * @param {Map<string, ISalesProfitParent>} receiptMap
   * @param {{ baseCurrency: string; dateFormat?: string }} meta
   */
  constructor(
    query: ISalesProfitQuery,
    entries: ModelObject<ItemEntry>[],
    invoiceMap: Map<string, ISalesProfitParent>,
    receiptMap: Map<string, ISalesProfitParent>,
    meta: { baseCurrency: string; dateFormat?: string },
  ) {
    super();

    this.baseCurrency = meta.baseCurrency;
    this.query = query;
    this.entries = entries;
    this.invoiceMap = invoiceMap;
    this.receiptMap = receiptMap;
    this.numberFormat = this.query.numberFormat;
    this.dateFormat = meta.dateFormat || DEFAULT_REPORT_META.dateFormat;
  }

  /**
   * Resolves the parent document descriptor for the given entry.
   * @param {ModelObject<ItemEntry>} entry
   * @returns {ISalesProfitParent | undefined}
   */
  private getParent(
    entry: ModelObject<ItemEntry>,
  ): ISalesProfitParent | undefined {
    const referenceId = String(get(entry, 'referenceId', ''));

    if (entry.referenceType === 'SaleInvoice') {
      return this.invoiceMap.get(referenceId);
    }
    if (entry.referenceType === 'SaleReceipt') {
      return this.receiptMap.get(referenceId);
    }
    return undefined;
  }

  /**
   * Formats a margin percentage number (already in percent units).
   * @param {number} amount
   * @returns {string}
   */
  private formatMarginPct = (amount: number): string => {
    const settings = { money: false, symbol: '%' };
    return this.formatNumber(amount, settings);
  };

  /**
   * Maps the given item entry to a sales profit row.
   * @param {ModelObject<ItemEntry>} entry
   * @returns {ISalesProfitRow}
   */
  private entrySectionMapper = (
    entry: ModelObject<ItemEntry>,
  ): ISalesProfitRow => {
    const parent = this.getParent(entry);

    const quantity = get(entry, 'quantity', 0);
    const rate = get(entry, 'rate', 0);
    const costRate = get(entry, 'costRate', 0);

    const revenue = rate * quantity;
    const cost = (costRate || 0) * quantity;
    const profit = revenue - cost;
    const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
      date: get(parent, 'date', ''),
      docNumber: get(parent, 'number', ''),
      docType: entry.referenceType,
      customerName: get(parent, 'customerName', ''),
      itemName: get(entry, ['item', 'name'], ''),
      quantity,
      revenue,
      cost,
      profit,
      marginPct,

      dateFormatted: this.getDateFormatted(get(parent, 'date', '')),
      quantityFormatted: this.formatNumber(quantity, { money: false }),
      revenueFormatted: this.formatNumber(revenue),
      costFormatted: this.formatNumber(cost),
      profitFormatted: this.formatNumber(profit),
      marginPctFormatted: this.formatMarginPct(marginPct),
      currencyCode: this.baseCurrency,
    };
  };

  /**
   * Detarmines whether the given row has transactions.
   * @param {ISalesProfitRow} node
   * @returns {boolean}
   */
  private filterSaleNoneTransactions = (node: ISalesProfitRow): boolean => {
    return node.quantity !== 0 || node.revenue !== 0 || node.cost !== 0;
  };

  /**
   * Detarmines whether the given sales profit row is active.
   * @param {ISalesProfitRow} node
   * @returns {boolean}
   */
  private filterSaleOnlyActive = (node: ISalesProfitRow): boolean => {
    return node.revenue !== 0 || node.cost !== 0;
  };

  /**
   * Filters sales profit rows based on the report query.
   * @param {ISalesProfitRow} node
   * @returns {boolean}
   */
  private rowFilter = (node: ISalesProfitRow): boolean => {
    const { noneTransactions, onlyActive } = this.query;

    const conditions = [
      [noneTransactions, this.filterSaleNoneTransactions],
      [onlyActive, this.filterSaleOnlyActive],
    ];
    return allPassedConditionsPass(conditions)(node);
  };

  /**
   * Maps the given entries to sales profit rows.
   * @param {ModelObject<ItemEntry>[]} entries
   * @returns {ISalesProfitRow[]}
   */
  private rowsMapper = (
    entries: ModelObject<ItemEntry>[],
  ): ISalesProfitRow[] => {
    return entries.map(this.entrySectionMapper);
  };

  /**
   * Filters the sales profit rows.
   * @param {ISalesProfitRow[]} nodes
   * @returns {ISalesProfitRow[]}
   */
  private rowsFilters = (nodes: ISalesProfitRow[]): ISalesProfitRow[] => {
    return nodes.filter(this.rowFilter);
  };

  /**
   * Retrieves the rows sections.
   * @returns {ISalesProfitRow[]}
   */
  private rowsSection(): ISalesProfitRow[] {
    return R.compose(this.rowsFilters, this.rowsMapper)(this.entries);
  }

  /**
   * Retrieve the total section of the sheet.
   * @param {ISalesProfitRow[]} rows
   * @returns {ISalesProfitTotal}
   */
  private totalSection(rows: ISalesProfitRow[]): ISalesProfitTotal {
    const quantity = sumBy(rows, (row) => row.quantity);
    const revenue = sumBy(rows, (row) => row.revenue);
    const cost = sumBy(rows, (row) => row.cost);
    const profit = sumBy(rows, (row) => row.profit);
    const marginPct = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
      quantity,
      revenue,
      cost,
      profit,
      marginPct,

      quantityFormatted: this.formatTotalNumber(quantity, { money: false }),
      revenueFormatted: this.formatTotalNumber(revenue),
      costFormatted: this.formatTotalNumber(cost),
      profitFormatted: this.formatTotalNumber(profit),
      marginPctFormatted: this.formatMarginPct(marginPct),
      currencyCode: this.baseCurrency,
    };
  }

  /**
   * Retrieve the sheet data.
   * @returns {ISalesProfitSheetData}
   */
  public reportData(): ISalesProfitSheetData {
    const rows = this.rowsSection();
    const total = this.totalSection(rows);

    return { rows, total };
  }
}
