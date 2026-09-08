import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { dqbSwaggerRequestInterceptor } from 'nestjs-rest-query';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // O Express 5 trocou o parser de query padrão de 'extended' para 'simple', e
  // `filter[campo][op]=valor` só chega como objeto aninhado com o estendido.
  // Sem isto a aplicação aceitaria um filtro que nunca foi aplicado.
  app.set('query parser', 'extended');

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    })
  );

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('03 - App with Drizzle')
      .setDescription('nestjs-rest-query v3 sobre Drizzle ORM 1.x e PostgreSQL')
      .setVersion(process.env.npm_package_version ?? '0.0.1')
      .setExternalDoc('Open API Json Format', './api.json')
      .build()
  );

  // O interceptor reescreve a query do "Try it out" para a forma
  // `filter[campo][op]=valor`; sem ele o Swagger UI serializaria os parâmetros
  // aninhados de um jeito que o parser não reconhece.
  SwaggerModule.setup('/', app, document, {
    swaggerOptions: {
      requestInterceptor: dqbSwaggerRequestInterceptor(document),
    },
  });

  app.use('/api.json', (_req: Request, res: Response) => {
    res.json(document);
  });

  // O `DatabaseModule` encerra o pool no shutdown; sem isto o processo ficaria
  // vivo depois de um SIGTERM.
  app.enableShutdownHooks();

  const port = process.env.PORT ?? 3002;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
