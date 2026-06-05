import { Controller, Get, Req } from '@nestjs/common';
import { CreditsService } from './credits.service';

@Controller('credits')
export class CreditsController {
  constructor(private creditsService: CreditsService) {}

  @Get()
  balance(@Req() req: { user: { id: string } }) {
    return this.creditsService.getBalance(req.user.id);
  }

  @Get('history')
  history(@Req() req: { user: { id: string } }) {
    return this.creditsService.getHistory(req.user.id);
  }
}
