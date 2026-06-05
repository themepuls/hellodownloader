import { Body, Controller, Get, Patch, Req } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('dashboard')
  dashboard(@Req() req: { user: { id: string } }) {
    return this.usersService.getDashboardStats(req.user.id);
  }

  @Patch('profile')
  updateProfile(
    @Req() req: { user: { id: string } },
    @Body() body: { name?: string },
  ) {
    return this.usersService.updateProfile(req.user.id, body);
  }
}
