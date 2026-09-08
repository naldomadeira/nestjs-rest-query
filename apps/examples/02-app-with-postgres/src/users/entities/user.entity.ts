import {
  BeforeInsert,
  BeforeUpdate,
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { foldText } from 'nestjs-rest-query';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'sso_user_id', type: 'varchar', length: 255, unique: true })
  ssoUserId: string;

  @Column({ type: 'varchar', length: 64, unique: true })
  username: string;

  @Column({ name: 'first_name', type: 'varchar', length: 255 })
  firstName: string;

  /**
   * Companheira dobrada de `firstName`.
   *
   * O nome da propriedade não é livre: o adapter do TypeORM reconhece a coluna
   * dobrada pelo sufixo `_folded` sobre o *path* do campo que ela apoia — daí
   * `firstName_folded`, mesmo com a coluna física em snake_case. Divergir aqui
   * faz o schema derivado da entidade não bater com o declarado e a execução
   * falha com `SOURCE_CONFIGURATION_INVALID`.
   *
   * `DEFAULT ''` no banco e o listener abaixo garantem que ela nunca fique
   * nula, venha a escrita da API, de um seed ou de um script avulso.
   */
  @Column({
    name: 'first_name_folded',
    type: 'varchar',
    length: 255,
    default: '',
    select: false,
  })
  firstName_folded: string;

  @Column({ name: 'last_name', type: 'varchar', length: 255 })
  lastName: string;

  @Column({ type: 'varchar', length: 255, unique: true })
  email: string;

  @Column({
    name: 'email_folded',
    type: 'varchar',
    length: 255,
    default: '',
    select: false,
  })
  email_folded: string;

  @Column({ type: 'varchar', length: 14, unique: true })
  document: string;

  @Column({ name: 'photo_url', type: 'text', nullable: true })
  photoUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  /**
   * Manter a dobra na entidade é a variante "listener" do mesmo contrato que o
   * exemplo 01 escreve à mão na migration: quem grava não precisa lembrar da
   * coluna, e `foldText` é literalmente a mesma função que o núcleo aplica ao
   * termo da busca — é isso que faz gravação e consulta concordarem.
   */
  @BeforeInsert()
  @BeforeUpdate()
  foldSearchableColumns(): void {
    this.firstName_folded = foldText(this.firstName ?? '');
    this.email_folded = foldText(this.email ?? '');
  }
}
