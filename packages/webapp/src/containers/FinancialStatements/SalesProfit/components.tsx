// @ts-nocheck
import { useRef } from 'react';
import classNames from 'classnames';
import { Classes } from '@blueprintjs/core';

import { AppToaster, If, Stack } from '@/components';
import { useSalesProfitContext } from './SalesProfitProvider';
import FinancialLoadingBar from '../FinancialLoadingBar';
import { Intent, Menu, MenuItem, ProgressBar, Text } from '@blueprintjs/core';
import {
  useSalesProfitCsvExport,
  useSalesProfitXlsxExport,
} from '@/hooks/query';

/**
 * Sales profit progress loading bar.
 */
export function SalesProfitLoadingBar() {
  const { isFetching } = useSalesProfitContext();
  return (
    <If condition={isFetching}>
      <FinancialLoadingBar />
    </If>
  );
}

/**
 * Retrieves the sales profit export menu.
 * @returns {JSX.Element}
 */
export const SalesProfitSheetExportMenu = () => {
  const toastKey = useRef(null);
  const commonToastConfig = { isCloseButtonShown: true, timeout: 2000, };
  const { httpQuery } = useSalesProfitContext();

  const openProgressToast = (amount: number) => {
    return (
      <Stack spacing={8}>
        <Text>The report has been exported successfully.</Text>
        <ProgressBar
          className={classNames('toast-progress', {
            [Classes.PROGRESS_NO_STRIPES]: amount >= 100,
          })}
          intent={amount < 100 ? Intent.PRIMARY : Intent.SUCCESS}
          value={amount / 100}
        />
      </Stack>
    );
  };
  // Export the report to xlsx.
  const { mutateAsync: xlsxExport } = useSalesProfitXlsxExport(httpQuery, {
    onDownloadProgress: (xlsxExportProgress: number) => {
      if (!toastKey.current) {
        toastKey.current = AppToaster.show({
          message: openProgressToast(xlsxExportProgress),
          ...commonToastConfig,
        });
      } else {
        AppToaster.show(
          {
            message: openProgressToast(xlsxExportProgress),
            ...commonToastConfig,
          },
          toastKey.current,
        );
      }
    },
  });
  // Export the report to csv.
  const { mutateAsync: csvExport } = useSalesProfitCsvExport(httpQuery, {
    onDownloadProgress: (xlsxExportProgress: number) => {
      if (!toastKey.current) {
        toastKey.current = AppToaster.show({
          message: openProgressToast(xlsxExportProgress),
          ...commonToastConfig,
        });
      } else {
        AppToaster.show(
          {
            message: openProgressToast(xlsxExportProgress),
            ...commonToastConfig,
          },
          toastKey.current,
        );
      }
    },
  });
  // Handle csv export button click.
  const handleCsvExportBtnClick = () => {
    csvExport();
  };
  // Handle xlsx export button click.
  const handleXlsxExportBtnClick = () => {
    xlsxExport();
  };

  return (
    <Menu>
      <MenuItem
        text={'XLSX (Microsoft Excel)'}
        onClick={handleXlsxExportBtnClick}
      />
      <MenuItem text={'CSV'} onClick={handleCsvExportBtnClick} />
    </Menu>
  );
};
