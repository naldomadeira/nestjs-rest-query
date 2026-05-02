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

Acesse a documentação em: [http://localhost:3000](http://localhost:3000)
