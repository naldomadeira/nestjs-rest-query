-- Perfil certificado PostgreSQL 18 (spec §6.3).
-- Encoding UTF8, collation "C" (code point) nas colunas textuais portáveis,
-- sessão em UTC, precisão decimal declarada e índices exigidos.

SET TIME ZONE 'UTC';

CREATE TABLE companies (
  id          integer PRIMARY KEY,
  name        text COLLATE "C" NOT NULL,
  name_folded text COLLATE "C" NOT NULL,
  owner_id    integer
);

CREATE TABLE users (
  id           integer PRIMARY KEY,
  name         text COLLATE "C" NOT NULL,
  name_folded  text COLLATE "C" NOT NULL,
  email        text COLLATE "C" NOT NULL,
  email_folded text COLLATE "C" NOT NULL,
  document     text COLLATE "C" NOT NULL,
  zip          text COLLATE "C" NOT NULL,
  code         text COLLATE "C" NOT NULL,
  score        bigint NOT NULL,
  balance      numeric(38, 6) NOT NULL,
  active       boolean NOT NULL,
  born_on      date NOT NULL,
  created_at   timestamptz NOT NULL,
  nickname     text COLLATE "C",
  company_id   integer REFERENCES companies (id)
);

CREATE TABLE posts (
  id           uuid PRIMARY KEY,
  -- portableOrderField: ordem total idêntica nas três famílias de banco.
  id_order     text COLLATE "C" NOT NULL,
  title        text COLLATE "C" NOT NULL,
  title_folded text COLLATE "C" NOT NULL,
  user_id      integer NOT NULL REFERENCES users (id)
);

CREATE TABLE tags (
  post_id       uuid NOT NULL REFERENCES posts (id),
  -- portableOrderField de post_id: uuid nativo não tem ordem total idêntica
  -- nas três famílias de banco.
  post_id_order text COLLATE "C" NOT NULL,
  label         text COLLATE "C" NOT NULL,
  PRIMARY KEY (post_id, label)
);

ALTER TABLE companies
  ADD CONSTRAINT companies_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users (id);

CREATE INDEX users_company_id_idx   ON users (company_id);
CREATE INDEX users_name_folded_idx  ON users (name_folded);
CREATE INDEX users_email_folded_idx ON users (email_folded);
CREATE INDEX users_code_idx         ON users (code);
CREATE INDEX posts_user_id_idx      ON posts (user_id);
CREATE INDEX posts_id_order_idx     ON posts (id_order);
CREATE INDEX companies_name_folded_idx ON companies (name_folded);
CREATE INDEX tags_post_id_order_idx ON tags (post_id_order, label);
