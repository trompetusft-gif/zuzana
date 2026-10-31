// Build webu Svet Krásy.
// Skopíruje statické súbory do dist/, z článkov v content/blog/*.md vygeneruje blog
// a najnovšie články vloží na hlavnú stránku. Spúšťa ho Netlify po každom uložení v /admin.
//
// Lokálne:  npm run build            (len publikované články)
//           npm run build -- --drafts (aj koncepty, na náhľad)

import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import matter from 'gray-matter';
import { marked } from 'marked';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist');
const POSTS_DIR = path.join(ROOT, 'content', 'blog');
const SHOW_DRAFTS = process.argv.includes('--drafts');

// Adresa webu: Netlify ju nastaví sám (premenná URL). TODO: po kúpe domény sa prepne automaticky.
const SITE = (process.env.URL || 'https://svetkrasy.netlify.app').replace(/\/$/, '');
const BOOKING_URL = 'https://partner.notino.com/api/notino-partner/b2c/redirect/link/-hMrQbYpIFiU';
const LATEST_ON_HOME = 3;

const STATIC = ['index.html', 'ochrana-osobnych-udajov.html', 'og-image.jpg', 'robots.txt', '_headers', 'img', 'fonts', 'video', 'admin'];

const esc = (s = '') => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmtDate = d => new Intl.DateTimeFormat('sk-SK', { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
const isoDate = d => d.toISOString().slice(0, 10);
const slugify = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function exists(p) { try { await fs.access(p); return true; } catch { return false; } }

async function loadPosts() {
  if (!(await exists(POSTS_DIR))) return [];
  const files = (await fs.readdir(POSTS_DIR)).filter(f => f.endsWith('.md'));
  const posts = [];
  for (const file of files) {
    const { data, content } = matter(await fs.readFile(path.join(POSTS_DIR, file), 'utf8'));
    if (data.draft && !SHOW_DRAFTS) continue;
    if (!data.title) { console.warn(`! ${file}: chýba názov, preskakujem`); continue; }
    const date = data.date ? new Date(data.date) : new Date();
    if (Number.isNaN(date.getTime())) { console.warn(`! ${file}: neplatný dátum, preskakujem`); continue; }
    const slug = slugify(data.slug || file.replace(/\.md$/, ''));
    const words = content.split(/\s+/).filter(Boolean).length;
    posts.push({
      slug,
      title: data.title,
      description: data.description || '',
      image: data.image || '',
      imageAlt: data.image_alt || data.title,
      date,
      draft: !!data.draft,
      minutes: Math.max(1, Math.round(words / 200)),
      html: marked.parse(content),
      url: `/blog/${slug}/`
    });
  }
  return posts.sort((a, b) => b.date - a.date);
}

// Písma (blok @font-face) berieme z index.html, aby boli na jednom mieste.
async function fontCss() {
  const html = await fs.readFile(path.join(ROOT, 'index.html'), 'utf8');
  const m = html.match(/<style>(\/\* Písma[\s\S]*?)<\/style>/);
  return m ? m[1].replace(/url\("fonts\//g, 'url("/fonts/') : '';
}

const CSS = `
:root{--ivory:#FFFBFA;--blush:#FBEEEC;--wine:#5A1828;--wine-2:#74263A;--gold:#B98A4F;--gold-light:#E4C590;--gold-text:#8A5E2A;--text:#3A2A2D;--muted:#75585A;--line:#EAD5C3;--f-display:"Cinzel",Georgia,serif;--f-serif:"Cormorant Garamond",Georgia,serif;--f-script:"Pinyon Script",cursive}
*,*::before,*::after{box-sizing:border-box}
body{margin:0;background:var(--ivory);color:var(--text);font-family:var(--f-serif);font-size:19px;line-height:1.65;font-weight:500;font-variant-numeric:lining-nums;-webkit-font-smoothing:antialiased;overflow-x:hidden}
img{max-width:100%;height:auto;display:block}
a{color:var(--wine-2)}a:hover{color:var(--wine)}
:focus-visible{outline:2px solid var(--wine-2);outline-offset:3px;border-radius:6px}
.skip{position:absolute;left:12px;top:-60px;background:var(--wine);color:#fff;padding:10px 16px;border-radius:10px;z-index:10}.skip:focus{top:12px;color:#fff}
.top{background:var(--blush) url("/img/mramor.webp") center/cover;border-bottom:1px solid var(--line)}
.top__in{max-width:1180px;margin:0 auto;padding:14px 20px;display:flex;align-items:center;justify-content:space-between;gap:14px;flex-wrap:wrap}
.brand{display:flex;align-items:center;gap:12px;text-decoration:none;color:var(--wine)}
.brand img{width:46px;height:46px;border-radius:50%;box-shadow:0 0 0 1px rgba(185,138,79,.55)}
.brand span{font-family:var(--f-display);letter-spacing:.12em;font-weight:600;font-size:17px}
.tnav{display:flex;flex-wrap:wrap;gap:4px 6px;list-style:none;margin:0;padding:0}
.tnav a{display:block;padding:10px 10px;font-family:var(--f-display);font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--text);text-decoration:none}
.tnav a:hover,.tnav a[aria-current]{color:var(--wine);text-decoration:underline;text-decoration-color:var(--gold);text-underline-offset:6px}
.btn{display:inline-flex;align-items:center;justify-content:center;min-height:48px;padding:10px 24px;border-radius:999px;background:var(--wine);color:#FFF6F2;text-decoration:none;font-family:var(--f-display);font-size:13.5px;letter-spacing:.12em;text-transform:uppercase;font-weight:600;box-shadow:inset 0 0 0 3px var(--wine),inset 0 0 0 4px rgba(228,197,144,.75)}
.btn:hover{background:var(--wine-2);color:#fff}
.btn--ghost{background:#fff;color:var(--wine);box-shadow:none;border:1px solid var(--gold)}.btn--ghost:hover{background:var(--blush);color:var(--wine)}
.hero{text-align:center;padding:56px 20px 30px;max-width:820px;margin:0 auto}
.eyebrow{font-family:var(--f-display);font-size:13px;letter-spacing:.28em;text-transform:uppercase;color:var(--gold-text);margin:0 0 10px}
h1{font-family:var(--f-display);font-weight:500;color:var(--wine);font-size:clamp(28px,6vw,46px);line-height:1.15;letter-spacing:.04em;margin:0}
.script{font-family:var(--f-script);color:var(--gold-text);font-size:clamp(30px,6vw,46px);line-height:1;display:block;margin-top:4px}
.lead{color:var(--muted);margin:16px auto 0;max-width:620px}
.grid{max-width:1180px;margin:0 auto;padding:20px 20px 90px;display:grid;gap:26px;grid-template-columns:repeat(auto-fit,minmax(min(100%,320px),370px));justify-content:center}
.empty{grid-column:1/-1;text-align:center;color:var(--muted);padding:40px 0}
.card{background:#fff;border:1px solid rgba(185,138,79,.45);border-radius:20px;overflow:hidden;display:flex;flex-direction:column;box-shadow:0 18px 40px -30px rgba(90,24,40,.45);transition:transform .25s,box-shadow .25s}
.card:hover{transform:translateY(-3px);box-shadow:0 26px 50px -30px rgba(90,24,40,.55)}
.card__img{aspect-ratio:16/10;object-fit:cover;width:100%;background:var(--blush)}
.card__ph{aspect-ratio:16/10;background:var(--blush) url("/img/mramor.webp") center/cover;display:grid;place-items:center}
.card__ph img{width:72px;height:72px;border-radius:50%;opacity:.9}
.card__body{padding:20px 22px 24px;display:flex;flex-direction:column;gap:8px;flex:1}
.meta{font-family:var(--f-display);font-size:11.5px;letter-spacing:.16em;text-transform:uppercase;color:var(--gold-text)}
.card h2{font-family:var(--f-display);font-weight:500;font-size:20px;line-height:1.3;letter-spacing:.03em;margin:0;color:var(--wine)}
.card h2 a{color:inherit;text-decoration:none}.card h2 a::after{content:"";position:absolute;inset:0}
.card{position:relative}
.card p{margin:0;color:var(--muted);font-size:17.5px;line-height:1.5}
.more{margin-top:auto;padding-top:8px;font-family:var(--f-display);font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--wine-2)}
.badge{display:inline-block;background:#FFF1C9;color:#6B4A00;border-radius:999px;padding:2px 10px;font-size:12px;letter-spacing:.08em;margin-left:6px}
.post{max-width:760px;margin:0 auto;padding:0 20px 40px}
.post__cover{border-radius:20px;margin:0 0 34px;border:1px solid rgba(185,138,79,.45);width:100%;aspect-ratio:16/9;object-fit:cover}
.prose h2{font-family:var(--f-display);font-weight:500;color:var(--wine);font-size:clamp(21px,4.4vw,27px);letter-spacing:.03em;line-height:1.25;margin:40px 0 12px}
.prose h3{font-size:23px;color:var(--wine);margin:28px 0 8px;line-height:1.3}
.prose p,.prose li{margin:0 0 14px}
.prose ul,.prose ol{padding-left:24px}
.prose img{border-radius:16px;margin:24px 0}
.prose blockquote{margin:26px 0;padding:14px 22px;border-left:3px solid var(--gold);background:var(--blush);border-radius:0 14px 14px 0;font-style:italic}
.prose a{text-underline-offset:3px}
.cta{max-width:760px;margin:10px auto 90px;padding:0 20px}
.cta__in{background:var(--blush) url("/img/mramor.webp") center/cover;border:1px solid rgba(185,138,79,.55);border-radius:22px;padding:30px 24px;text-align:center}
.cta__in h2{font-family:var(--f-display);font-weight:500;color:var(--wine);font-size:22px;letter-spacing:.04em;margin:0 0 8px}
.cta__in p{margin:0 0 18px;color:var(--muted)}
.cta__btns{display:flex;flex-wrap:wrap;gap:12px;justify-content:center}
.back{display:inline-block;margin:0 0 26px;font-family:var(--f-display);font-size:12.5px;letter-spacing:.14em;text-transform:uppercase;text-decoration:none}
footer{background:#3E1019;color:#F1DCD8;text-align:center;padding:34px 20px;font-size:16px}
footer a{color:#F6E2C6}
@media (max-width:640px){.tnav{width:100%;justify-content:space-between}.tnav a{padding:8px 4px;font-size:11.5px;letter-spacing:.1em}}
`;

const NAV = [['/#sluzby', 'Služby'], ['/#cennik', 'Cenník'], ['/#kalkulacka', 'Kalkulačka'], ['/blog/', 'Blog'], ['/#kontakt', 'Kontakt']];

function layout({ title, description, canonical, image, body, jsonLd, current, noindex }) {
  const ogImage = image ? (image.startsWith('http') ? image : SITE + image) : `${SITE}/og-image.jpg`;
  return `<!doctype html>
<html lang="sk">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<meta name="robots" content="${noindex ? 'noindex, follow' : 'index, follow'}">
<meta name="theme-color" content="#FBEDEC">
<link rel="canonical" href="${canonical}">
<meta property="og:type" content="${jsonLd ? 'article' : 'website'}">
<meta property="og:locale" content="sk_SK">
<meta property="og:site_name" content="Svet Krásy – kozmetický salón">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:url" content="${canonical}">
<meta property="og:image" content="${esc(ogImage)}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/png" href="/img/favicon.png">
<link rel="preload" href="/fonts/cormorant-garamond-latin-500-normal.woff2" as="font" type="font/woff2" crossorigin>
<style>${FONTS}</style>
<style>${CSS}</style>
${jsonLd ? `<script type="application/ld+json">${JSON.stringify(jsonLd).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body>
<a class="skip" href="#obsah">Preskočiť na obsah</a>
<header class="top">
  <div class="top__in">
    <a class="brand" href="/"><img src="/img/logo-mala.webp" width="46" height="46" alt=""><span>SVET KRÁSY</span></a>
    <nav aria-label="Hlavné menu"><ul class="tnav">${NAV.map(([h, t]) => `<li><a href="${h}"${t === current ? ' aria-current="page"' : ''}>${t}</a></li>`).join('')}</ul></nav>
  </div>
</header>
<main id="obsah">
${body}
</main>
<footer>
  <p>© ${new Date().getFullYear()} Svet Krásy – kozmetický salón, Nitra · <a href="tel:+421918797408">0918&nbsp;797&nbsp;408</a> · <a href="/ochrana-osobnych-udajov.html">Ochrana osobných údajov</a></p>
</footer>
</body>
</html>
`;
}

function card(p, headingTag = 'h2') {
  const img = p.image
    ? `<img class="card__img" src="${esc(p.image)}" alt="${esc(p.imageAlt)}" loading="lazy" width="640" height="400">`
    : `<div class="card__ph" aria-hidden="true"><img src="/img/logo-mala.webp" alt="" width="72" height="72" loading="lazy"></div>`;
  return `<article class="card">
  ${img}
  <div class="card__body">
    <span class="meta"><time datetime="${isoDate(p.date)}">${fmtDate(p.date)}</time> · ${p.minutes} min čítania${p.draft ? '<span class="badge">koncept</span>' : ''}</span>
    <${headingTag}><a href="${p.url}">${esc(p.title)}</a></${headingTag}>
    ${p.description ? `<p>${esc(p.description)}</p>` : ''}
    <span class="more" aria-hidden="true">Čítať článok ›</span>
  </div>
</article>`;
}

function blogIndex(posts) {
  const body = `
<div class="hero">
  <p class="eyebrow">Svet Krásy</p>
  <h1>Blog</h1>
  <span class="script">rady a novinky o starostlivosti o pleť</span>
  <p class="lead">Tipy na domácu starostlivosť, vysvetlenie ošetrení a novinky zo salónu.</p>
</div>
<div class="grid">
${posts.length ? posts.map(p => card(p)).join('\n') : '<p class="empty">Prvé články pripravujeme.</p>'}
</div>`;
  return layout({
    title: 'Blog | Svet Krásy – kozmetický salón Nitra',
    description: 'Rady o starostlivosti o pleť, vysvetlenie ošetrení a novinky z kozmetického salónu Svet Krásy v Nitre.',
    canonical: `${SITE}/blog/`,
    body,
    current: 'Blog'
  });
}

function postPage(p) {
  const canonical = SITE + p.url;
  const body = `
<div class="hero">
  <p class="meta"><time datetime="${isoDate(p.date)}">${fmtDate(p.date)}</time> · ${p.minutes} min čítania</p>
  <h1>${esc(p.title)}</h1>
  ${p.description ? `<p class="lead">${esc(p.description)}</p>` : ''}
</div>
<article class="post">
  ${p.image ? `<img class="post__cover" src="${esc(p.image)}" alt="${esc(p.imageAlt)}" width="1200" height="675">` : ''}
  <div class="prose">
${p.html}
  </div>
</article>
<aside class="cta" aria-labelledby="cta-title">
  <div class="cta__in">
    <h2 id="cta-title">Chcete to vyskúšať?</h2>
    <p>Rada vám poradím, aké ošetrenie vaša pleť práve potrebuje.</p>
    <div class="cta__btns">
      <a class="btn" href="${BOOKING_URL}" target="_blank" rel="noopener">Rezervovať termín</a>
      <a class="btn btn--ghost" href="/#kalkulacka">Vypočítať cenu</a>
    </div>
  </div>
</aside>
<p class="post"><a class="back" href="/blog/">← Všetky články</a></p>`;
  return layout({
    title: `${p.title} | Blog Svet Krásy`,
    description: p.description || p.title,
    canonical,
    image: p.image,
    body,
    current: 'Blog',
    noindex: p.draft,
    jsonLd: {
      '@context': 'https://schema.org',
      '@type': 'BlogPosting',
      headline: p.title,
      description: p.description || undefined,
      image: p.image ? (p.image.startsWith('http') ? p.image : SITE + p.image) : undefined,
      datePublished: p.date.toISOString(),
      inLanguage: 'sk',
      mainEntityOfPage: canonical,
      author: { '@type': 'Person', name: 'Mgr. Zuzana Machovičová' },
      publisher: { '@type': 'Organization', name: 'Svet Krásy – kozmetický salón', logo: { '@type': 'ImageObject', url: `${SITE}/og-image.jpg` } }
    }
  });
}

// Na hlavnej stránke nahradí <!-- BLOG:LATEST --> kartami a odkryje sekciu #blog.
function injectHome(html, posts) {
  const latest = posts.slice(0, LATEST_ON_HOME);
  if (!latest.length) return html;
  const cards = latest.map(p => {
    const img = p.image
      ? `<img src="${esc(p.image)}" alt="${esc(p.imageAlt)}" loading="lazy" width="640" height="400">`
      : `<span class="bcard__ph" aria-hidden="true"></span>`;
    return `<article class="bcard reveal">${img}<div class="bcard__body"><span class="bcard__meta"><time datetime="${isoDate(p.date)}">${fmtDate(p.date)}</time></span><h3><a href="${p.url}">${esc(p.title)}</a></h3>${p.description ? `<p>${esc(p.description)}</p>` : ''}</div></article>`;
  }).join('\n');
  return html
    .replace('<!-- BLOG:LATEST -->', cards)
    .replace(/(<section[^>]*id="blog"[^>]*?)\s+hidden(>)/, '$1$2');
}

function sitemap(posts) {
  const today = isoDate(new Date());
  const urls = [
    [`${SITE}/`, today, '1.0'],
    [`${SITE}/blog/`, posts[0] ? isoDate(posts[0].date) : today, '0.7'],
    ...posts.filter(p => !p.draft).map(p => [SITE + p.url, isoDate(p.date), '0.6']),
    [`${SITE}/ochrana-osobnych-udajov.html`, '2026-10-03', '0.3']
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([u, d, p]) => `  <url><loc>${u}</loc><lastmod>${d}</lastmod><priority>${p}</priority></url>`).join('\n')}
</urlset>
`;
}

let FONTS = '';

async function main() {
  await fs.rm(DIST, { recursive: true, force: true });
  await fs.mkdir(DIST, { recursive: true });
  for (const item of STATIC) {
    const src = path.join(ROOT, item);
    if (await exists(src)) await fs.cp(src, path.join(DIST, item), { recursive: true });
  }

  FONTS = await fontCss();
  const posts = await loadPosts();

  await fs.mkdir(path.join(DIST, 'blog'), { recursive: true });
  await fs.writeFile(path.join(DIST, 'blog', 'index.html'), blogIndex(posts));
  for (const p of posts) {
    const dir = path.join(DIST, 'blog', p.slug);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, 'index.html'), postPage(p));
  }

  const homePath = path.join(DIST, 'index.html');
  await fs.writeFile(homePath, injectHome(await fs.readFile(homePath, 'utf8'), posts));
  await fs.writeFile(path.join(DIST, 'sitemap.xml'), sitemap(posts));
  await fs.writeFile(path.join(DIST, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /admin/\n\nSitemap: ${SITE}/sitemap.xml\n`);

  const n = posts.length;
  console.log(`Hotovo: ${n} ${n === 1 ? 'článok' : n >= 2 && n <= 4 ? 'články' : 'článkov'}${SHOW_DRAFTS ? ' (vrátane konceptov)' : ''} → dist/`);
}

main().catch(err => { console.error(err); process.exit(1); });
