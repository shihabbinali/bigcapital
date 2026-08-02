import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { NumberFormatQueryDto } from '@/modules/BankingTransactions/dtos/NumberFormatQuery.dto';
import {
  FinancialReportMetaDto,
  FinancialTableDataDto,
} from '../../dtos/FinancialReportResponse.dto';

export class SalesProfitRowDto {
  @ApiProperty({ description: 'Document date' })
  date: string;

  @ApiProperty({ description: 'Document number' })
  docNumber: string;

  @ApiProperty({ description: 'Document type (SaleInvoice/SaleReceipt)' })
  docType: string;

  @ApiProperty({ description: 'Customer name' })
  customerName: string;

  @ApiProperty({ description: 'Service item name' })
  itemName: string;

  @ApiProperty({ description: 'Quantity', type: Number })
  quantity: number;

  @ApiProperty({ description: 'Revenue (rate * quantity)', type: Number })
  revenue: number;

  @ApiProperty({ description: 'Cost (cost_rate * quantity)', type: Number })
  cost: number;

  @ApiProperty({ description: 'Profit (revenue - cost)', type: Number })
  profit: number;

  @ApiProperty({ description: 'Margin percentage', type: Number })
  marginPct: number;
}

export class SalesProfitTotalDto {
  @ApiProperty({ description: 'Total quantity', type: Number })
  quantity: number;

  @ApiProperty({ description: 'Total revenue', type: Number })
  revenue: number;

  @ApiProperty({ description: 'Total cost', type: Number })
  cost: number;

  @ApiProperty({ description: 'Total profit', type: Number })
  profit: number;

  @ApiProperty({ description: 'Overall margin percentage', type: Number })
  marginPct: number;
}

export class SalesProfitSheetDataDto {
  @ApiProperty({ description: 'Sales profit rows', type: [SalesProfitRowDto] })
  rows: SalesProfitRowDto[];

  @ApiProperty({ description: 'Sales profit totals', type: SalesProfitTotalDto })
  total: SalesProfitTotalDto;
}

export class SalesProfitMetaDto extends FinancialReportMetaDto {
  @ApiProperty({ description: 'Formatted from date' })
  formattedFromDate: string;

  @ApiProperty({ description: 'Formatted to date' })
  formattedToDate: string;

  @ApiProperty({ description: 'Formatted date range' })
  formattedDateRange: string;
}

export class SalesProfitQueryResponseDto {
  @ApiProperty({ description: 'Start date' })
  fromDate: string;

  @ApiProperty({ description: 'End date' })
  toDate: string;

  @ApiPropertyOptional({ description: 'Number format settings', type: NumberFormatQueryDto })
  numberFormat: NumberFormatQueryDto;

  @ApiPropertyOptional({ description: 'Whether to exclude rows with no transactions', type: Boolean })
  noneTransactions: boolean;

  @ApiPropertyOptional({ description: 'Whether to include only active rows', type: Boolean })
  onlyActive: boolean;
}

export class SalesProfitResponseDto {
  @ApiProperty({ description: 'Query parameters used to generate the report', type: SalesProfitQueryResponseDto })
  query: SalesProfitQueryResponseDto;

  @ApiProperty({ description: 'Sales profit data', type: SalesProfitSheetDataDto })
  data: SalesProfitSheetDataDto;

  @ApiProperty({ description: 'Report metadata', type: SalesProfitMetaDto })
  meta: SalesProfitMetaDto;
}

// Re-export table DTOs for convenience
export {
  FinancialTableCellDto as SalesProfitTableCellDto,
  FinancialTableRowDto as SalesProfitTableRowDto,
  FinancialTableColumnDto as SalesProfitTableColumnDto,
  FinancialTableDataDto as SalesProfitTableDataDto,
} from '../../dtos/FinancialReportResponse.dto';

export class SalesProfitTableResponseDto {
  @ApiProperty({ description: 'Table data structure', type: () => FinancialTableDataDto })
  table: FinancialTableDataDto;

  @ApiProperty({ description: 'Query parameters used to generate the report', type: SalesProfitQueryResponseDto })
  query: SalesProfitQueryResponseDto;

  @ApiProperty({ description: 'Report metadata', type: SalesProfitMetaDto })
  meta: SalesProfitMetaDto;
}
