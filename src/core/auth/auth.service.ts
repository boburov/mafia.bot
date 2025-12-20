import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../db/db.service';
import { CreateUserDto } from 'src/modules/users/dto/create.user.dto';
import bcrypt from 'bcrypt';
import { MailerService } from '../mail/mail';
import { RedisService } from '../cache/redis';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private mail: MailerService,
    private redis: RedisService,
  ) {}

  async create(dto: CreateUserDto) {
    try {
      const user = await this.prisma.user.findFirst({
        where: {
          OR: [
            {
              email: dto.email,
              username: dto.username,
            },
          ],
        },
      });

      if (user)
        throw new HttpException(
          'Siz kiritgan malumotlar allaqachon mavjud',
          HttpStatus.NOT_FOUND,
        );

      const hashed_password = await bcrypt.hash(dto.password, 10);

      await this.mail.sendVerificationCodeEmail(dto.email, '298423');

      const new_user = await this.prisma.user.create({
        data: {
          name: dto.name,
          email: dto.email,
          username: dto.username,
          password: hashed_password,
        },
      });
    } catch (error) {
      Logger.error(error);
    }
  }
}
