import 'reflect-metadata';
import { Controller, Get, Module } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AccountController } from './accounts';

@Controller('api')
class HealthController {
  @Get('health')
  health() {
    return { status: 'ok' };
  }
}

@Module({ controllers: [HealthController, AccountController] })
class AppModule {}

async function main() {
  const app = await NestFactory.create(AppModule);
  app.enableShutdownHooks();
  await app.listen(4000);
}

void main();
