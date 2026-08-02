export enum ROW_TYPE {
  ITEM = 'ITEM',
  TOTAL = 'TOTAL',
}

export const HtmlTableCustomCss = `
table tr.row-type--total td {
  border-top: 1px solid #bbb;
  border-bottom: 3px double #000;
  font-weight: 600;
}
table .column--date,
table .column--doc_number,
table .column--customer_name,
table .column--item_name{
  text-align: left;
}
table .column--item_name{
  width: 220px;
}
table .column--quantity,
table .column--revenue,
table .column--cost,
table .column--profit,
table .column--margin_pct,
table .cell--quantity,
table .cell--revenue,
table .cell--cost,
table .cell--profit,
table .cell--margin_pct{
  text-align: right;
}
`;
