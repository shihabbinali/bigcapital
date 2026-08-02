// @ts-nocheck
import { connect } from 'react-redux';
import { toggleSalesProfitFilterDrawer } from '@/store/financialStatement/financialStatements.actions';

export const mapDispatchToProps = (dispatch) => ({
  toggleSalesProfitFilterDrawer: (toggle) =>
    dispatch(toggleSalesProfitFilterDrawer(toggle)),
});

export const withSalesProfitActions = connect(null, mapDispatchToProps);
