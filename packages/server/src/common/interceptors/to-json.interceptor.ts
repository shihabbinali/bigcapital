import { Injectable } from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { map } from 'rxjs';
import { Observable } from 'rxjs';
import { mapValuesDeep } from '@/utils/deepdash';

@Injectable()
export class ToJsonInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    return next.handle().pipe(
      map((data) => {
        if (data === null || data === undefined) {
          return data;
        }
        return mapValuesDeep(data, (value) => {
          if (
            value !== null &&
            value !== undefined &&
            typeof value.toJSON === 'function'
          ) {
            return value.toJSON();
          }
          return value;
        });
      }),
    );
  }
}
