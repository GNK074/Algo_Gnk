import { Controller, Get, Header, Headers } from '@nestjs/common';
import { AccountController, database } from './accounts';
import { PortfolioController } from './portfolio';

@Controller('api/dashboard')
export class DashboardController {
  constructor(private readonly accounts: AccountController, private readonly portfolios: PortfolioController) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async dashboard(@Headers('cookie') cookie?: string) {
    const user = await this.accounts.session(cookie);
    const [portfolio, activity, market] = await Promise.all([
      this.portfolios.summary(cookie).catch(() => ({ status: 'unavailable' })),
      database.accountActivity.findMany({
        where: { userId: user.id }, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        take: 4, select: { id: true, event: true, createdAt: true },
      }),
      this.market(),
    ]);
    return { name: user.firstName, portfolio, activity, market,
      admin: (process.env.GNK_PLATFORM_ADMIN_IDS ?? '').split(',').some(id => id.trim() === user.id) };
  }

  private async market() {
    const origin = process.env.GNK_ANALYTICS_ORIGIN;
    if (!origin) return null;
    try {
      const response = await fetch(new URL('/market/candles', origin), {
        signal: AbortSignal.timeout(2500), redirect: 'error',
      });
      return response.ok ? await response.json() : null;
    } catch {
      return null;
    }
  }
}
