// @ts-nocheck
import React from 'react';
import moment from 'moment';
import styled from 'styled-components';
import { Formik, Form } from 'formik';
import { Tabs, Tab, Button, Intent } from '@blueprintjs/core';
import { FormattedMessage as T } from '@/components';

import FinancialStatementHeader from '../FinancialStatementHeader';
import SalesProfitHeaderGeneralPanel from './SalesProfitHeaderGeneralPanel';

import { withSalesProfit } from './withSalesProfit';
import { withSalesProfitActions } from './withSalesProfitActions';

import { compose, transformToForm } from '@/utils';
import {
  getDefaultSalesProfitQuery,
  getSalesProfitQueryShema,
} from './utils';

/**
 * Sales profit header.
 */
function SalesProfitHeader({
  // #ownProps
  pageFilter,
  onSubmitFilter,

  // #withSalesProfit
  salesProfitDrawerFilter,

  // #withSalesProfitActions
  toggleSalesProfitFilterDrawer,
}) {
  // Form validation schema.
  const validationSchema = getSalesProfitQueryShema();

  const defaultQuery = getDefaultSalesProfitQuery();

  // Initial values.
  const initialValues = transformToForm(
    {
      ...defaultQuery,
      ...pageFilter,
      fromDate: moment(pageFilter.fromDate).toDate(),
      toDate: moment(pageFilter.toDate).toDate(),
    },
    defaultQuery,
  );

  // Handle the form submitting.
  const handleSubmit = (values, { setSubmitting }) => {
    onSubmitFilter(values);
    setSubmitting(false);
    toggleSalesProfitFilterDrawer(false);
  };

  // Handle drawer close action.
  const handleDrawerClose = () => {
    toggleSalesProfitFilterDrawer(false);
  };

  // Handle cancel button click.
  const handleCancelClick = () => {
    toggleSalesProfitFilterDrawer(false);
  };

  return (
    <SalesProfitDrawerHeader
      isOpen={salesProfitDrawerFilter}
      drawerProps={{ onClose: handleDrawerClose }}
    >
      <Formik
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={handleSubmit}
      >
        <Form>
          <Tabs animate={true} vertical={true} renderActiveTabPanelOnly={true}>
            <Tab
              id="general"
              title={<T id={'general'} />}
              panel={<SalesProfitHeaderGeneralPanel />}
            />
          </Tabs>
          <div class="financial-header-drawer__footer">
            <Button className={'mr1'} intent={Intent.PRIMARY} type={'submit'}>
              <T id={'calculate_report'} />
            </Button>
            <Button onClick={handleCancelClick} minimal={true}>
              <T id={'cancel'} />
            </Button>
          </div>
        </Form>
      </Formik>
    </SalesProfitDrawerHeader>
  );
}

export default compose(
  withSalesProfit(({ salesProfitDrawerFilter }) => ({
    salesProfitDrawerFilter,
  })),
  withSalesProfitActions,
)(SalesProfitHeader);

const SalesProfitDrawerHeader = styled(FinancialStatementHeader)`
  .bp4-drawer {
    max-height: 450px;
  }
`;
