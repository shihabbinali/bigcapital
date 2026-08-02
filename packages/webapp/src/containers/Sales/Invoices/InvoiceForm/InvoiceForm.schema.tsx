// @ts-nocheck
import * as Yup from 'yup';
import moment from 'moment';
import intl from 'react-intl-universal';
import { DATATYPES_LENGTH } from '@/constants/dataTypes';
import { isBlank } from '@/utils';
import { TaxType } from '@/interfaces/TaxRates';

const getSchema = () =>
  Yup.object().shape({
    customer_id: Yup.string().nullable().label(intl.get('customer_name_')),
    customer_name: Yup.string()
      .nullable()
      .max(DATATYPES_LENGTH.STRING)
      .label(intl.get('customer_name_')),
    invoice_date: Yup.date().required().label(intl.get('invoice_date_')),
    due_date: Yup.date()
      .min(Yup.ref('invoice_date'), ({ path, min }) =>
        intl.get('invoice.validation.due_date', {
          path,
          min: moment(min).format('YYYY/MM/DD'),
        }),
      )
      .required()
      .label(intl.get('due_date_')),
    invoice_no: Yup.string()
      .max(DATATYPES_LENGTH.STRING)
      .label(intl.get('invoice_no_')),
    reference_no: Yup.string().min(1).max(DATATYPES_LENGTH.STRING),
    delivered: Yup.boolean(),
    from_estimate_id: Yup.string(),
    invoice_message: Yup.string()
      .trim()
      .min(1)
      .max(DATATYPES_LENGTH.TEXT)
      .label(intl.get('note')),
    terms_conditions: Yup.string()
      .trim()
      .min(1)
      .max(DATATYPES_LENGTH.TEXT)
      .label(intl.get('note')),
    exchange_rate: Yup.number(),
    inclusive_exclusive_tax: Yup.string().oneOf([
      TaxType.Inclusive,
      TaxType.Exclusive,
    ]),
    branch_id: Yup.string(),
    warehouse_id: Yup.string(),
    project_id: Yup.string(),
    entries: Yup.array().of(
      Yup.object().shape({
        quantity: Yup.number()
          .nullable()
          .max(DATATYPES_LENGTH.INT_10)
          .when(['rate'], {
            is: (rate) => rate,
            then: Yup.number().required(),
          }),
        rate: Yup.number().nullable().max(DATATYPES_LENGTH.INT_10),
        item_id: Yup.number()
          .nullable()
          .when(['quantity', 'rate'], {
            is: (quantity, rate) => !isBlank(quantity) && !isBlank(rate),
            then: Yup.number().required(),
          }),
        discount: Yup.number().nullable().min(0).max(100),
        description: Yup.string().nullable().max(DATATYPES_LENGTH.TEXT),
      }),
    ),
  })
  .test(
    'customer-or-name',
    intl.get('customer_or_name_required'),
    (value) => !!value.customer_id || !!value.customer_name,
  );

export const getCreateInvoiceFormSchema = getSchema;
export const getEditInvoiceFormSchema = getSchema;
