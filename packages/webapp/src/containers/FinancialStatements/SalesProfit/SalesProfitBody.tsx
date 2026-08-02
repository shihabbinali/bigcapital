// @ts-nocheck
import React from 'react';
import * as R from 'ramda';

import { FinancialReportBody } from '../FinancialReportPage';
import { FinancialSheetSkeleton } from '@/components/FinancialSheet';
import { useSalesProfitContext } from './SalesProfitProvider';

import SalesProfitTable from './SalesProfitTable';
import { withCurrentOrganization } from '@/containers/Organization/withCurrentOrganization';

/**
 *
 * @returns {JSX.Element}
 */
function SalesProfitBodyJSX({
  // #withCurrentOrganization
  organizationName,
}) {
  const { isLoading } = useSalesProfitContext();

  return (
    <FinancialReportBody>
      {isLoading ? (
        <FinancialSheetSkeleton />
      ) : (
        <SalesProfitTable companyName={organizationName} />
      )}
    </FinancialReportBody>
  );
}

export const SalesProfitBody = R.compose(
  withCurrentOrganization(({ organization }) => ({
    organizationName: organization.name,
  })),
)(SalesProfitBodyJSX);
