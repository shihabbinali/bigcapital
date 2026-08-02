import { ISalesProfitQuery } from './SalesProfit.types';
import { SalesProfitReportService } from './SalesProfitService';
import { SalesProfitTable } from './SalesProfitTable';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SalesProfitTableInjectable {
  constructor(private readonly salesProfitSheet: SalesProfitReportService) {}

  /**
   * Retrieves the sales profit report in table format.
   * @param {ISalesProfitQuery} filter - The filter to apply to the report.
   * @returns {Promise<ISalesProfitTable>}
   */
  public async table(filter: ISalesProfitQuery) {
    const { data, query, meta } =
      await this.salesProfitSheet.salesProfit(filter);
    const table = new SalesProfitTable(data);

    return {
      table: {
        columns: table.tableColumns(),
        rows: table.tableData(),
      },
      meta,
      query,
    };
  }
}
