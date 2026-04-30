import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsBusiness } from './posts.business';
import { drizzleProvider } from '@app/db/drizzle.provider';

@Module({
  controllers: [PostsController],
  providers: [PostsBusiness, drizzleProvider],
  exports: [PostsBusiness],
})
export class PostsModule {}
