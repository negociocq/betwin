import { required, webUrl } from '../api/store.mjs';

export const licenses = ['CC0-1.0', 'CC-BY-4.0', 'CC-BY-SA-4.0', 'OWN', 'PERMISSION'];
export function validateRights(input) {
  if (!licenses.includes(input.license)) throw new Error('Licença não suportada. Use CC0, CC BY, CC BY-SA, autoria própria ou autorização documentada.');
  if (input.commercialUse !== true || input.modifications !== true) throw new Error('Confirme permissão para uso comercial e modificações.');
  const rights = { license: input.license, author: required(input.author, 'Autor', 250), sourceUrl: webUrl(input.sourceUrl), evidence: required(input.evidence, 'Comprovação da licença/autorização', 2000), commercialUse: true, modifications: true, attestedBy: 'local-user' };
  return rights;
}
export function creditsFor(media) {
  return media.map(m => `${m.name}\nAutor: ${m.author}\nFonte: ${m.sourceUrl}\nLicença: ${m.license}\n${({ 'CC0-1.0': 'https://creativecommons.org/publicdomain/zero/1.0/', 'CC-BY-4.0': 'https://creativecommons.org/licenses/by/4.0/', 'CC-BY-SA-4.0': 'https://creativecommons.org/licenses/by-sa/4.0/' })[m.license] || 'Conforme declaração e comprovação cadastradas'}\nAlterações: enquadramento, movimento, montagem e sobreposição de legendas.\nComprovação: ${m.evidence}`).join('\n\n');
}
