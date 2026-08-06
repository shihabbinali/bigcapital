import { Injectable } from '@nestjs/common';
import type {
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class GlobalPrefixInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    request.url = `/api${request.url}`;
    return next.handle().pipe(
      map((data) => {
        return data;
      }),
    );
  }
}
