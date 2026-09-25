// Deep-link search across auto parts retailers relevant to a Dalmatia-area
// auto-electrician. No official API exists for any of these (confirmed via
// research — they're B2C/B2B retailers, not partner-API providers), and
// scraping their pages would likely violate their Terms of Service, so this
// only ever constructs a URL — nothing is read or scraped.
//
// Most of these sites (ciakauto.com, webshop.tokic.hr, autodoc.si) sit
// behind bot-protection (Cloudflare challenge / 403) that blocks automated
// verification of their real search form, and an earlier best-effort guess
// at their query-parameter format was confirmed broken in real use. Rather
// than guess again and risk another dead link, those three use a Google
// site-search fallback (`site:domain query`) — it never 404s and always
// surfaces real indexed product pages, at the cost of one extra click
// through Google's results instead of landing directly on the store's own
// filtered search. Metalia Auto's WooCommerce search pattern was directly
// confirmed from its page source, so it gets a true direct deep link.
// 7zap is a VIN/catalog browser, not a keyword search engine — no query
// string applies, so it just opens the catalog homepage.
export interface PartsSupplier {
  name: string;
  description: string;
  buildUrl: (query: string) => string;
}

function googleSiteSearch(domain: string, query: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(`site:${domain} ${query}`)}`;
}

export const PARTS_SUPPLIERS: PartsSupplier[] = [
  {
    name: 'CIAK Auto',
    description: 'Najveći hrvatski lanac (56 poslovnica) — dijelovi, akumulatori, ulja.',
    buildUrl: (query) => googleSiteSearch('ciakauto.com', query),
  },
  {
    name: 'Tokić',
    description: 'Najveći hrvatski lanac auto dijelova i opreme, dostava/preuzimanje u poslovnici.',
    buildUrl: (query) => googleSiteSearch('webshop.tokic.hr', query),
  },
  {
    name: 'Metalia Auto',
    description: 'Veletrgovina rezervnim dijelovima, 30+ godina tradicije.',
    buildUrl: (query) => `https://metaliaauto.hr/?s=${encodeURIComponent(query)}&post_type=product&et_search=true`,
  },
  {
    name: '7zap',
    description: 'Profesionalni OEM/VIN katalog — otvara se katalog, odaberite vozilo za pretragu.',
    buildUrl: () => 'https://7zap.com/en/',
  },
  {
    name: 'AutoDoc',
    description: 'Veliki europski online dobavljač (regionalna .si stranica, dostava u HR).',
    buildUrl: (query) => googleSiteSearch('autodoc.si', query),
  },
];
