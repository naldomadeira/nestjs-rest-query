import { Module } from '@nestjs/common';
import { PostsController } from './posts.controller';
import { PostsBusiness } from './posts.business';

@Module({
  controllers: [PostsController],
  providers: [PostsBusiness],
  exports: [PostsBusiness],
})
export class PostsModule {}
