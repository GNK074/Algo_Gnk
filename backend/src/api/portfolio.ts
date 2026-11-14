import { randomUUID, createHmac } from 'node:crypto';
import { Controller, Get, Header, Headers, ServiceUnavailableException } from '@nestjs/common';
import { AccountController } from './accounts';

type Metric = { complete?: boolean; value?: unknown };
type Snapshot = { available?: boolean; fresh?: boolean; fetched_at?: string };

function amount(metric?: Metric) {
  const value = metric?.value;
  return metric?.complete === true &&
    ((typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value)) || (typeof value === 'number' && Number.isFinite(value)))
    ? String(value) : null;
}

@Controller('api/portfolio')
export class PortfolioController {
  constructor(private readonly accounts: AccountController) {}

  @Get('summary')
  @Header('Cache-Control', 'no-store')
  async summary(@Headers('cookie') cookie?: string) {
    const user = await this.accounts.session(cookie);
    const origin = process.env.GNK_PORTFOLIO_ORIGIN;
    const key = process.env.GNK_PORTFOLIO_SECRET;
    if (!origin || !key) return { status: 'unavailable' };

    try {
      const url = new URL('/api/v1/portfolio/bridge/summary', origin);
      if (url.protocol !== 'https:' || url.username || url.password || !/^[a-f0-9]{64}$/i.test(key)) throw new Error();
      const issued = String(Math.floor(Date.now() / 1000));
      const nonce = randomUUID();
      const signature = createHmac('sha256', Buffer.from(key, 'hex'))
        .update(['portfolio-summary-v1', user.id, issued, nonce].join('\n')).digest('hex');
      const response = await fetch(url, {
        redirect: 'error',
        signal: AbortSignal.timeout(5000),
        headers: { 'X-GNK-Account': user.id, 'X-GNK-Issued': issued, 'X-GNK-Nonce': nonce, 'X-GNK-Signature': signature },
      });
      if (response.status === 404) return { status: 'unlinked' };
      if (!response.ok) throw new Error();
      const result = await response.json();
      if (result.currency !== 'INR' || !Array.isArray(result.coverage?.holdings) || !Array.isArray(result.coverage?.positions)) throw new Error();
      const coverage: Snapshot[] = [...result.coverage.holdings, ...result.coverage.positions];
      const timestamps = coverage.flatMap(snapshot => {
        const timestamp = typeof snapshot.fetched_at === 'string' ? Date.parse(snapshot.fetched_at) : NaN;
        return Number.isFinite(timestamp) ? [timestamp] : [];
      });
      return {
        status: coverage.length === 0 ? 'empty' : coverage.every(snapshot => snapshot.available && snapshot.fresh) ? 'ready' : 'incomplete',
        holdingsValue: amount(result.holdings_current),
        realizedPnl: amount(result.positions_realized),
        unrealizedPnl: amount(result.positions_unrealized),
        oldestSnapshotAt: timestamps.length ? new Date(Math.min(...timestamps)).toISOString() : null,
      };
    } catch {
      throw new ServiceUnavailableException('Portfolio data is temporarily unavailable.');
    }
  }
}
