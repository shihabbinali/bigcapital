// @ts-nocheck
import { getColumnWidth } from '@/utils';
import * as R from 'ramda';
import { Align } from '@/constants';
import { useSalesProfitContext } from './SalesProfitProvider';

const getTableCellValueAccessor = (index) => `cells[${index}].value`;

const getReportColWidth = (data, accessor, headerText) => {
  return getColumnWidth(
    data,
    accessor,
    { magicSpacing: 10, minWidth: 100 },
    headerText,
  );
};

/**
 * Common column mapper.
 */
const commonColumnMapper = R.curry((data, column) => {
  const accessor = getTableCellValueAccessor(column.cell_index);

  return {
    key: column.key,
    Header: column.label,
    accessor,
    className: column.key,
    textOverview: true,
  };
});

/**
 * Money columns accessor.
 */
const moneyColumnAccessor = R.curry((data, column) => {
  const accessor = getTableCellValueAccessor(column.cell_index);
  const width = getReportColWidth(data, accessor, column.label);

  return {
    ...column,
    align: Align.Right,
    width,
    money: true,
  };
});

/**
 * Numeric columns accessor (right-aligned, not money).
 */
const numericColumnAccessor = R.curry((data, column) => {
  const accessor = getTableCellValueAccessor(column.cell_index);
  const width = getReportColWidth(data, accessor, column.label);

  return {
    ...column,
    align: Align.Right,
    width,
  };
});

const dynamiColumnMapper = R.curry((data, column) => {
  const _moneyColumnAccessor = moneyColumnAccessor(data);
  const _numericColumnAccessor = numericColumnAccessor(data);

  return R.compose(
    R.when(R.pathEq(['key'], 'revenue'), _moneyColumnAccessor),
    R.when(R.pathEq(['key'], 'cost'), _moneyColumnAccessor),
    R.when(R.pathEq(['key'], 'profit'), _moneyColumnAccessor),
    R.when(R.pathEq(['key'], 'quantity'), _numericColumnAccessor),
    R.when(R.pathEq(['key'], 'margin_pct'), _numericColumnAccessor),
    commonColumnMapper(data),
  )(column);
});

/**
 * Composes the dynamic columns that fetched from request to columns to table component.
 */
export const dynamicColumns = R.curry((data, columns) => {
  return R.map(dynamiColumnMapper(data), columns);
});

/**
 * Retrieves the sales profit sheet table columns for table component.
 */
export const useSalesProfitTableColumns = () => {
  const { salesProfit } = useSalesProfitContext();

  if (!salesProfit) {
    throw new Error('Sales profit context not found');
  }
  const { table } = salesProfit;

  return dynamicColumns(table.rows, table.columns);
};
