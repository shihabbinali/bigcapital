import { ToNumber } from '@/common/decorators/Validators';
import { IsNumber, IsOptional, IsString } from 'class-validator';

export class GetContactsAutoCompleteQuery {
  @IsNumber()
  @ToNumber()
  @IsOptional()
  limit: number;

  @IsString()
  @IsOptional()
  keyword: string;
}
