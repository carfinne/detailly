import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth(): object {
    return {
      status: 'ok',
      app: 'Detailly API',
      version: '0.1.0',
      timestamp: new Date().toISOString(),
    };
  }
}
