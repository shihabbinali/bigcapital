import { Injectable } from '@nestjs/common';
import { TableSheet } from '../../common/TableSheet';
import type { ISalesProfitQuery } from './SalesProfit.types';
import { SalesProfitTableInjectable } from './SalesProfitTableInjectable';

@Injectable()
export class SalesProfitExport {
  constructor(private readonly salesProfitTable: SalesProfitTableInjectable) {}

  /**
   * Retrieves the sales profit sheet in XLSX format.
   * @param {ISalesProfitQuery} query
   * @returns {Promise<Buffer>}
   */
  public async xlsx(query: ISalesProfitQuery) {
    const table = await this.salesProfitTable.table(query);

    const tableSheet = new TableSheet(table.table);
    const tableCsv = tableSheet.convertToXLSX();

    return tableSheet.convertToBuffer(tableCsv, 'xlsx');
  }

  /**
   * Retrieves the sales profit sheet in CSV format.
   * @param {ISalesProfitQuery} query
   * @returns {Promise<string>}
   */
  public async csv(query: ISalesProfitQuery): Promise<string> {
    const table = await this.salesProfitTable.table(query);

    const tableSheet = new TableSheet(table.table);
    const tableCsv = tableSheet.convertToCSV();

    return tableCsv;
  }
}
