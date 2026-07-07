import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';

/**
 * Ein einzelner Gespraechs-Turn aus der Client-History. Rolle ist bewusst auf
 * 'user'/'assistant' beschraenkt (Anthropic-Messages-Format). Der System-Prompt
 * kommt NIE vom Client – er wird ausschliesslich serverseitig gesetzt, damit das
 * Scoping (nur Detailly-Themen) nicht ueber die History ausgehebelt werden kann.
 */
export class SupportChatTurnDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsIn(['user', 'assistant'])
  role: 'user' | 'assistant';

  @ApiProperty({ maxLength: 4000 })
  @IsString()
  @MaxLength(4000)
  content: string;
}

export class AskSupportDto {
  @ApiProperty({ maxLength: 2000, description: 'Frage zur Bedienung von Detailly' })
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  question: string;

  /**
   * Optionaler Kontext: die letzten Turns des laufenden Chats. Auf 20 Eintraege
   * begrenzt (der Service nutzt zusaetzlich nur die letzten paar), damit weder
   * Token-Kosten noch Prompt-Injection-Flaeche unbegrenzt wachsen.
   */
  @ApiPropertyOptional({ type: [SupportChatTurnDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SupportChatTurnDto)
  history?: SupportChatTurnDto[];
}
