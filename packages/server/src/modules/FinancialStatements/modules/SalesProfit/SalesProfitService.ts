import { SalesProfitMeta } from './SalesProfitMeta';
import { getSalesProfitDefaultQuery } from './utils';
import { Inject, Injectable } from '@nestjs/common';
import { EventEmitter2 } from '@nestjs/event-emitter';
import type {
  ISalesProfitQuery,
  ISalesProfitSheet,
  ISalesProfitParent,
} from './SalesProfit.types';
import { ItemEntry } from '@/modules/TransactionItemEntry/models/ItemEntry';
import { SaleInvoice } from '@/modules/SaleInvoices/models/SaleInvoice';
import { SaleReceipt } from '@/modules/SaleReceipts/models/SaleReceipt';
import { TenancyContext } from '@/modules/Tenancy/TenancyContext.service';
import { SalesProfitReport } from './SalesProfit';
import type { TenantModelProxy } from '@/modules/System/models/TenantBaseModel';
import type { ModelObject } from 'objection';
import { get } from 'lodash';
import { events } from '@/common/events/events';
import { UserScopedQueryService } from '@/modules/Roles/UserScopedQuery.service';

@Injectable()
export class SalesProfitReportService {
  constructor(
    private readonly salesProfitMeta: SalesProfitMeta,
    private readonly eventPublisher: EventEmitter2,
    private readonly tenancyContext: TenancyContext,
    private readonly userScopedQuery: UserScopedQueryService,

    @Inject(ItemEntry.name)
    private readonly itemEntryModel: TenantModelProxy<typeof ItemEntry>,

    @Inject(SaleInvoice.name)
    private readonly saleInvoiceModel: TenantModelProxy<typeof SaleInvoice>,

    @Inject(SaleReceipt.name)
    private readonly saleReceiptModel: TenantModelProxy<typeof SaleReceipt>,
  ) {}

  /**
   * Retrieve the sales profit report statement.
   * @param {ISalesProfitQuery} query - The sales profit report query.
   * @returns {Promise<ISalesProfitSheet>}
   */
  public async salesProfit(
    query: ISalesProfitQuery,
  ): Promise<ISalesProfitSheet> {
    const filter = {
      ...getSalesProfitDefaultQuery(),
      ...query,
    };
    const tenantMetadata = await this.tenancyContext.getTenantMetadata();

    // 1. Retrieve all item entries that reference sales documents.
    const entries = await this.itemEntryModel()
      .query()
      .onBuild((builder: any) => {
        builder.whereIn('referenceType', ['SaleInvoice', 'SaleReceipt']);
      })
      .withGraphFetched('item');

    // 2. Collect the parent invoice/receipt ids.
    const invoiceIds: number[] = entries
      .filter((entry) => entry.referenceType === 'SaleInvoice')
      .map((entry) => Number(get(entry, 'referenceId')))
      .filter((id) => !Number.isNaN(id));

    const receiptIds: number[] = entries
      .filter((entry) => entry.referenceType === 'SaleReceipt')
      .map((entry) => Number(get(entry, 'referenceId')))
      .filter((id) => !Number.isNaN(id));

    // 3. Query sale invoices filtered by date range.
    const invoiceMap = new Map<string, ISalesProfitParent>();
    if (invoiceIds.length > 0) {
      const invoices = await this.saleInvoiceModel()
        .query()
        .onBuild(async (builder: any) => {
          builder.whereIn('id', invoiceIds);
          builder.modify('filterDateRange', filter.fromDate, filter.toDate);

          await this.userScopedQuery.applyUserScope(builder, 'userId');
        })
        .withGraphFetched('customer');

      invoices.forEach((invoice: ModelObject<SaleInvoice>) => {
        invoiceMap.set(String(invoice.id), {
          date: invoice.invoiceDate,
          number: invoice.invoiceNo,
          customerName:
            get(invoice, ['customer', 'displayName'], null) ||
            invoice.customerName,
        });
      });
    }

    // 4. Query sale receipts filtered by date range.
    const receiptMap = new Map<string, ISalesProfitParent>();
    if (receiptIds.length > 0) {
      const receipts = await this.saleReceiptModel()
        .query()
        .onBuild(async (builder: any) => {
          builder.whereIn('id', receiptIds);
          builder.where('receipt_date', '>=', filter.fromDate);
          builder.where('receipt_date', '<=', filter.toDate);

          await this.userScopedQuery.applyUserScope(builder, 'userId');
        })
        .withGraphFetched('customer');

      receipts.forEach((receipt: ModelObject<SaleReceipt>) => {
        receiptMap.set(String(receipt.id), {
          date: receipt.receiptDate,
          number: receipt.receiptNumber,
          customerName:
            get(receipt, ['customer', 'displayName'], null) ||
            receipt.customerName,
        });
      });
    }

    // 5. Filter entries to only those whose parent exists in the date-filtered maps.
    const filteredEntries = entries.filter((entry) => {
      const referenceId = String(get(entry, 'referenceId', ''));
      if (entry.referenceType === 'SaleInvoice') {
        return invoiceMap.has(referenceId);
      }
      if (entry.referenceType === 'SaleReceipt') {
        return receiptMap.has(referenceId);
      }
      return false;
    });

    // 6. Retrieve the report meta first to get date format.
    const meta = await this.salesProfitMeta.meta(query);

    const sheet = new SalesProfitReport(
      filter,
      filteredEntries,
      invoiceMap,
      receiptMap,
      {
        baseCurrency: tenantMetadata.baseCurrency,
        dateFormat: meta.dateFormat,
      },
    );
    const salesProfitData = sheet.reportData();

    // Triggers `onSalesProfitViewed` event.
    await this.eventPublisher.emitAsync(events.reports.onSalesProfitViewed, {
      query,
    });

    return {
      data: salesProfitData,
      query: filter,
      meta,
    };
  }
}
