import * as moment from 'moment';

export const getSalesProfitDefaultQuery = () => {
  return {
    fromDate: moment().startOf('month').format('YYYY-MM-DD'),
    toDate: moment().format('YYYY-MM-DD'),
    numberFormat: {
      precision: 2,
      divideOn1000: false,
      showZero: false,
      formatMoney: 'always',
      negativeFormat: 'mines',
    },
    noneTransactions: false,
    onlyActive: false,
  };
};
