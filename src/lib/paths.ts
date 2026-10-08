// Il base path cambia tra locale ('/') e GitHub Pages ('/Istinto-puro/').
const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');

/** Path assoluto dell'app, es. appPath('/sfida/abc') -> '/Istinto-puro/sfida/abc' */
export function appPath(path = '/'): string {
  return `${BASE}${path.startsWith('/') ? path : `/${path}`}`;
}

/** URL completo con origin, per link condivisibili e redirect OAuth/email. */
export function appUrl(path = '/'): string {
  return `${window.location.origin}${appPath(path)}`;
}

/** Pathname corrente senza il base path, es. '/sfida/abc'. */
export function currentAppPath(): string {
  const { pathname } = window.location;
  return BASE && pathname.startsWith(BASE) ? pathname.slice(BASE.length) || '/' : pathname;
}
