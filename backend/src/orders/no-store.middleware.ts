import { Injectable, NestMiddleware } from '@nestjs/common';
import type { Request, Response, NextFunction } from 'express';

/**
 * Setzt `Cache-Control: no-store` + `X-Content-Type-Options: nosniff` ZENTRAL auf
 * ALLE oeffentlichen /public/orders/*-Antworten (Mappe, Foto, Feedback, PDF,
 * Tracking). Als Middleware laeuft sie VOR Guards/Handler/Exception-Filter -> die
 * Header liegen bereits auf dem Response-Objekt und werden daher AUCH bei
 * Fehlerantworten (404 aus dem Service, 429 des Throttlers) mit ausgeliefert.
 * So kann ein zurueckgezogener Zugriff (Token neu vergeben / Status zurueckgesetzt)
 * nicht durch einen Shared Cache weiter bedient werden – und es wird nicht in
 * jedem Handler-Zweig einzeln gesetzt.
 */
@Injectable()
export class NoStoreMiddleware implements NestMiddleware {
  use(_req: Request, res: Response, next: NextFunction): void {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    next();
  }
}
