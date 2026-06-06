import { Body, Controller, Get, Post, Query, Req } from '@nestjs/common';
import { IsBoolean, IsOptional, IsString } from 'class-validator';
import { Public } from '../auth/public.decorator';
import { FourKInterestService } from './four-k-interest.service';

type AuthUser = { id: string };

class FourKInterestDto {
  @IsBoolean()
  interested!: boolean;

  @IsOptional()
  @IsString()
  visitorId?: string;
}

@Controller('surveys')
export class SurveyController {
  constructor(private fourKInterest: FourKInterestService) {}

  @Public()
  @Get('four-k-interest')
  getFourKInterest(@Req() req: { user?: AuthUser }, @Query('visitorId') visitorId?: string) {
    return this.fourKInterest.getResponse(req.user?.id, visitorId);
  }

  @Public()
  @Post('four-k-interest')
  submitFourKInterest(@Req() req: { user?: AuthUser }, @Body() body: FourKInterestDto) {
    return this.fourKInterest.submit(body.interested, req.user?.id, body.visitorId);
  }
}
