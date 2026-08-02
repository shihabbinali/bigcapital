import { Module } from '@nestjs/common';
import { SalesProfitApplication } from './SalesProfitApplication';
import { SalesProfitTableInjectable } from './SalesProfitTableInjectable';
import { SalesProfitPdfInjectable } from './SalesProfitPdfInjectable';
import { SalesProfitReportService } from './SalesProfitService';
import { SalesProfitExport } from './SalesProfitExport';
import { FinancialSheetCommonModule } from '../../common/FinancialSheetCommon.module';
import { SalesProfitMeta } from './SalesProfitMeta';
import { TenancyContext } from '@/modules/Tenancy/TenancyContext.service';
import { SalesProfitController } from './SalesProfit.controller';

@Module({
  providers: [
    SalesProfitApplication,
    SalesProfitTableInjectable,
    SalesProfitPdfInjectable,
    SalesProfitReportService,
    SalesProfitExport,
    SalesProfitMeta,
    TenancyContext,
  ],
  controllers: [SalesProfitController],
  imports: [FinancialSheetCommonModule],
})
export class SalesProfitModule {}
