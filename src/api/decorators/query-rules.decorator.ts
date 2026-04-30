import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { RulesConfig } from '@contracts/rules-config.interface';
import { QUERY_RULES_METADATA_KEY } from '@core/constants';

export const QueryRules = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): RulesConfig | undefined => {
    const handler = ctx.getHandler();
    return Reflect.getMetadata(QUERY_RULES_METADATA_KEY, handler);
  }
);
