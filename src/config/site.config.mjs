const env = typeof process !== 'undefined' && process.env ? process.env : {};

export const SITE_CONFIG = {
  slug: "feierabendkueche",
  name: env.SITE_NAME || "FeierabendKüche",
  theme: "editorial-warm",
  tagline: "Schnelle, günstige Feierabend-Rezepte unter 25 Minuten",
  description: "Einfache Alltagsrezepte für Berufstätige und Familien: One-Pot-Pasta, schnelle Pfannengerichte, Airfryer-Rezepte und Meal-Prep mit Portions-Umrechner.",
  adsenseClientId: env.PUBLIC_ADSENSE_CLIENT || (typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env.PUBLIC_ADSENSE_CLIENT : '') || '',
  categories: {
  "unter-20-minuten": {
    "slug": "unter-20-minuten",
    "name": "Unter 20 Minuten",
    "icon": "⏱️",
    "description": "Blitzrezepte für Tage, an denen es nach Feierabend richtig schnell gehen muss.",
    "accent": "#c2410c"
  },
  "one-pot-pfanne": {
    "slug": "one-pot-pfanne",
    "name": "One-Pot & Pfanne",
    "icon": "🍳",
    "description": "Alles aus einem Topf oder einer Pfanne – maximaler Geschmack bei minimalem Abwasch.",
    "accent": "#ea580c"
  },
  "ofen-airfryer": {
    "slug": "ofen-airfryer",
    "name": "Ofen & Airfryer",
    "icon": "🥐",
    "description": "Blechgerichte & knusprige Heißluftfritteusen-Ideen ohne Danebenstehen.",
    "accent": "#d97706"
  },
  "meal-prep-buero": {
    "slug": "meal-prep-buero",
    "name": "Meal-Prep & Büro",
    "icon": "🥗",
    "description": "Vorbereitete Lunchboxen und Resteverwertung, die kalt und aufgewärmt schmecken.",
    "accent": "#3f6212"
  },
  "guenstig-kochen": {
    "slug": "guenstig-kochen",
    "name": "Günstig & Satt",
    "icon": "🥔",
    "description": "Herzhafte Sattmacher aus Vorratszutaten für unter 3 Euro pro Portion.",
    "accent": "#b45309"
  }
},
};

export function getCategoryList() {
  return Object.values(SITE_CONFIG.categories);
}

export function getCategoryBySlug(slug) {
  const list = Object.values(SITE_CONFIG.categories);
  return SITE_CONFIG.categories[slug] || list[0];
}
