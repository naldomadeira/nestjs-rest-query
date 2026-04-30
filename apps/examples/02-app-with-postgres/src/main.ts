import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { dqbSwaggerRequestInterceptor } from 'nestjs-rest-query';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Express 5 mudou o query parser padrão de 'extended' (qs) para 'simple'.
  // O parser 'extended' é necessário para expandir filter[field][op]=value
  // em objetos nested, que é o formato esperado pela lib.
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
      .setTitle(process.env.npm_package_name ?? 'Multi Acessos API')
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

  await app.listen(process.env.PORT ?? 3002);
}
bootstrap();
