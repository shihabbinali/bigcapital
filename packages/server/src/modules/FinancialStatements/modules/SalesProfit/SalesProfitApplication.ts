import { Injectable } from '@nestjs/common';
import type {
  ISalesProfitQuery,
  ISalesProfitSheet,
  ISalesProfitTable,
} from './SalesProfit.types';
import { SalesProfitReportService } from './SalesProfitService';
import { SalesProfitTableInjectable } from './SalesProfitTableInjectable';
import { SalesProfitExport } from './SalesProfitExport';
import { SalesProfitPdfInjectable } from './SalesProfitPdfInjectable';

@Injectable()
export class SalesProfitApplication {
  constructor(
    private readonly salesProfitSheet: SalesProfitReportService,
    private readonly salesProfitTable: SalesProfitTableInjectable,
    private readonly salesProfitExport: SalesProfitExport,
    private readonly salesProfitPdf: SalesProfitPdfInjectable,
  ) {}

  /**
   * Retrieves the sales profit report in json format.
   * @param {ISalesProfitQuery} filter
   * @returns {Promise<ISalesProfitSheet>}
   */
  public sheet(filter: ISalesProfitQuery): Promise<ISalesProfitSheet> {
    return this.salesProfitSheet.salesProfit(filter);
  }

  /**
   * Retrieves the sales profit report in table format.
   * @param {ISalesProfitQuery} filter
   * @returns {Promise<ISalesProfitTable>}
   */
  public table(filter: ISalesProfitQuery): Promise<ISalesProfitTable> {
    return this.salesProfitTable.table(filter);
  }

  /**
   * Retrieves the sales profit report in csv format.
   * @param {ISalesProfitQuery} filter
   * @returns {Promise<string>}
   */
  public csv(filter: ISalesProfitQuery): Promise<string> {
    return this.salesProfitExport.csv(filter);
  }

  /**
   * Retrieves the sales profit report in xlsx format.
   * @param {ISalesProfitQuery} filter
   * @returns {Promise<Buffer>}
   */
  public xlsx(filter: ISalesProfitQuery): Promise<Buffer> {
    return this.salesProfitExport.xlsx(filter);
  }

  /**
   * Retrieves the sales profit report in pdf format.
   * @param {ISalesProfitQuery} query
   * @returns {Promise<Buffer>}
   */
  public pdf(query: ISalesProfitQuery): Promise<Buffer> {
    return this.salesProfitPdf.pdf(query);
  }
}
