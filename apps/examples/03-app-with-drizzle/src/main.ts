import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { dqbSwaggerRequestInterceptor } from 'nestjs-rest-query';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Express 5 changed default query parser from 'extended' (qs) to 'simple'.
  // The 'extended' parser is required to expand filter[field][op]=value
  // into nested objects, which is the format expected by the library.
  app.set('query parser', 'extended');

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Drizzle Example API')
      .setDescription('NestJS + Drizzle ORM sample app with nestjs-rest-query')
      .setVersion(process.env.npm_package_version || '0.0.1')
      .setContact(
        'Naldo Madeira',
        'https://github.com/naldomadeira',
        'naldomadeira@gmail.com'
      )
      .setExternalDoc('Open API Json Format', './api.json')
      .build()
  );

  SwaggerModule.setup('/', app, document, {
    swaggerOptions: {
      requestInterceptor: dqbSwaggerRequestInterceptor,
    },
  });

  app.use('/api.json', (req: Request, res: Response) => {
    res.json(document);
  });

  const port = process.env.PORT || 3002;
  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}`);
}

bootstrap().catch(console.error);
