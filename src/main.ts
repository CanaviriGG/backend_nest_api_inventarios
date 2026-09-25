import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  //INI: Habilitando Swagger
  const config = new DocumentBuilder()
    .setTitle('Proyecto Inventarios')
    .setDescription('Proyecto backend con Nest')
    .setVersion('1.0')
    .addTag('nest')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);
  //FIN: fin Swagger
  
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
