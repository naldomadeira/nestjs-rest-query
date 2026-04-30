export interface CompanySeedData {
  name: string;
  cnpj: string;
}

/**
 * Lista de empresas brasileiras conhecidas com CNPJs fictícios para seed.
 * CNPJs são fictícios e não pertencem às empresas reais.
 */
export const COMPANIES_SEED_DATA: CompanySeedData[] = [
  { name: 'Magazine Luiza S.A.', cnpj: '47.960.950/0001-21' },
  { name: 'Lojas Americanas S.A.', cnpj: '00.776.574/0006-60' },
  { name: 'Petrobras S.A.', cnpj: '33.000.167/0001-01' },
  { name: 'Ambev S.A.', cnpj: '07.526.557/0001-00' },
  { name: 'Itaú Unibanco Holding S.A.', cnpj: '60.701.190/0001-04' },
  { name: 'Natura & Co Holding S.A.', cnpj: '71.673.990/0001-77' },
  { name: 'Vale S.A.', cnpj: '33.592.510/0001-54' },
  { name: 'Embraer S.A.', cnpj: '07.689.002/0001-89' },
  { name: 'Mercado Livre Ltda.', cnpj: '24.316.108/0001-08' },
  { name: 'Localiza Rent a Car S.A.', cnpj: '16.670.085/0001-55' },
  { name: 'Porto Seguro S.A.', cnpj: '61.198.164/0001-60' },
  { name: 'TOTVS S.A.', cnpj: '53.113.791/0001-22' },
  { name: 'CI&T Software S.A.', cnpj: '06.273.189/0001-05' },
  { name: 'Bradesco S.A.', cnpj: '60.746.948/0001-12' },
  { name: 'Nubank Pagamentos S.A.', cnpj: '18.236.120/0001-58' },
  {
    name: 'iFood.com Agência de Restaurantes S.A.',
    cnpj: '14.380.200/0001-21',
  },
  { name: 'Grupo Boticário Ltda.', cnpj: '75.344.800/0001-63' },
  { name: 'Vivo Telecomunicações S.A.', cnpj: '02.558.157/0001-62' },
  { name: 'Claro S.A.', cnpj: '40.432.544/0001-47' },
  { name: 'WEG S.A.', cnpj: '84.429.695/0001-11' },
];
