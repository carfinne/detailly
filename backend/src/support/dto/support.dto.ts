import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString, MaxLength, MinLength } from 'class-validator';
import { TicketKategorie, TicketStatus } from '../entities/support-ticket.entity';

export class CreateTicketDto {
  @ApiProperty({ maxLength: 150 })
  @IsString()
  @MinLength(3)
  @MaxLength(150)
  betreff: string;

  @ApiProperty({ enum: TicketKategorie })
  @IsIn(Object.values(TicketKategorie))
  kategorie: TicketKategorie;

  @ApiProperty({ maxLength: 5000 })
  @IsString()
  @MinLength(3)
  @MaxLength(5000)
  text: string;
}

export class TicketMessageDto {
  @ApiProperty({ maxLength: 5000 })
  @IsString()
  @MinLength(1)
  @MaxLength(5000)
  text: string;
}

export class TicketStatusDto {
  @ApiProperty({ enum: TicketStatus })
  @IsIn(Object.values(TicketStatus))
  status: TicketStatus;
}
