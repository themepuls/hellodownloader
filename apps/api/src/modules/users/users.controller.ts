import { Body, Controller, Get, Patch, Query, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './users.dto';

@Controller('users')
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get('dashboard')
  dashboard(
    @Req() req: { user: { id: string } },
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.usersService.getDashboardStats(req.user.id, {
      page: Math.max(1, parseInt(page ?? '1', 10) || 1),
      limit: Math.min(50, Math.max(1, parseInt(limit ?? '10', 10) || 10)),
    });
  }

  @Patch('profile')
  updateProfile(@Req() req: { user: { id: string } }, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(req.user.id, { name: dto.name });
  }
}
