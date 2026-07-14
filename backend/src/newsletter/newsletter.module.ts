import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NewsletterSubscriber } from './entities/newsletter-subscriber.entity';
import { NewsletterService } from './newsletter.service';
import { NewsletterController } from './newsletter.controller';
import { PublicNewsletterController } from './public-newsletter.controller';

/**
 * Plattform-Newsletter (Detailly als Verantwortlicher, KEIN Tenant-Scope).
 * MailService kommt aus dem globalen MailerModule – hier nur das Repository.
 */
@Module({
  imports: [TypeOrmModule.forFeature([NewsletterSubscriber])],
  controllers: [PublicNewsletterController, NewsletterController],
  providers: [NewsletterService],
})
export class NewsletterModule {}
