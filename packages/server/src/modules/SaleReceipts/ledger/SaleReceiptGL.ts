import * as R from 'ramda';
import { ILedger } from '@/modules/Ledger/types/Ledger.types';
import { AccountNormal } from '@/modules/Accounts/Accounts.types';
import { ILedgerEntry } from '@/modules/Ledger/types/Ledger.types';
import { Ledger } from '@/modules/Ledger/Ledger';
import { SaleReceipt } from '../models/SaleReceipt';
import { ItemEntry } from '@/modules/TransactionItemEntry/models/ItemEntry';

export class SaleReceiptGL {
  private saleReceipt: SaleReceipt;
  private discountAccountId: number;
  private otherChargesAccountId: number;
  private suppliersFundsAccountId: number;

  /**
   * Constructor method.
   * @param {SaleReceipt} saleReceipt - Sale receipt.
   */
  constructor(saleReceipt: SaleReceipt) {
    this.saleReceipt = saleReceipt;
  }

  /**
   * Sets the discount account id.
   * @param {number} discountAccountId - Discount account id.
   */
  setDiscountAccountId(discountAccountId: number) {
    this.discountAccountId = discountAccountId;
    return this;
  }

  /**
   * Sets the other charges account id.
   * @param {number} otherChargesAccountId - Other charges account id.
   */
  setOtherChargesAccountId(otherChargesAccountId: number) {
    this.otherChargesAccountId = otherChargesAccountId;
    return this;
  }

  /**
   * Sets the suppliers funds held account id.
   * @param {number} suppliersFundsAccountId - Suppliers funds held account id.
   */
  setSuppliersFundsAccountId(suppliersFundsAccountId: number) {
    this.suppliersFundsAccountId = suppliersFundsAccountId;
    return this;
  }

  /**
   * Retrieves the income GL common entry.
   */
  private getIncomeGLCommonEntry = () => {
    return {
      currencyCode: this.saleReceipt.currencyCode,
      exchangeRate: this.saleReceipt.exchangeRate,

      transactionType: 'SaleReceipt',
      transactionId: this.saleReceipt.id,

      date: this.saleReceipt.receiptDate,

      transactionNumber: this.saleReceipt.receiptNumber,
      referenceNumber: this.saleReceipt.referenceNo,

      createdAt: this.saleReceipt.createdAt,

      credit: 0,
      debit: 0,

      userId: this.saleReceipt.userId,
      branchId: this.saleReceipt.branchId,
    };
  };

  /**
   * Retrieve receipt income item G/L entry.
   * @param {ItemEntry} entry - Item entry.
   * @param {number} index - Index.
   * @returns {ILedgerEntry}
   */
  private getReceiptIncomeItemEntry = R.curry(
    (entry: ItemEntry, index: number): ILedgerEntry => {
      const commonEntry = this.getIncomeGLCommonEntry();
      const hasCost =
        entry.costAmount > 0 && entry.item?.type !== 'inventory';
      const incomeBase = hasCost ? entry.margin : entry.totalExcludingTax;
      const totalLocal = incomeBase * this.saleReceipt.exchangeRate;

      return {
        ...commonEntry,
        credit: totalLocal,
        accountId: entry.item.sellAccountId,
        note: entry.description,
        index: index + 2,
        itemId: entry.itemId,
        accountNormal: AccountNormal.CREDIT,
      };
    },
  );

  /**
   * Retrieve the cost liability entry of a service item line.
   * Credits the "Funds held for suppliers" account for the cost portion.
   * @param {ItemEntry} entry - Item entry.
   * @param {number} index - Index.
   * @returns {ILedgerEntry}
   */
  private getReceiptCostEntry = R.curry(
    (entry: ItemEntry, index: number): ILedgerEntry => {
      const commonEntry = this.getIncomeGLCommonEntry();
      const costLocal = entry.costAmount * this.saleReceipt.exchangeRate;

      return {
        ...commonEntry,
        credit: costLocal,
        accountId: this.suppliersFundsAccountId,
        note: entry.description,
        index: index + 2,
        indexGroup: 20,
        itemId: entry.itemId,
        accountNormal: AccountNormal.CREDIT,
      };
    },
  );

  /**
   * Retrieves the receipt deposit GL deposit entry.
   * @returns {ILedgerEntry}
   */
  private getReceiptDepositEntry = (): ILedgerEntry => {
    const commonEntry = this.getIncomeGLCommonEntry();

    return {
      ...commonEntry,
      debit: this.saleReceipt.totalLocal,
      accountId: this.saleReceipt.depositAccountId,
      index: 1,
      accountNormal: AccountNormal.DEBIT,
    };
  };

  /**
   * Retrieves the discount GL entry.
   * @returns {ILedgerEntry}
   */
  private getDiscountEntry = (): ILedgerEntry => {
    const commonEntry = this.getIncomeGLCommonEntry();

    return {
      ...commonEntry,
      debit: this.saleReceipt.discountAmountLocal,
      accountId: this.discountAccountId,
      index: 1,
      accountNormal: AccountNormal.CREDIT,
    };
  };

  /**
   * Retrieves the adjustment GL entry.
   * @returns {ILedgerEntry}
   */
  private getAdjustmentEntry = (): ILedgerEntry => {
    const commonEntry = this.getIncomeGLCommonEntry();
    const adjustmentAmount = Math.abs(this.saleReceipt.adjustmentLocal);

    return {
      ...commonEntry,
      debit: this.saleReceipt.adjustmentLocal < 0 ? adjustmentAmount : 0,
      credit: this.saleReceipt.adjustmentLocal > 0 ? adjustmentAmount : 0,
      accountId: this.otherChargesAccountId,
      accountNormal: AccountNormal.CREDIT,
      index: 1,
    };
  };

  /**
   * Retrieves the income GL entries.
   * @returns {ILedgerEntry[]}
   */
  public getIncomeGLEntries = (): ILedgerEntry[] => {
    const getItemEntry = this.getReceiptIncomeItemEntry;

    const creditEntries = this.saleReceipt.entries.map((e, index) =>
      getItemEntry(e, index),
    );
    const costEntries = this.saleReceipt.entries
      .filter(
        (entry) => entry.costAmount > 0 && entry.item?.type !== 'inventory',
      )
      .map((entry, index) => this.getReceiptCostEntry(entry, index));
    const depositEntry = this.getReceiptDepositEntry();
    const discountEntry = this.getDiscountEntry();
    const adjustmentEntry = this.getAdjustmentEntry();

    return [
      depositEntry,
      ...creditEntries,
      ...costEntries,
      discountEntry,
      adjustmentEntry,
    ];
  };

  /**
   * Retrieves the income GL ledger.
   * @returns {ILedger}
   */
  public getIncomeLedger = (): ILedger => {
    const entries = this.getIncomeGLEntries();

    return new Ledger(entries);
  };
}
