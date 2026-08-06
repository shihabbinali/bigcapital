import type { ISalesProfitQuery } from './SalesProfit.types';
import { SalesProfitTableInjectable } from './SalesProfitTableInjectable';
import { TableSheetPdf } from '../../common/TableSheetPdf';
import { HtmlTableCustomCss } from './constants';
import { Injectable } from '@nestjs/common';

@Injectable()
export class SalesProfitPdfInjectable {
  constructor(
    private readonly salesProfitTable: SalesProfitTableInjectable,
    private readonly tableSheetPdf: TableSheetPdf,
  ) {}

  /**
   * Retrieves the sales profit sheet in pdf format.
   * @param {ISalesProfitQuery} query
   * @returns {Promise<Buffer>}
   */
  public async pdf(query: ISalesProfitQuery): Promise<Buffer> {
    const table = await this.salesProfitTable.table(query);

    return this.tableSheetPdf.convertToPdf(
      table.table,
      table.meta.organizationName,
      table.meta.sheetName,
      table.meta.formattedDateRange,
      HtmlTableCustomCss,
    );
  }
}
