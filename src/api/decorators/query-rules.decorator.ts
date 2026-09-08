import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { CompiledQueryRules } from '@core/authorization';
import { QUERY_RULES_METADATA_KEY } from '@core/constants';

export const QueryRules = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): CompiledQueryRules | undefined => {
    const handler = ctx.getHandler();
    return Reflect.getMetadata(QUERY_RULES_METADATA_KEY, handler);
  }
);
