// @ts-nocheck
import { connect } from 'react-redux';
import { getSalesProfitFilterDrawer } from '@/store/financialStatement/financialStatements.selectors';

export const withSalesProfit = (mapState) => {
  const mapStateToProps = (state, props) => {
    const mapped = {
      salesProfitDrawerFilter: getSalesProfitFilterDrawer(state),
    };
    return mapState ? mapState(mapped, state, props) : mapped;
  };
  return connect(mapStateToProps);
};
