import {
  IsBoolean,
  IsDateString,
  IsNotEmpty,
  IsOptional,
  ValidateNested,
} from 'class-validator';
import { INumberFormatQuery } from '../../types/Report.types';
import { Transform, Type } from 'class-transformer';
import { NumberFormatQueryDto } from '@/modules/BankingTransactions/dtos/NumberFormatQuery.dto';
import { parseBoolean } from '@/utils/parse-boolean';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class SalesProfitQueryDto {
  @ApiPropertyOptional({
    description: 'Start date for the sales profit report',
    example: '2024-01-01',
    type: String,
  })
  @IsDateString()
  @IsNotEmpty()
  fromDate: Date | string;

  @ApiPropertyOptional({
    description: 'End date for the sales profit report',
    example: '2024-01-31',
    type: String,
  })
  @IsDateString()
  @IsNotEmpty()
  toDate: Date | string;

  @ApiPropertyOptional({
    description: 'Number formatting options for the report',
    type: NumberFormatQueryDto,
  })
  @ValidateNested()
  @Type(() => NumberFormatQueryDto)
  @IsOptional()
  numberFormat: INumberFormatQuery;

  @ApiPropertyOptional({
    description: 'Whether to exclude rows with no transactions',
    example: false,
    type: Boolean,
    default: false,
  })
  @IsBoolean()
  @Transform(({ value }) => parseBoolean(value, false))
  @IsOptional()
  noneTransactions: boolean;

  @ApiPropertyOptional({
    description: 'Whether to include only active rows',
    example: false,
    type: Boolean,
    default: false,
  })
  @IsBoolean()
  @Transform(({ value }) => parseBoolean(value, false))
  @IsOptional()
  onlyActive: boolean;
}
