// @ts-nocheck
import { useRequestQuery } from '../../useQueryRequest';
import { useDownloadFile } from '../../useDownloadFile';
import { useRequestPdf } from '../../useRequestPdf';
import t from '../types';

/**
 * Retrieve sales profit.
 */
export function useSalesProfit(query, props) {
  return useRequestQuery(
    [t.FINANCIAL_REPORT, t.SALES_PROFIT, query],
    {
      method: 'get',
      url: '/reports/sales-profit',
      params: query,
    },
    {
      ...props,
    },
  );
}

/**
 * Retrieves sales profit table format.
 */
export function useSalesProfitTable(query, props) {
  return useRequestQuery(
    [t.FINANCIAL_REPORT, t.SALES_PROFIT, query],
    {
      method: 'get',
      url: '/reports/sales-profit',
      params: query,
      headers: {
        Accept: 'application/json+table',
      },
    },
    {
      select: (res) => res.data,
      ...props,
    },
  );
}

export const useSalesProfitCsvExport = (query, args) => {
  return useDownloadFile({
    url: '/reports/sales-profit',
    config: {
      headers: {
        accept: 'application/csv',
      },
      params: query,
    },
    filename: 'sales_profit.csv',
    ...args,
  });
};

export const useSalesProfitXlsxExport = (query, args) => {
  return useDownloadFile({
    url: '/reports/sales-profit',
    config: {
      headers: {
        accept: 'application/xlsx',
      },
      params: query,
    },
    filename: 'sales_profit.xlsx',
    ...args,
  });
};

export const useSalesProfitPdfExport = (query = {}) => {
  return useRequestPdf({
    url: '/reports/sales-profit',
    params: query,
  });
};
