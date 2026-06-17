import { Module, Global } from '@nestjs/common';
import { SevdeskService } from './sevdesk.service';

@Global()
@Module({
  providers: [SevdeskService],
  exports: [SevdeskService],
})
export class SevdeskModule {}
