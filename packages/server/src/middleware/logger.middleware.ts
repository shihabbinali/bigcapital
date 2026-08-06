import { Injectable } from '@nestjs/common';
import type { NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

@Injectable()
export class LoggerMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    // @ts-expect-error
    req.test = 'test';
    next();
  }
}
