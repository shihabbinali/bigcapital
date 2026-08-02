// @ts-nocheck
import React, { useEffect, useCallback } from 'react';
import moment from 'moment';

import { SalesProfitBody } from './SalesProfitBody';
import { SalesProfitProvider } from './SalesProfitProvider';
import { SalesProfitLoadingBar } from './components';
import { FinancialStatement, DashboardPageContent } from '@/components';
import SalesProfitActionsBar from './SalesProfitActionsBar';
import SalesProfitHeader from './SalesProfitHeader';

import { withSalesProfitActions } from './withSalesProfitActions';

import { useSalesProfitQuery } from './utils';
import { compose } from '@/utils';
import { SalesProfitDialogs } from './SalesProfitDialogs';

/**
 * Sales profit.
 */
function SalesProfit({
  // #withSalesProfitActions
  toggleSalesProfitFilterDrawer,
}) {
  const { query, setLocationQuery } = useSalesProfitQuery();

  // Handle filter form submit.
  const handleFilterSubmit = useCallback(
    (filter) => {
      const parsedFilter = {
        ...filter,
        fromDate: moment(filter.fromDate).format('YYYY-MM-DD'),
        toDate: moment(filter.toDate).format('YYYY-MM-DD'),
      };
      setLocationQuery(parsedFilter);
    },
    [setLocationQuery],
  );

  // Handle number format form submit.
  const handleNumberFormatSubmit = (numberFormat) => {
    setLocationQuery({
      ...query,
      numberFormat,
    });
  };
  // Hide the filter drawer once the page unmount.
  useEffect(
    () => () => toggleSalesProfitFilterDrawer(false),
    [toggleSalesProfitFilterDrawer],
  );

  return (
    <SalesProfitProvider query={query}>
      <SalesProfitActionsBar
        numberFormat={query.numberFormat}
        onNumberFormatSubmit={handleNumberFormatSubmit}
      />
      <SalesProfitLoadingBar />

      <DashboardPageContent>
        <FinancialStatement>
          <SalesProfitHeader
            pageFilter={query}
            onSubmitFilter={handleFilterSubmit}
          />
          <SalesProfitBody />
        </FinancialStatement>
      </DashboardPageContent>

      <SalesProfitDialogs />
    </SalesProfitProvider>
  );
}

export default compose(withSalesProfitActions)(SalesProfit);
