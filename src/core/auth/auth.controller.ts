import { Body, Controller, Get, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from 'src/common/decorators/role.decorator';
import { Role } from 'src/common/enum/role.enum';
import { RolesGuard } from 'src/common/guards/role.guard';
import { CreateUserDto } from 'src/modules/users/dto/create.user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('create')
  async register(@Body() dto: CreateUserDto) {
    return 'hi';
  }
}
