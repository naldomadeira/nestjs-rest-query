-- Perfil certificado MySQL 8.4 LTS (spec §6.3).
-- utf8mb4 + utf8mb4_bin (comparação por bytes UTF-8 == code point no BMP),
-- sessão em UTC via --default-time-zone, STRICT_ALL_TABLES no servidor.

SET time_zone = '+00:00';

CREATE TABLE companies (
  id          INT PRIMARY KEY,
  name        VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  name_folded VARCHAR(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL,
  owner_id    INT NULL
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_bin;

CREATE TABLE users (
  id           INT PRIMARY KEY,
  name         VARCHAR(255) COLLATE utf8mb4_bin NOT NULL,
  name_folded  VARCHAR(255) COLLATE utf8mb4_bin NOT NULL,
  email        VARCHAR(255) COLLATE utf8mb4_bin NOT NULL,
  email_folded VARCHAR(255) COLLATE utf8mb4_bin NOT NULL,
  document     VARCHAR(64)  COLLATE utf8mb4_bin NOT NULL,
  zip          VARCHAR(32)  COLLATE utf8mb4_bin NOT NULL,
  code         VARCHAR(32)  COLLATE utf8mb4_bin NOT NULL,
  score        BIGINT NOT NULL,
  balance      DECIMAL(38, 6) NOT NULL,
  active       TINYINT(1) NOT NULL,
  born_on      DATE NOT NULL,
  created_at   DATETIME(6) NOT NULL,
  nickname     VARCHAR(255) COLLATE utf8mb4_bin NULL,
  company_id   INT NULL,
  CONSTRAINT users_company_id_fkey FOREIGN KEY (company_id) REFERENCES companies (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_bin;

CREATE TABLE posts (
  id           CHAR(36) COLLATE utf8mb4_bin PRIMARY KEY,
  id_order     VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
  title        VARCHAR(255) COLLATE utf8mb4_bin NOT NULL,
  title_folded VARCHAR(255) COLLATE utf8mb4_bin NOT NULL,
  user_id      INT NOT NULL,
  CONSTRAINT posts_user_id_fkey FOREIGN KEY (user_id) REFERENCES users (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_bin;

CREATE TABLE tags (
  post_id       CHAR(36) COLLATE utf8mb4_bin NOT NULL,
  post_id_order VARCHAR(64) COLLATE utf8mb4_bin NOT NULL,
  label         VARCHAR(255) COLLATE utf8mb4_bin NOT NULL,
  PRIMARY KEY (post_id, label),
  CONSTRAINT tags_post_id_fkey FOREIGN KEY (post_id) REFERENCES posts (id)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_bin;

ALTER TABLE companies
  ADD CONSTRAINT companies_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES users (id);

CREATE INDEX users_company_id_idx      ON users (company_id);
CREATE INDEX users_name_folded_idx     ON users (name_folded);
CREATE INDEX users_email_folded_idx    ON users (email_folded);
CREATE INDEX users_code_idx            ON users (code);
CREATE INDEX posts_user_id_idx         ON posts (user_id);
CREATE INDEX posts_id_order_idx        ON posts (id_order);
CREATE INDEX companies_name_folded_idx ON companies (name_folded);
CREATE INDEX tags_post_id_order_idx ON tags (post_id_order, label);
