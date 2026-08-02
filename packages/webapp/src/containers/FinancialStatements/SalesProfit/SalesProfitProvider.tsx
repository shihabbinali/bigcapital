// @ts-nocheck
import { createContext, useContext, useMemo } from 'react';
import FinancialReportPage from '../FinancialReportPage';
import { useSalesProfitTable } from '@/hooks/query';
import { transformFilterFormToQuery } from '../common';

const SalesProfitContext = createContext();

function SalesProfitProvider({ query, ...props }) {
  // Transformes the sheet query to http query.
  const httpQuery = useMemo(() => transformFilterFormToQuery(query), [query]);

  const {
    data: salesProfit,
    isFetching,
    isLoading,
    refetch,
  } = useSalesProfitTable({ ...httpQuery }, { keepPreviousData: true });

  const provider = {
    salesProfit,
    isFetching,
    isLoading,
    refetchSheet: refetch,
    httpQuery,
  };
  return (
    <FinancialReportPage name={'sales-profit'}>
      <SalesProfitContext.Provider value={provider} {...props} />
    </FinancialReportPage>
  );
}

const useSalesProfitContext = () => useContext(SalesProfitContext);

export { SalesProfitProvider, useSalesProfitContext };
