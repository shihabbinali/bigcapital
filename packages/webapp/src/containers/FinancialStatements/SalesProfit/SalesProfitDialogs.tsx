import { DialogsName } from '@/constants/dialogs';
import { SalesProfitPdfDialog } from './dialogs/SalesProfitPdfDialog';

export function SalesProfitDialogs() {
  return (
    <>
      <SalesProfitPdfDialog dialogName={DialogsName.SalesProfitPdfPreview} />
    </>
  );
}
