<div align="center">
  <img src="../../docs/public/logomark.svg" width="40" /><br><br>
</div>

<div align="center">

# 01 - Starter App

Aplicação de exemplo para testar o **NestJS Dynamic Query Builder**

</div>

---

## 🚀 Como Testar

### 1. Instale as dependências

```bash
npm install
```

### 2. Inicie a aplicação

```bash
npm run dev
```

> Isso vai criar automaticamente as tabelas no banco de dados (SQLite) porque o `synchronize: true` está habilitado.

### 3. Rode a migration para popular o banco

```bash
npm run migrations:run
```

Isso vai inserir produtos e categorias de exemplo no banco de dados.

### 4. Teste as requisições

Abra o arquivo `src/http/products.http` no VS Code ou use seu cliente HTTP preferido (Postman, Insomnia, etc).

**O que testar:**

- ✅ **Filtros** - 15 operadores disponíveis (eq, ne, like, ilike, gt, gte, lt, lte, in, notIn, between, isNull, notNull, notLike, notIlike)
- ✅ **Includes** - Carregamento de relacionamentos (category)
- ✅ **Paginação** - Controle de page e perPage
- ✅ **Sort** - Ordenação ascendente e descendente
- ✅ **Fields** - Seleção de campos específicos

---

## 📝 Implementação

### Controller (Type-Safe)

```typescript
@Controller('products')
@ApiTags('products')
export class ProductController {
  @Get()
  @ApiDynamicQuery({
    filters: ['id', 'name', 'price', 'category'],
    sorts: ['id', 'name', 'price', 'createdAt'],
    includes: ['category'],
    fields: ['id', 'name', 'price', 'category'],
    pagination: true,
  })
  async findAll(
    @Query() query: DynamicQueryDto,
    @QueryRules() rules: RulesConfig,
  ) {
    return this.productService.findAll(query, rules);
  }
}
```

### Service (Execução)

```typescript
@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private queryBuilderProvider: QueryBuilderProvider,
  ) {}

  async findAll(
    query: DynamicQueryDto,
    rules: RulesConfig,
  ): Promise<QueryResult<Product>> {
    return this.queryBuilderProvider.execute(
      this.productRepository,
      query,
      rules,
    );
  }
}
```

**Enjoy! 🎉**

---
