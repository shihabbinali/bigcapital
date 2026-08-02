import type { OpArgType } from 'openapi-typescript-fetch';
import type { ApiFetcher } from '../fetch-utils';
import type { paths } from '../schema';
import {
  OpForPath,
  OpQueryParams,
  OpResponseBody,
  OpResponseBodyTable,
} from '../utils';

export const SALES_PROFIT_ROUTE = '/api/reports/sales-profit' as const satisfies keyof paths;

type Op = OpForPath<typeof SALES_PROFIT_ROUTE, 'get'>;
type Arg = OpArgType<Op>;

// Table format (existing functionality)
export type SalesProfitTableQuery = OpQueryParams<Op>;
export type SalesProfitTableResponse = OpResponseBodyTable<Op>;

export async function fetchSalesProfitTable(
  fetcher: ApiFetcher,
  query: SalesProfitTableQuery
): Promise<SalesProfitTableResponse> {
  const get = fetcher.path(SALES_PROFIT_ROUTE).method('get').create();
  const { data } = await get(query as Arg);
  return data as unknown as SalesProfitTableResponse;
}

// JSON format - Note: may only have table format in schema
// Using type assertion for JSON format compatibility
export type SalesProfitJsonQuery = OpQueryParams<Op>;
export type SalesProfitJsonResponse = OpResponseBody<Op>;

export async function fetchSalesProfitJson(
  fetcher: ApiFetcher,
  query: SalesProfitJsonQuery
): Promise<SalesProfitJsonResponse> {
  const get = fetcher.path(SALES_PROFIT_ROUTE).method('get').create();
  const { data } = await get(query as Arg);
  return data as unknown as SalesProfitJsonResponse;
}

// CSV format (returns Blob)
export type SalesProfitCsvQuery = OpQueryParams<Op>;
export type SalesProfitCsvResponse = Blob;

export async function fetchSalesProfitCsv(
  fetcher: ApiFetcher,
  query: SalesProfitCsvQuery
): Promise<SalesProfitCsvResponse> {
  const get = fetcher.path(SALES_PROFIT_ROUTE).method('get').create();
  const response = await get({ ...query, Accept: 'application/csv' } as Arg);
  return response.data as unknown as SalesProfitCsvResponse;
}

// XLSX format (returns Blob)
export type SalesProfitXlsxQuery = OpQueryParams<Op>;
export type SalesProfitXlsxResponse = Blob;

export async function fetchSalesProfitXlsx(
  fetcher: ApiFetcher,
  query: SalesProfitXlsxQuery
): Promise<SalesProfitXlsxResponse> {
  const get = fetcher.path(SALES_PROFIT_ROUTE).method('get').create();
  const response = await get({ ...query, Accept: 'application/xlsx' } as Arg);
  return response.data as unknown as SalesProfitXlsxResponse;
}

// PDF format (returns Blob)
export type SalesProfitPdfQuery = OpQueryParams<Op>;
export type SalesProfitPdfResponse = Blob;

export async function fetchSalesProfitPdf(
  fetcher: ApiFetcher,
  query: SalesProfitPdfQuery
): Promise<SalesProfitPdfResponse> {
  const get = fetcher.path(SALES_PROFIT_ROUTE).method('get').create();
  const response = await get({ ...query, Accept: 'application/pdf' } as Arg);
  return response.data as unknown as SalesProfitPdfResponse;
}