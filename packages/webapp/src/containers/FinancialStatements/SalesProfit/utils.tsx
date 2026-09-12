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
    userId: Yup.number().nullable(),
  });
};

/**
 * Retrieves the default query.
 */
export const getDefaultSalesProfitQuery = () => ({
  fromDate: moment().startOf('month').format('YYYY-MM-DD'),
  toDate: moment().format('YYYY-MM-DD'),
  filterByOption: 'with-transactions',
  userId: '',
});

/**
 * Parses sales profit query of browser location.
 */
const parseSalesProfitQuery = (locationQuery) => {
  const defaultQuery = getDefaultSalesProfitQuery();

  const transformed = {
    ...defaultQuery,
    ...transformToForm(locationQuery, defaultQuery),
    // Coerce the URL string to a number so the user select matches by id.
    userId: locationQuery.userId ? Number(locationQuery.userId) : '',
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
