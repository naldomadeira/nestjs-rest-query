import { foldText } from '@core/text-profile';

describe('foldText', () => {
  it('normaliza para NFC e minúscula', () => {
    expect(foldText('AÇÃO')).toBe('ação');
  });

  it('NFD e NFC produzem o mesmo dobrado', () => {
    expect(foldText('Ação'.normalize('NFD'))).toBe(
      foldText('Ação'.normalize('NFC'))
    );
  });

  it('preserva %, _ e barra invertida', () => {
    expect(foldText('100%_\\')).toBe('100%_\\');
  });

  it('preserva espaços internos e externos', () => {
    expect(foldText(' A  B ')).toBe(' a  b ');
  });

  it('é idempotente', () => {
    const once = foldText('ÀÉÎÕÜ');
    expect(foldText(once)).toBe(once);
  });

  it('não altera texto já dobrado', () => {
    expect(foldText('ada@acme.test')).toBe('ada@acme.test');
  });
});
