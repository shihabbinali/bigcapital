import * as moment from 'moment';
import { Injectable } from '@nestjs/common';
import { FinancialSheetMeta } from '../../common/FinancialSheetMeta';
import {
  ISalesProfitQuery,
  ISalesProfitSheetMeta,
} from './SalesProfit.types';

@Injectable()
export class SalesProfitMeta {
  constructor(private financialSheetMeta: FinancialSheetMeta) {}

  /**
   * Retrieve the sales profit meta.
   * @param {ISalesProfitQuery} query
   * @returns {Promise<ISalesProfitSheetMeta>}
   */
  public async meta(query: ISalesProfitQuery): Promise<ISalesProfitSheetMeta> {
    const commonMeta = await this.financialSheetMeta.meta();
    const formattedToDate = moment(query.toDate).format(commonMeta.dateFormat);
    const formattedFromDate = moment(query.fromDate).format(commonMeta.dateFormat);
    const formattedDateRange = `From ${formattedFromDate} | To ${formattedToDate}`;

    const sheetName = 'Sales Profit';

    return {
      ...commonMeta,
      sheetName,
      formattedFromDate,
      formattedToDate,
      formattedDateRange,
    };
  }
}
