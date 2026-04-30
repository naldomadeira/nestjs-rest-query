import Image from 'next/image';
import Link from 'next/link';

const features = [
  {
    title: 'Filtros dinâmicos',
    description: 'Filtre por qualquer campo permitido com operadores como eq, like, in, between e isNull.',
  },
  {
    title: 'Ordenação multi-coluna',
    description: 'Ordene por múltiplos campos com ASC/DESC, controlado por endpoint.',
  },
  {
    title: 'Paginação automática',
    description: 'Paginação baseada em página ou limit/offset com metadados completos na resposta.',
  },
  {
    title: 'Seleção de campos',
    description: 'Retorne apenas as colunas que o cliente precisa, reduzindo o payload.',
  },
  {
    title: 'Carregamento de relações',
    description: 'Carregue relações TypeORM declaradas na whitelist do endpoint.',
  },
  {
    title: 'Whitelist de segurança',
    description: 'Cada endpoint declara exatamente quais campos e operadores são permitidos.',
  },
];

const HomePage = () => (
  <div className="mx-auto mt-[var(--fd-nav-height)] max-w-5xl px-4 py-12">
    {/* Hero */}
    <div className="flex flex-col items-center text-center gap-6 mb-14">
      <div className="flex items-center gap-2.5">
        <Image
          src="/logomark.svg"
          alt="NestJS Dynamic Query Builder"
          width={40}
          height={40}
          className="dark:invert"
        />
        <code className="text-sm text-muted-foreground">
          nestjs-rest-query
        </code>
      </div>

      <h1 className="text-5xl font-bold tracking-tight leading-tight">
        NestJS Dynamic{' '}
        <span className="text-primary">Query Builder</span>
      </h1>

      <p className="text-lg text-muted-foreground max-w-xl">
        Filtros, paginação e ordenação dinâmicos a partir de parâmetros HTTP.
        TypeORM-first. Whitelist de segurança por endpoint.
      </p>

      <div className="flex items-center gap-3">
        <Link
          href="/docs/getting-started/prerequisites"
          className="inline-flex items-center px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors"
        >
          Começar →
        </Link>
        <Link
          href="/docs"
          className="inline-flex items-center px-5 py-2.5 rounded-lg border border-border text-sm font-medium hover:bg-muted transition-colors"
        >
          Documentação
        </Link>
      </div>
    </div>

    {/* Preview — light/dark variants */}
    <div className="rounded-xl overflow-hidden border border-border shadow-md mb-16">
      <Image
        src="/patterns.png"
        alt="NestJS Dynamic Query Builder — visão geral"
        width={1200}
        height={630}
        className="w-full h-auto dark:hidden"
        priority
      />
      <Image
        src="/patters-dark.png"
        alt="NestJS Dynamic Query Builder — visão geral"
        width={1200}
        height={630}
        className="w-full h-auto hidden dark:block"
        priority
      />
    </div>

    {/* Features grid */}
    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
      {features.map((f) => (
        <div
          key={f.title}
          className="rounded-lg border border-border p-5 bg-card hover:bg-muted/50 transition-colors"
        >
          <h3 className="font-semibold mb-1 text-sm">{f.title}</h3>
          <p className="text-sm text-muted-foreground leading-relaxed">{f.description}</p>
        </div>
      ))}
    </div>
  </div>
);

export default HomePage;
