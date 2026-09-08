import { MigrationInterface, QueryRunner } from 'typeorm';
import { foldText } from 'nestjs-rest-query';

/**
 * A coluna dobrada é responsabilidade de quem escreve, não do ORM.
 *
 * `foldText` é o mesmo `normalize('NFC').toLowerCase()` que o núcleo aplica ao
 * termo da busca — usar a função exportada é o que garante que gravação e
 * consulta concordem. Numa aplicação real isto vira um listener de entidade ou
 * uma coluna gerada pelo banco; aqui fica explícito para o exemplo mostrar de
 * onde o valor vem.
 */

export class SeedProductsAndCategory1756384597273 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    const categories = [
      'Eletroportáteis',
      'Informática',
      'Telefonia',
      'Áudio',
      'Vídeo',
      'Casa e Cozinha',
      'Esporte e Lazer',
      'Beleza e Saúde',
      'Automotivo',
      'Brinquedos',
    ];

    const productBases = [
      'Pipoqueira 220V',
      'Air Fryer 4L',
      'Liquidificador 110V',
      'Cafeteira Elétrica',
      'Aspirador de Pó',
      'Batedeira Planetária',
      'Ferro de Passar',
      'Panela Elétrica',
      'Ventilador de Mesa',
      'Umidificador de Ar',
      'Headset Gamer',
      'Mouse Sem Fio',
      'Teclado Mecânico',
      'Monitor 24"',
      'Notebook 15.6"',
      'Smartphone 128GB',
      'Tablet 10"',
      'Caixa de Som Bluetooth',
      'Soundbar',
      'TV 50" 4K',
      'Roteador Wi-Fi 6',
      'Smartwatch',
      'Câmera de Segurança Wi-Fi',
      'Lâmpada Smart',
      'Garrafa Térmica',
      'Jogo de Panelas',
      'Mixer Portátil',
      'Chaleira Elétrica',
      'Processador de Alimentos',
      'Forno Elétrico 45L',
      'Micro-ondas 30L',
      'Sanduicheira',
      'Aparador de Pelos',
      'Secador de Cabelo',
      'Barbeador Elétrico',
      'Balança Digital',
      'Carregador Veicular',
      'Suporte Magnético p/ Celular',
      'Câmera de Ação 4K',
      'Drone Hobby',
      'Console Portátil',
      'Kit Teclado+Mouse',
      'HD Externo 1TB',
      'SSD NVMe 1TB',
      'Memória RAM 16GB',
      'Impressora Wi-Fi',
      'Webcam Full HD',
      'Microfone USB',
      'Trena a Laser',
      'Patinete Elétrico',
    ];

    const brands = [
      'Multilaser',
      'Mundial',
      'Philips',
      'Arno',
      'Electrolux',
      'Britânia',
      'Samsung',
      'LG',
      'Motorola',
      'Xiaomi',
      'Dell',
      'Acer',
      'Sony',
      'JBL',
      'Philco',
      'Tramontina',
      'Oster',
      'Midea',
      'Lenovo',
      'Apple',
    ];

    const startDate = new Date('2025-01-01T00:00:00');
    const endDate = new Date('2025-08-25T23:59:59');

    // Gerador determinístico: o seed é dado de exemplo, mas também é o que o
    // smoke E2E consulta. `Math.random` tornaria o resultado do teste
    // dependente da execução.
    let state = 0x2f6e2b1;
    const random = () => {
      state = (state * 1664525 + 1013904223) >>> 0;
      return state / 0x1_0000_0000;
    };

    const randInt = (min: number, max: number) =>
      Math.floor(random() * (max - min + 1)) + min;

    const randomDate = (from: Date, to: Date) => {
      const t = from.getTime() + random() * (to.getTime() - from.getTime());
      return new Date(t);
    };

    const fmtDate = (d: Date) => {
      const pad = (n: number) => n.toString().padStart(2, '0');
      const yyyy = d.getFullYear();
      const mm = pad(d.getMonth() + 1);
      const dd = pad(d.getDate());
      const hh = pad(d.getHours());
      const mi = pad(d.getMinutes());
      const ss = pad(d.getSeconds());
      return `${yyyy}-${mm}-${dd} ${hh}:${mi}:${ss}`;
    };

    const randomPrice = () => {
      const cents = randInt(1990, 599990);
      return (cents / 100).toFixed(2);
    };

    const pick = <T>(arr: T[]) => arr[randInt(0, arr.length - 1)];

    for (const name of categories) {
      await queryRunner.query(
        `INSERT INTO "category"("name","name_folded") 
         SELECT ?, ? 
         WHERE NOT EXISTS (SELECT 1 FROM "category" WHERE "name" = ?);`,
        [name, foldText(name), name],
      );
    }

    const catRows: Array<{ id: number; name: string }> =
      await queryRunner.query(
        `SELECT "id","name" FROM "category" WHERE "name" IN (${categories.map(() => '?').join(',')});`,
        categories,
      );

    const categoryIdByName = new Map(catRows.map((r) => [r.name, r.id]));
    const categoryIds = categories.map((c) => categoryIdByName.get(c)!); // 10 ids

    const total = 500;
    const perCategory = Math.floor(total / categories.length); // 50

    const insertedProductNames: string[] = [];

    const batchSize = 200;
    const rowsParams: Array<string | number> = [];
    const rowsValuesSql: string[] = [];

    for (let ci = 0; ci < categories.length; ci++) {
      const catId = categoryIds[ci];

      for (let j = 0; j < perCategory; j++) {
        const base = pick(productBases);
        const brand = pick(brands);
        const name = `${base} ${brand}`;

        const created = randomDate(startDate, endDate);
        const updated = randomDate(created, endDate);

        const price = randomPrice();
        insertedProductNames.push(name);

        rowsValuesSql.push('(?, ?, ?, ?, ?, ?)');
        rowsParams.push(
          name,
          foldText(name),
          price,
          catId,
          fmtDate(created),
          fmtDate(updated),
        );

        if (rowsValuesSql.length === batchSize) {
          await queryRunner.query(
            `INSERT INTO "product"("name","name_folded","price","categoryId","createdAt","updatedAt")
             VALUES ${rowsValuesSql.join(',')};`,
            rowsParams,
          );
          rowsValuesSql.length = 0;
          rowsParams.length = 0;
        }
      }
    }

    if (rowsValuesSql.length > 0) {
      await queryRunner.query(
        `INSERT INTO "product"("name","name_folded","price","categoryId","createdAt","updatedAt")
         VALUES ${rowsValuesSql.join(',')};`,
        rowsParams,
      );
    }

    await queryRunner.query(
      `UPDATE "product" SET "name" = "name" 
       WHERE "createdAt" >= ? AND "createdAt" <= ?;`,
      [fmtDate(startDate), fmtDate(endDate)],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "product";`);

    const categories = [
      'Eletroportáteis',
      'Informática',
      'Telefonia',
      'Áudio',
      'Vídeo',
      'Casa e Cozinha',
      'Esporte e Lazer',
      'Beleza e Saúde',
      'Automotivo',
      'Brinquedos',
    ];

    await queryRunner.query(
      `DELETE FROM "category" WHERE "name" IN (${categories.map(() => '?').join(',')});`,
      categories,
    );
  }
}
