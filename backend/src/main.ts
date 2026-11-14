import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AgreementController } from './api/agreements';
import { AccountController } from './api/accounts';

@Controller('api')
class HealthController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

@Module({ controllers: [HealthController, AccountController, AgreementController], providers: [AccountController] })
class AppModule {}

async function main() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(4000);
}

void main();
