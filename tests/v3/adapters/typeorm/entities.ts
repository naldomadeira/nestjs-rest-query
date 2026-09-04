import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
} from 'typeorm';

/**
 * Entidades espelhando o `CORPUS_MODEL`.
 *
 * As colunas mantêm os nomes do modelo canônico (snake_case) para que a mesma
 * DDL sirva às três famílias de banco e ao SQLite dos contract tests. Os
 * campos `*_folded` e `id_order` são as colunas internas do perfil portável.
 */

@Entity('companies')
export class CompanyEntity {
  @PrimaryColumn({ type: 'integer' })
  id!: number;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', name: 'name_folded' })
  name_folded!: string;

  @Column({ type: 'integer', name: 'owner_id', nullable: true })
  owner_id!: number | null;

  @ManyToOne(() => UserEntity, { nullable: true })
  @JoinColumn({ name: 'owner_id' })
  owner!: UserEntity | null;
}

@Entity('users')
export class UserEntity {
  @PrimaryColumn({ type: 'integer' })
  id!: number;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', name: 'name_folded' })
  name_folded!: string;

  @Column({ type: 'varchar' })
  email!: string;

  @Column({ type: 'varchar', name: 'email_folded' })
  email_folded!: string;

  @Column({ type: 'varchar' })
  document!: string;

  @Column({ type: 'varchar' })
  zip!: string;

  @Column({ type: 'varchar' })
  code!: string;

  @Column({ type: 'bigint' })
  score!: string;

  @Column({ type: 'decimal', precision: 38, scale: 6 })
  balance!: string;

  @Column({ type: 'boolean' })
  active!: boolean;

  @Column({ type: 'date', name: 'born_on' })
  born_on!: string;

  @Column({ type: 'datetime', name: 'created_at' })
  created_at!: Date;

  @Column({ type: 'varchar', nullable: true })
  nickname!: string | null;

  @Column({ type: 'integer', name: 'company_id', nullable: true })
  company_id!: number | null;

  @ManyToOne(() => CompanyEntity, { nullable: true })
  @JoinColumn({ name: 'company_id' })
  company!: CompanyEntity | null;

  @OneToMany(() => PostEntity, (post) => post.author)
  posts!: PostEntity[];
}

@Entity('posts')
export class PostEntity {
  @PrimaryColumn({ type: 'uuid' })
  id!: string;

  @Column({ type: 'varchar', name: 'id_order' })
  id_order!: string;

  @Column({ type: 'varchar' })
  title!: string;

  @Column({ type: 'varchar', name: 'title_folded' })
  title_folded!: string;

  @Column({ type: 'integer', name: 'user_id' })
  user_id!: number;

  @ManyToOne(() => UserEntity, (user) => user.posts)
  @JoinColumn({ name: 'user_id' })
  author!: UserEntity;

  @OneToMany(() => TagEntity, (tag) => tag.post)
  tags!: TagEntity[];
}

@Entity('tags')
export class TagEntity {
  @PrimaryColumn({ type: 'uuid', name: 'post_id' })
  post_id!: string;

  @Column({ type: 'varchar', name: 'post_id_order' })
  post_id_order!: string;

  @PrimaryColumn({ type: 'varchar' })
  label!: string;

  @ManyToOne(() => PostEntity, (post) => post.tags)
  @JoinColumn({ name: 'post_id' })
  post!: PostEntity;
}
