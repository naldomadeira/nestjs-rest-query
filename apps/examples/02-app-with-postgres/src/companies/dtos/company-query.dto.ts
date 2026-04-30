import { DynamicQueryDto } from 'nestjs-rest-query';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class CompanyQueryDto extends DynamicQueryDto {
  @ApiPropertyOptional({
    description: 'Busca por nome ou CNPJ (parcial, case-insensitive)',
  })
  search?: string;
}
