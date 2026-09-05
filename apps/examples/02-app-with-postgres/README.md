<div align="center">
  <img src="../../docs/public/logomark.svg" width="40" /><br><br>
</div>

<div align="center">

# 02 - Starter App With Postgres

Aplicacao de exemplo para testar o **nestjs-rest-query** com banco de dados Postgres

</div>

## Skill no projeto

Este exemplo inclui uma skill local em `.agents/skills/nestjs-rest-query`.

Exemplo de uso:

```text
Use a skill nestjs-rest-query para criar um endpoint com filtros avancados para Company.
```

## Como executar

**1. Instalar dependências**

```bash
npm install
# ou
yarn install
# ou
pnpm install
```

**2. Subir o banco de dados**

```bash
docker compose up -d

# parar sem remover container/volume
docker compose stop

# remover container e manter dados no volume
docker compose down

# reset completo (apaga dados e exige seed novamente)
docker compose down -v
```

**3. Executar as migrations**

```bash
yarn migrations:run
```

**4. Popular o banco com seeds**

```bash
# Fluxo completo (módulos + empresas + usuários + access requests)
yarn seed:full

# Ou seeds individuais
yarn seed:modules
yarn seed:companies
yarn seed:users --count 20
yarn seed:access-requests --count 3

# Fluxo completo com parâmetros customizados
yarn seed:full --users 20 --companies 10 --requests 3
```

> Execute os seeds na primeira vez (ou novamente apenas se fizer reset com `docker compose down -v`). Com volume persistente, os dados continuam entre reinicializacoes.

**5. Iniciar o projeto**

```bash
yarn dev
```

Acesse a documentação em: [http://localhost:3002](http://localhost:3002)

## Smoke E2E

```bash
docker compose up -d
pnpm test:e2e
```

O smoke cria e destrói o próprio banco (`multi_acessos_e2e`) e aplica as
migrations nele. O `multi_acessos` de desenvolvimento nunca é tocado, e por
isso a suíte não depende do estado em que o volume do Docker ficou.

Ele é o gate que prova a API v3 pelo lado de fora: envelope canônico, projeção
exata, relação `one` e coleção `many` aninhadas com projeção própria, recusa de
campo fora da whitelist com código no corpo, padrão literal em `like` e busca
pela coluna dobrada — no PostgreSQL, sem `ILIKE` e sem depender da collation do
servidor.
