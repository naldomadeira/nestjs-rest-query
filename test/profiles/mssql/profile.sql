-- Perfil certificado SQL Server 2022 (spec §6.3).
-- Latin1_General_100_BIN2_UTF8 dá comparação e ordenação por code point sobre
-- armazenamento UTF-8; datetime2(6) em UTC; DECIMAL com precisão declarada.

CREATE DATABASE dqb COLLATE Latin1_General_100_BIN2_UTF8;
GO
USE dqb;
GO

CREATE TABLE companies (
  id          INT PRIMARY KEY,
  name        VARCHAR(255) COLLATE Latin1_General_100_BIN2_UTF8 NOT NULL,
  name_folded VARCHAR(255) COLLATE Latin1_General_100_BIN2_UTF8 NOT NULL,
  owner_id    INT NULL
);

CREATE TABLE users (
  id           INT PRIMARY KEY,
  name         VARCHAR(255) COLLATE Latin1_General_100_BIN2_UTF8 NOT NULL,
  name_folded  VARCHAR(255) COLLATE Latin1_General_100_BIN2_UTF8 NOT NULL,
  email        VARCHAR(255) COLLATE Latin1_General_100_BIN2_UTF8 NOT NULL,
  email_folded VARCHAR(255) COLLATE Latin1_General_100_BIN2_UTF8 NOT NULL,
  document     VARCHAR(64)  COLLATE Latin1_General_100_BIN2_UTF8 NOT NULL,
  zip          VARCHAR(32)  COLLATE Latin1_General_100_BIN2_UTF8 NOT NULL,
  code         VARCHAR(32)  COLLATE Latin1_General_100_BIN2_UTF8 NOT NULL,
  score        BIGINT NOT NULL,
  balance      DECIMAL(38, 6) NOT NULL,
  active       BIT NOT NULL,
  born_on      DATE NOT NULL,
  created_at   DATETIME2(6) NOT NULL,
  nickname     VARCHAR(255) COLLATE Latin1_General_100_BIN2_UTF8 NULL,
  company_id   INT NULL,
  CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies (id)
);

CREATE TABLE posts (
  id           UNIQUEIDENTIFIER PRIMARY KEY,
  id_order     VARCHAR(64) COLLATE Latin1_General_100_BIN2_UTF8 NOT NULL,
  title        VARCHAR(255) COLLATE Latin1_General_100_BIN2_UTF8 NOT NULL,
  title_folded VARCHAR(255) COLLATE Latin1_General_100_BIN2_UTF8 NOT NULL,
  user_id      INT NOT NULL,
  CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id)
);

CREATE TABLE tags (
  post_id UNIQUEIDENTIFIER NOT NULL,
  label   VARCHAR(255) COLLATE Latin1_General_100_BIN2_UTF8 NOT NULL,
  CONSTRAINT tags_pkey PRIMARY KEY (post_id, label),
  CONSTRAINT tags_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts (id)
);

ALTER TABLE companies
  ADD CONSTRAINT companies_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users (id);
GO

CREATE INDEX users_company_id_idx      ON users (company_id);
CREATE INDEX users_name_folded_idx     ON users (name_folded);
CREATE INDEX users_email_folded_idx    ON users (email_folded);
CREATE INDEX users_code_idx            ON users (code);
CREATE INDEX posts_user_id_idx         ON posts (user_id);
CREATE INDEX posts_id_order_idx        ON posts (id_order);
CREATE INDEX companies_name_folded_idx ON companies (name_folded);
GO
