// @ts-nocheck
import React from 'react';
import intl from 'react-intl-universal';
import styled from 'styled-components';

import { ReportDataTable, FinancialSheet } from '@/components';
import { useSalesProfitContext } from './SalesProfitProvider';
import { useSalesProfitTableColumns } from './dynamicColumns';
import { tableRowTypesToClassnames } from '@/utils';
import { TableStyle } from '@/constants';

/**
 * Sales profit data table.
 */
export default function SalesProfitTable({ companyName }) {
  // Sales profit context.
  const {
    salesProfit: { table, query, meta },
    isLoading,
  } = useSalesProfitContext();

  // Sales profit table columns.
  const columns = useSalesProfitTableColumns();

  return (
    <SalesProfitSheet
      companyName={companyName}
      sheetType={intl.get('sales_profit')}
      dateText={meta?.formatted_date_range ?? meta?.formatted_as_date}
      loading={isLoading}
    >
      <SalesProfitDataTable
        columns={columns}
        data={table.rows}
        expandable={true}
        expandToggleColumn={1}
        expandColumnSpace={1}
        sticky={true}
        rowClassNames={tableRowTypesToClassnames}
        noResults={intl.get(
          'there_were_no_sales_during_the_selected_date_range',
        )}
        styleName={TableStyle.Constrant}
      />
    </SalesProfitSheet>
  );
}

const SalesProfitSheet = styled(FinancialSheet)`
  min-width: 850px;
`;

const SalesProfitDataTable = styled(ReportDataTable)`
  --x-table-total-border-bottom-color: #000;
  --x-table-total-border-top-color: #bbb;
  --x-table-total-border-bottom-color: var(
    --color-datatable-constrant-cell-border
  );
  --x-table-total-border-top-color: var(
    --color-datatable-constrant-cell-border
  );

  .table {
    .tbody {
      .tr .td {
        border-bottom-width: 0;
        padding-top: 0.4rem;
        padding-bottom: 0.4rem;
      }
      .tr.row_type--TOTAL .td {
        border-top-width: 1px;
        font-weight: 500;
        border-top-width: 1px;
        border-top-style: solid;
        border-top-color: var(--x-table-total-border-top-color);
        border-bottom-style: double;
        border-bottom-width: 3px;
        border-bottom-color: var(--x-table-total-border-bottom-color);
      }
    }
  }
`;
