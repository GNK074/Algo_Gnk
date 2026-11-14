import { Controller, ForbiddenException, Get, Header, Headers, Query } from '@nestjs/common';
import { AccountController, database } from './accounts';

@Controller('api/admin')
export class AdminController {
  constructor(private readonly accounts: AccountController) {}

  private async requireAdmin(cookie?: string) {
    const { user } = await this.accounts.requireSession(cookie);
    const ids = (process.env.GNK_PLATFORM_ADMIN_IDS ?? '').split(',').map(id => id.trim());
    if (!ids.includes(user.id)) throw new ForbiddenException();
  }

  @Get('overview')
  @Header('Cache-Control', 'no-store')
  async overview(@Headers('cookie') cookie?: string) {
    await this.requireAdmin(cookie);
    const [total, disabled] = await database.$transaction([
      database.user.count(),
      database.user.count({ where: { disabledAt: { not: null } } }),
    ]);
    return {
      accounts: { total, enabled: total - disabled, disabled },
      services: { api: 'reachable', postgres: 'reachable' },
    };
  }

  @Get('users')
  @Header('Cache-Control', 'no-store')
  async users(@Query('q') query: unknown, @Headers('cookie') cookie?: string) {
    await this.requireAdmin(cookie);
    const search = typeof query === 'string' ? query.trim().slice(0, 254) : '';
    return database.user.findMany({
      where: search ? { email: { contains: search, mode: 'insensitive' } } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: {
        id: true, email: true, firstName: true, lastName: true,
        disabledAt: true, emailVerifiedAt: true, createdAt: true,
      },
    });
  }

  @Get('audit')
  @Header('Cache-Control', 'no-store')
  async audit(@Headers('cookie') cookie?: string) {
    await this.requireAdmin(cookie);
    return database.accountActivity.findMany({
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 50,
      select: { id: true, userId: true, event: true, createdAt: true },
    });
  }
}
