import { Controller, Get, Headers, Query, Res, UseGuards } from '@nestjs/common';
import { AcceptType } from '@/constants/accept-type';
import { SalesProfitApplication } from './SalesProfitApplication';
import type { Response } from 'express';
import {
  ApiExtraModels,
  ApiOperation,
  ApiResponse,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { SalesProfitQueryDto } from './SalesProfitQuery.dto';
import {
  SalesProfitResponseDto,
  SalesProfitTableResponseDto,
} from './SalesProfitResponse.dto';
import { ApiCommonHeaders } from '@/common/decorators/ApiCommonHeaders';
import { RequirePermission } from '@/modules/Roles/RequirePermission.decorator';
import { PermissionGuard } from '@/modules/Roles/Permission.guard';
import { AuthorizationGuard } from '@/modules/Roles/Authorization.guard';
import { AbilitySubject } from '@/modules/Roles/Roles.types';
import { ReportsAction } from '../../types/Report.types';

@Controller('/reports/sales-profit')
@ApiTags('Reports')
@ApiCommonHeaders()
@UseGuards(AuthorizationGuard, PermissionGuard)
@ApiExtraModels(SalesProfitResponseDto, SalesProfitTableResponseDto)
export class SalesProfitController {
  constructor(private readonly salesProfitApp: SalesProfitApplication) {}

  @Get()
  @RequirePermission(ReportsAction.READ_SALES_PROFIT, AbilitySubject.Report)
  @ApiResponse({
    status: 200,
    description: 'Sales profit report',
    content: {
      [AcceptType.ApplicationJson]: {
        schema: { $ref: getSchemaPath(SalesProfitResponseDto) },
      },
      [AcceptType.ApplicationJsonTable]: {
        schema: { $ref: getSchemaPath(SalesProfitTableResponseDto) },
      },
    },
  })
  @ApiOperation({
    summary: 'Sales profit report',
    description: 'Retrieves the sales profit report.',
  })
  public async salesProfit(
    @Query() filter: SalesProfitQueryDto,
    @Res({ passthrough: true }) res: Response,
    @Headers('accept') acceptHeader: string,
  ) {
    const accept = acceptHeader || '';
    // Retrieves the csv format.
    if (accept.includes(AcceptType.ApplicationCsv)) {
      const buffer = await this.salesProfitApp.csv(filter);

      res.setHeader('Content-Disposition', 'attachment; filename=output.csv');
      res.setHeader('Content-Type', 'text/csv');

      res.send(buffer);
      // Retrieves the json table format.
    } else if (accept.includes(AcceptType.ApplicationJsonTable)) {
      return this.salesProfitApp.table(filter);
      // Retrieves the xlsx format.
    } else if (accept.includes(AcceptType.ApplicationXlsx)) {
      const buffer = this.salesProfitApp.xlsx(filter);

      res.setHeader('Content-Disposition', 'attachment; filename=output.xlsx');
      res.setHeader(
        'Content-Type',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      );
      res.send(buffer);
      // Retrieves the json format.
    } else if (accept.includes(AcceptType.ApplicationPdf)) {
      const pdfContent = await this.salesProfitApp.pdf(filter);

      res.set({
        'Content-Type': 'application/pdf',
        'Content-Length': pdfContent.length,
      });
      res.send(pdfContent);
    } else {
      return this.salesProfitApp.sheet(filter);
    }
  }
}
