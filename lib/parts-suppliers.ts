// Deep-link search across auto parts retailers relevant to a Dalmatia-area
// auto-electrician. No official API exists for any of these (confirmed via
// research — they're B2C/B2B retailers, not partner-API providers), and
// scraping their pages would likely violate their Terms of Service, so this
// only ever constructs a URL to THEIR OWN search page — nothing is read or
// scraped, the mechanic sees real results on the retailer's own site.
//
// Query parameter formats are best-effort (inferred from URL conventions
// observed on each site, e.g. WooCommerce's `?s=`), not verified against
// live search forms — these sites block automated verification. Worst case
// a guess is wrong and the link lands on the store's homepage/search page
// instead of pre-filled results, never broken or misleading.
export interface PartsSupplier {
  name: string;
  description: string;
  buildUrl: (query: string) => string;
}

export const PARTS_SUPPLIERS: PartsSupplier[] = [
  {
    name: 'CIAK Auto',
    description: 'Najveći hrvatski lanac (56 poslovnica) — dijelovi, akumulatori, ulja.',
    buildUrl: (query) => `https://webshop.ciak-auto.hr/?s=${encodeURIComponent(query)}&post_type=product`,
  },
  {
    name: 'AutoStanic',
    description: 'Hrvatska trgovina s pretragom po OEM broju dijela.',
    buildUrl: (query) => `https://www.autostanic.hr/oem?q=${encodeURIComponent(query)}`,
  },
  {
    name: 'Metalia Auto',
    description: 'Veletrgovina rezervnim dijelovima, 30+ godina tradicije.',
    buildUrl: (query) =>
      `https://metaliaauto.hr/?s=${encodeURIComponent(query)}&post_type=product`,
  },
  {
    name: '7zap',
    description: 'Profesionalni OEM/VIN katalog — unakrsna pretraga originalnih brojeva dijelova.',
    buildUrl: (query) => `https://7zap.com/en/search/?q=${encodeURIComponent(query)}`,
  },
  {
    name: 'AutoDoc',
    description: 'Veliki europski online dobavljač (regionalna .si stranica, dostava u HR).',
    buildUrl: (query) => `https://www.autodoc.si/search?keyword=${encodeURIComponent(query)}`,
  },
];
