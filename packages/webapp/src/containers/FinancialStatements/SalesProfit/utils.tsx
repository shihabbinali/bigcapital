// @ts-nocheck
import React from 'react';
import moment from 'moment';
import * as Yup from 'yup';
import intl from 'react-intl-universal';
import { useAppQueryString } from '@/hooks';
import { transformToForm } from '@/utils';

/**
 * Retrieves the validation schema.
 * @returns {Yup}
 */
export const getSalesProfitQueryShema = () => {
  return Yup.object().shape({
    fromDate: Yup.date().required().label(intl.get('from_date')),
    toDate: Yup.date()
      .min(Yup.ref('fromDate'))
      .required()
      .label(intl.get('to_date')),
  });
};

/**
 * Retrieves the default query.
 */
export const getDefaultSalesProfitQuery = () => ({
  fromDate: moment().startOf('month').format('YYYY-MM-DD'),
  toDate: moment().format('YYYY-MM-DD'),
  filterByOption: 'with-transactions',
});

/**
 * Parses sales profit query of browser location.
 */
const parseSalesProfitQuery = (locationQuery) => {
  const defaultQuery = getDefaultSalesProfitQuery();

  const transformed = {
    ...defaultQuery,
    ...transformToForm(locationQuery, defaultQuery),
  };
  return transformed;
};

/**
 * Sales profit query state.
 */
export const useSalesProfitQuery = () => {
  // Retrieves location query.
  const [locationQuery, setLocationQuery] = useAppQueryString();

  // Merges the default filter query with location URL query.
  const query = React.useMemo(
    () => parseSalesProfitQuery(locationQuery),
    [locationQuery],
  );
  return { query, locationQuery, setLocationQuery };
};
