import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AgreementController } from './api/agreements';
import { DashboardController } from './api/dashboard';
import { PortfolioController } from './api/portfolio';
import { AdminController } from './api/admin';
import { AccountController } from './api/accounts';

@Controller('api')
class HealthController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

@Module({ controllers: [HealthController, AccountController, AgreementController, AdminController, PortfolioController, DashboardController], providers: [AccountController, PortfolioController] })
class AppModule {}

async function main() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(4000);
}

void main();
