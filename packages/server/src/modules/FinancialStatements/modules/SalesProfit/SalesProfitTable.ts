import * as R from 'ramda';
import {
  ISalesProfitRow,
  ISalesProfitSheetData,
  ISalesProfitTotal,
} from './SalesProfit.types';
import { ROW_TYPE } from './constants';
import { FinancialTable } from '../../common/FinancialTable';
import { FinancialSheetStructure } from '../../common/FinancialSheetStructure';
import { FinancialSheet } from '../../common/FinancialSheet';
import { ITableColumn, ITableRow } from '../../types/Table.types';
import { tableRowMapper } from '../../utils/Table.utils';

export class SalesProfitTable extends R.pipe(
  FinancialTable,
  FinancialSheetStructure,
)(FinancialSheet) {
  private readonly data: ISalesProfitSheetData;

  /**
   * Constructor method.
   * @param {ISalesProfitSheetData} data
   */
  constructor(data: ISalesProfitSheetData) {
    super();
    this.data = data;
  }

  /**
   * Retrieves the common table accessors.
   * @returns {ITableColumn[]}
   */
  private commonTableAccessors() {
    return [
      { key: 'date', accessor: 'dateFormatted' },
      { key: 'doc_number', accessor: 'docNumber' },
      { key: 'customer_name', accessor: 'customerName' },
      { key: 'item_name', accessor: 'itemName' },
      { key: 'quantity', accessor: 'quantityFormatted' },
      { key: 'revenue', accessor: 'revenueFormatted' },
      { key: 'cost', accessor: 'costFormatted' },
      { key: 'profit', accessor: 'profitFormatted' },
      { key: 'margin_pct', accessor: 'marginPctFormatted' },
    ];
  }

  /**
   * Maps the given item node to table row.
   * @param {ISalesProfitRow} row
   * @returns {ITableRow}
   */
  private rowMap = (row: ISalesProfitRow): ITableRow => {
    const columns = this.commonTableAccessors();
    const meta = {
      rowTypes: [ROW_TYPE.ITEM],
    };
    return tableRowMapper(row, columns, meta);
  };

  /**
   * Maps the given rows nodes to table rows.
   * @param {ISalesProfitRow[]} rows
   * @returns {ITableRow[]}
   */
  private rowsMap = (rows: ISalesProfitRow[]): ITableRow[] => {
    return R.map(this.rowMap, rows);
  };

  /**
   * Maps the given total node to table row.
   * @param {ISalesProfitTotal} total
   * @returns {ITableRow}
   */
  private totalMap = (total: ISalesProfitTotal) => {
    const columns = this.commonTableAccessors();
    const meta = {
      rowTypes: [ROW_TYPE.TOTAL],
    };
    return tableRowMapper(total, columns, meta);
  };

  /**
   * Retrieves the table rows.
   * @returns {ITableRow[]}
   */
  public tableData(): ITableRow[] {
    const rows = this.rowsMap(this.data.rows);
    const totalRow = this.totalMap(this.data.total);

    return R.compose(
      R.when(R.always(R.not(R.isEmpty(rows))), R.append(totalRow))
    )([...rows]) as ITableRow[];
  }

  /**
   * Retrieves the table columns.
   * @returns {ITableColumn[]}
   */
  public tableColumns(): ITableColumn[] {
    const columns = [
      { key: 'date', label: 'Date' },
      { key: 'doc_number', label: 'Document No.' },
      { key: 'customer_name', label: 'Customer' },
      { key: 'item_name', label: 'Item' },
      { key: 'quantity', label: 'Quantity' },
      { key: 'revenue', label: 'Revenue' },
      { key: 'cost', label: 'Cost' },
      { key: 'profit', label: 'Profit' },
      { key: 'margin_pct', label: 'Margin %' },
    ];
    return R.compose(this.tableColumnsCellIndexing)(columns);
  }
}
