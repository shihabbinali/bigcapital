import { Injectable } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class ApiKeyAuthGuard extends AuthGuard('apiKey') {
  constructor() {
    super();
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
