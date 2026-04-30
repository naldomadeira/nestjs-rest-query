import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { dqbSwaggerRequestInterceptor } from 'nestjs-rest-query';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Express 5 changed the default query parser from 'extended' to 'simple'.
  // The dynamic query parser expects nested objects like filter[field][op]=value.
  app.set('query parser', 'extended');

  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(process.env.npm_package_name ?? 'Starter API')
      .setDescription(process.env.npm_package_description!)
      .setVersion(process.env.npm_package_version!)
      .setContact(
        process.env.npm_package_description!,
        process.env.npm_package_homepage!,
        process.env.npm_package_author!,
      )
      .setExternalDoc('Open API Json Format', './api.json')
      .build(),
  );

  SwaggerModule.setup('/', app, document, {
    swaggerOptions: {
      requestInterceptor: dqbSwaggerRequestInterceptor,
    },
  });

  app.use('/api.json', (req: Request, res: Response) => {
    res.json(document);
  });

  await app.listen(process.env.PORT ?? 3001);
}
bootstrap();
