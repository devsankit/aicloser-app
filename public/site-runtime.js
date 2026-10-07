// The original DOM enhancement layer is intentionally kept in one client-only
// module during the migration. Its browser APIs are initialized by SiteShell
// after React has mounted the legacy-compatible markup.
// @ts-nocheck

const brandName = 'AI Closer';
document.querySelector('.capabilities')?.removeAttribute('id');
document.querySelector('.features-showcase')?.setAttribute('id', 'features');
document.title = `${brandName} — Close Deals Faster`;
const brandTextWalker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
const brandTextNodes = [];
while (brandTextWalker.nextNode()) brandTextNodes.push(brandTextWalker.currentNode);
brandTextNodes.forEach((node) => {
  node.textContent = node.textContent.replace(/AI Closer/g, brandName);
});
document.querySelector('[aria-label="AI Closer home"]')?.setAttribute('aria-label', `${brandName} home`);
document.querySelectorAll('a[href*="framer.website/terms"]').forEach((link) => link.setAttribute('href', '#contact'));

// The visual lockup is an AI badge followed by the brand word. Keep the
// product name in marketing copy, but avoid repeating “AI” beside the badge.
document.querySelectorAll('.brand, .mini-brand, .cta-brand, .asset-brand-cover, .showcase-brand-cover').forEach((logo) => {
  logo.childNodes.forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) node.textContent = 'Closer';
    if (node.nodeType === Node.ELEMENT_NODE && (node.matches('b') || (node.matches('span') && !node.classList.contains('brand-mark')))) node.textContent = 'Closer';
  });
});

const replaceWithCloserLogo = (container, extraClass = '') => {
  if (!container) return;
  const darkSurface = container.closest('.power-card, .footer-bottom');
  const orangeSurface = container.closest('.cta, .showcase-brand-cover, .integration-center');
  const logo = document.createElement('span');
  logo.className = `css-logo ${darkSurface ? 'css-logo-dark' : orangeSurface ? 'css-logo-orange' : 'css-logo-light'} ${extraClass}`.trim();
  const mark = document.createElement('span');
  mark.className = 'css-logo-mark';
  mark.textContent = 'AI';
  const word = document.createElement('span');
  word.className = 'css-logo-word';
  word.textContent = 'Closer';
  logo.append(mark, word);
  container.replaceChildren(logo);
};
document.querySelectorAll('.brand, .mini-brand, .cta-brand').forEach((logo) => replaceWithCloserLogo(logo));
const footerBottom = document.querySelector('.footer-bottom');
if (footerBottom) {
  const footerLogo = document.createElement('span');
  footerLogo.className = 'footer-bottom-logo';
  footerBottom.append(footerLogo);
  replaceWithCloserLogo(footerLogo);
}

// Keep the desktop testimonial heading on one line without collapsing the
// whitespace that the source <br> contributes on narrow screens.
const testimonialHeading = document.querySelector('.testimonials .section-copy h2');
if (testimonialHeading) {
  testimonialHeading.innerHTML = 'What users <span>are saying</span><span class="accent">.</span>';
}
const featuresHeading = document.querySelector('.features-showcase .section-copy h2');
if (featuresHeading) {
  featuresHeading.innerHTML = 'Features to Streamline <span>your Sales Process</span><span class="accent">.</span>';
}
document.querySelectorAll('.main-features .section-copy h2, .blog .section-copy h2').forEach((heading) => {
  heading.innerHTML = heading.innerHTML.replace(/<br\s*\/?\s*>/gi, ' ');
});

const asset = (name) => name.includes('/') ? `assets/${name}` : `assets/converted/${name}`;
const referenceAssets = {
  hero: 'reference/hero-dashboard.png',
  capabilities: 'reference/core-capabilities.png',
  simplicity: 'reference/simplicity-first.png',
  security: 'reference/security.png',
  realtime: 'reference/realtime-sync.png',
  scalable: 'reference/scalable-infrastructure.png',
  search: 'reference/feature-pipeline.png',
  pipeline: 'reference/feature-pipeline.png',
  feature1: 'reference/feature-pipeline.png',
  feature2: 'reference/feature-productivity.png',
  feature3: 'reference/feature-analytics.png',
  blog: ['reference/blog-1.jpg', 'reference/blog-2.jpg', 'reference/blog-3.jpg'],
  avatars: ['reference/avatar-1.png', 'reference/avatar-2.png', 'reference/avatar-3.png'],
  partners: ['reference/partner-1.png', 'reference/partner-2.png', 'reference/partner-3.png', 'reference/partner-4.png'],
  motionLine: '0b1499449ad06175.svg'
};

function createReferenceImage(src, alt, className = 'reference-image') {
  const image = document.createElement('img');
  image.className = className;
  image.src = asset(src);
  image.alt = alt;
  image.loading = 'lazy';
  image.decoding = 'async';
  return image;
}

// Match the public Framer SVGPathAnimation geometry and its normalized path length.
const liveFlowPaths = document.querySelectorAll('.flow-lines path');
liveFlowPaths.forEach((path, index) => {
  const y = index < 2 ? 32 : 122;
  const curveY = y + 42;
  path.setAttribute('d', `M 0 ${y} L 394 ${y} L 518.4 ${curveY} L 921.6 ${curveY} L 1045.4 ${y} L 1440 ${y}`);
  if (index % 2 === 1) path.setAttribute('pathLength', '1000');
});

function hydrateReferenceAssets() {
  const hero = document.querySelector('.hero-dashboard');
  if (hero) {
    hero.classList.add('asset-dashboard');
    hero.prepend(createReferenceImage(referenceAssets.hero, 'AI Closer workspace dashboard', 'reference-image hero-reference-image'));
    const brandCover = document.createElement('span');
    brandCover.className = 'asset-brand-cover';
    replaceWithCloserLogo(brandCover);
    hero.append(brandCover);
  }

  const capabilities = document.querySelector('.pipeline-visual');
  if (capabilities) {
    capabilities.classList.add('asset-visual');
    capabilities.prepend(createReferenceImage(referenceAssets.capabilities, 'AI Closer visual pipeline', 'reference-image'));
  }

  const featureImages = [referenceAssets.simplicity, referenceAssets.security, referenceAssets.realtime, referenceAssets.scalable];
  document.querySelectorAll('.feature-card .feature-art').forEach((art, index) => {
    const image = createReferenceImage(featureImages[index], `${brandName} feature visual`, 'reference-image feature-reference-image');
    art.classList.add('asset-visual');
    art.prepend(image);
  });

  const showcase = document.querySelector('.integration-art');
  if (showcase) {
    showcase.classList.add('asset-visual', 'showcase-visual');
    showcase.classList.add('showcase-clickable');
    showcase.setAttribute('role', 'link');
    showcase.setAttribute('tabindex', '0');
    showcase.setAttribute('aria-label', 'Explore AI Closer features');
    const openShowcaseContact = () => document.querySelector('#contact')?.scrollIntoView({ behavior: 'smooth' });
    showcase.addEventListener('click', openShowcaseContact);
    showcase.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openShowcaseContact();
      }
    });
    showcase.prepend(createReferenceImage(referenceAssets.search, 'AI Closer command search', 'reference-image showcase-reference-image'));
    const showcaseBrandCover = document.createElement('span');
    showcaseBrandCover.className = 'showcase-brand-cover';
    replaceWithCloserLogo(showcaseBrandCover);
    showcase.append(showcaseBrandCover);
  }

  document.querySelectorAll('.blog-card').forEach((card, index) => {
    card.classList.add('image-card');
    card.style.setProperty('--card-image', `url("${asset(referenceAssets.blog[index % referenceAssets.blog.length])}")`);
  });

  const avatarTargets = document.querySelectorAll('.avatar');
  avatarTargets.forEach((avatar, index) => {
    avatar.classList.add('photo-avatar');
    avatar.style.backgroundImage = `url("${asset(referenceAssets.avatars[index % referenceAssets.avatars.length])}")`;
    avatar.setAttribute('aria-hidden', 'true');
  });

  const logoRow = document.querySelector('.logo-row');
  if (logoRow) {
    const indianBrands = [
      ['Tata', 'https://www.tata.com/'],
      ['Infosys', 'https://www.infosys.com/'],
      ['Zoho', 'https://www.zoho.com/'],
      ['Razorpay', 'https://razorpay.com/'],
      ['Freshworks', 'https://www.freshworks.com/'],
      ['Zerodha', 'https://zerodha.com/'],
      ['Reliance', 'https://www.ril.com/']
    ];
    logoRow.replaceChildren(...indianBrands.map(([name, href]) => {
      const link = document.createElement('a');
      link.className = 'partner-name';
      link.href = href;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = name;
      link.setAttribute('aria-label', `${name} official website`);
      return link;
    }));
  }

  const testimonialTrack = document.querySelector('.testimonial-track');
  if (testimonialTrack && !testimonialTrack.querySelector('.company-proof')) {
    const reverseRow = testimonialTrack.querySelector('.testimonial-row.reverse');
    if (reverseRow && !reverseRow.textContent.includes('Isabelle Moreau')) {
      const isabelle = document.createElement('blockquote');
      isabelle.innerHTML = '“AI Closer gives our team one clear place to turn conversations into momentum.”<footer><b>Isabelle Moreau</b><span>REVENUE LEAD AT LUMEN</span></footer>';
      reverseRow.append(isabelle);
    }
    const proof = document.createElement('aside');
    proof.className = 'company-proof';
    proof.innerHTML = `<div class="proof-avatars">${referenceAssets.avatars.map((file) => `<img src="${asset(file)}" alt="" />`).join('')}</div><strong>Used by 300+ Companies</strong>`;
    if (reverseRow) reverseRow.insertBefore(proof, reverseRow.children[2] || null);
    testimonialTrack.querySelectorAll('.testimonial-row').forEach((row) => {
      if (row.dataset.looped === 'true') return;
      row.dataset.looped = 'true';
      const duplicate = Array.from(row.children).map((card) => card.cloneNode(true));
      duplicate.forEach((card) => {
        card.setAttribute('aria-hidden', 'true');
        row.append(card);
      });
    });
  }

  const integrationCenter = document.querySelector('.integration-center');
  if (integrationCenter) replaceWithCloserLogo(integrationCenter, 'integration-logo');
}

hydrateReferenceAssets();

const logoMarquee = document.querySelector('.logo-marquee');
const logoRow = logoMarquee?.querySelector('.logo-row');
if (logoMarquee && logoRow) {
  const track = document.createElement('div');
  track.className = 'logo-track';
  const duplicate = logoRow.cloneNode(true);
  duplicate.setAttribute('aria-hidden', 'true');
  track.append(logoRow, duplicate);
  logoMarquee.replaceChildren(track);
  const logoSetWidth = logoRow.getBoundingClientRect().width;
  if (logoSetWidth > 0) track.style.setProperty('--ticker-duration', `${logoSetWidth / 100}s`);
}

document.querySelectorAll('.testimonial-row').forEach((row) => {
  const loopWidth = row.getBoundingClientRect().width / 2;
  if (loopWidth > 0) row.style.setProperty('--ticker-duration', `${loopWidth / 50}s`);
});

const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Framer's public page uses spring-based appear presets. Keep the same
// measured offsets/delays while staying framework-free in the local clone.
const appearPresets = {
  pill: { y: 40, delay: 100 },
  title: { y: 60, delay: 200 },
  copy: { y: 80, delay: 300 },
  action: { y: 60, delay: 400 },
  visual: { y: 150, delay: 600 },
  follow: { y: 40, delay: 700 }
};

function registerAppear(element, preset = 'copy') {
  if (!element || element.dataset.appearRegistered) return;
  const values = appearPresets[preset] || appearPresets.copy;
  element.dataset.appearRegistered = 'true';
  element.classList.add('appear-motion');
  element.style.setProperty('--appear-y', `${values.y}px`);
  element.style.setProperty('--appear-delay', `${values.delay}ms`);
  appearObserver.observe(element);
}

const appearObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (!entry.isIntersecting) return;
    entry.target.classList.add('appear-visible');
    appearObserver.unobserve(entry.target);
  });
}, { threshold: 0.08, rootMargin: '0px 0px 0px 0px' });

registerAppear(document.querySelector('.trial-pill'), 'pill');
registerAppear(document.querySelector('.hero-title'), 'title');
registerAppear(document.querySelector('.hero-copy'), 'copy');
registerAppear(document.querySelector('.hero-actions'), 'action');
registerAppear(document.querySelector('.flow-lines'), 'action');
registerAppear(document.querySelector('.hero-dashboard'), 'visual');
registerAppear(document.querySelector('.logo-strip'), 'follow');

document.querySelectorAll('.section-copy').forEach((element) => registerAppear(element, 'copy'));
document.querySelectorAll('.pipeline-visual, .feature-card, .showcase-panel, .step, .testimonial-row, .power-card, .blog-card, .faq-layout, .cta-inner, .newsletter, .footer-grid').forEach((element, index) => {
  const preset = element.matches('.pipeline-visual, .showcase-panel, .power-card, .cta-inner') ? 'visual' : index % 3 === 1 ? 'title' : 'copy';
  registerAppear(element, preset);
});

function activatePassedAppears() {
  document.querySelectorAll('.appear-motion:not(.appear-visible)').forEach((element) => {
    if (element.getBoundingClientRect().top < window.innerHeight * 1.08) {
      element.classList.add('appear-visible');
      appearObserver.unobserve(element);
    }
  });
}
window.addEventListener('scroll', activatePassedAppears, { passive: true });
requestAnimationFrame(activatePassedAppears);

// The Framer hero mockup observes its layout box before the entrance transform.
// Trigger the equivalent measured 0.6s entrance even while its transformed box
// is still below the initial viewport edge.
const heroEntrance = document.querySelector('.hero-dashboard');
if (heroEntrance) {
  window.setTimeout(() => {
    heroEntrance.classList.add('appear-visible');
    appearObserver.unobserve(heroEntrance);
  }, reduceMotion ? 0 : 600);
}

// Framer links the hero dashboard's X rotation to page scroll: it starts
// tilted in the hero and settles flat as the dashboard reaches the logo strip.
// Keep the same behavior locally instead of leaving the image permanently flat.
if (heroEntrance) {
  const heroScrollEnd = () => Math.max(1, window.innerHeight);
  let heroScrollStarted = false;
  let heroScrollFrame = 0;
  const updateHeroScroll = () => {
    heroScrollFrame = 0;
    if (!heroScrollStarted) return;
    const progress = Math.min(1, Math.max(0, window.scrollY / heroScrollEnd()));
    const tilt = reduceMotion ? 0 : 24.6 * Math.sqrt(Math.max(0, 1 - progress));
    const mobile = window.matchMedia('(max-width: 620px)').matches;
    heroEntrance.style.animation = 'none';
    heroEntrance.style.transition = 'none';
    heroEntrance.style.transform = mobile
      ? `translateX(-50%) perspective(1200px) rotateX(${tilt}deg) translateY(0) scale(.43)`
      : `translateX(-50%) perspective(1200px) rotateX(${tilt}deg) translateY(0)`;
  };
  const startHeroScrollMotion = () => {
    heroScrollStarted = true;
    updateHeroScroll();
  };
  const scheduleHeroScroll = () => {
    if (!heroScrollStarted) startHeroScrollMotion();
    if (heroScrollFrame) return;
    heroScrollFrame = window.requestAnimationFrame(updateHeroScroll);
  };
  window.addEventListener('scroll', scheduleHeroScroll, { passive: true });
  window.addEventListener('resize', scheduleHeroScroll, { passive: true });
  if (window.scrollY > 0 || reduceMotion) startHeroScrollMotion();
  else window.setTimeout(startHeroScrollMotion, 1650);
}

function splitText(element) {
  let index = 0;
  const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT);
  const textNodes = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode);
  textNodes.forEach((node) => {
    if (!node.textContent.trim()) return;
    const fragment = document.createDocumentFragment();
    node.textContent.split(/(\s+)/g).forEach((token) => {
      if (!token) return;
      if (/^\s+$/.test(token)) {
        fragment.appendChild(document.createTextNode(token));
        return;
      }
      const word = document.createElement('span');
      word.className = 'word';
      word.style.setProperty('--i', index++);
      word.textContent = token;
      fragment.appendChild(word);
    });
    node.replaceWith(fragment);
  });
}

// Framer reveals these headings as complete blocks. The local clone already
// applies the measured section spring above; per-word clipping caused visible
// half-rendered headings during scroll, so keep the text intact.

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      if (!entry.target.matches('[data-text-reveal]')) revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal, [data-text-reveal]').forEach((element) => revealObserver.observe(element));

const header = document.querySelector('[data-header]');
let lastScroll = 0;
window.addEventListener('scroll', () => {
  const current = window.scrollY;
  if (current > 120 && current > lastScroll) header.classList.add('scrolled');
  if (current < lastScroll || current < 80) header.classList.remove('scrolled');
  lastScroll = current;
}, { passive: true });

const menu = document.querySelector('.menu-button');
const nav = document.querySelector('.nav-links');
menu?.addEventListener('click', () => {
  const open = nav.classList.toggle('open');
  menu.setAttribute('aria-expanded', String(open));
});
nav?.querySelectorAll('a').forEach((link) => link.addEventListener('click', () => nav.classList.remove('open')));

const countdown = document.querySelector('[data-countdown]');
const countdownKey = 'closer-trial-deadline';
let countdownDeadline = Number(localStorage.getItem(countdownKey));
if (!Number.isFinite(countdownDeadline) || countdownDeadline <= Date.now()) {
  countdownDeadline = Date.now() + 60 * 60 * 1000;
  localStorage.setItem(countdownKey, String(countdownDeadline));
}
function renderCountdown() {
  if (!countdown) return;
  const seconds = Math.max(0, Math.ceil((countdownDeadline - Date.now()) / 1000));
  const minutes = String(Math.floor(seconds / 60)).padStart(2, '0');
  const remaining = String(seconds % 60).padStart(2, '0');
  countdown.textContent = `${minutes}m ${remaining}s`;
}
renderCountdown();
window.setInterval(renderCountdown, 1000);

const tabData = {
  integration: ['STAY ON TOP OF IT', 'Seamless Integration', 'Centralize communication by automatically tracking every interaction and file across all platforms.', referenceAssets.feature1],
  productivity: ['BOOST TEAM PRODUCTIVITY', 'Boost Team Productivity', 'Enhance workflow efficiency by integrating task assignments and deadlines directly into your communication channels.', referenceAssets.feature2],
  pipeline: ['SEE THE BIGGER PICTURE', 'Visual Pipeline', 'Track each deal at a glance with a flexible pipeline that adapts to the way your team sells.', referenceAssets.capabilities],
  search: ['FIND IT FAST', 'Quick Search', 'Find every customer, task, document, and conversation with one fast, intelligent search.', referenceAssets.feature3]
};
const showcasePanel = document.querySelector('.showcase-panel');
const showcaseTabs = document.querySelector('.showcase-tabs');
const showcaseCopy = document.querySelector('.showcase-copy');
if (showcaseTabs && showcaseCopy) showcaseCopy.append(showcaseTabs);
let activeShowcaseTab = 'integration';
function setShowcaseTab(tabKey, animate = true) {
  const data = tabData[tabKey];
  if (!data) return;
  activeShowcaseTab = tabKey;
  document.querySelectorAll('[data-tab]').forEach((item) => item.classList.toggle('active', item.dataset.tab === tabKey));
  document.querySelector('[data-showcase-label]').textContent = data[0];
  document.querySelector('[data-showcase-title]').textContent = data[1];
  document.querySelector('[data-showcase-text]').textContent = data[2];
  if (animate && !reduceMotion) {
    [document.querySelector('[data-showcase-label]'), document.querySelector('[data-showcase-title]'), document.querySelector('[data-showcase-text]')]
      .filter(Boolean)
      .forEach((element, index) => {
        element.getAnimations().forEach((animation) => animation.cancel());
        element.animate(
          [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'translateY(0)' }],
          { duration: 400, delay: index * 35, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'both' }
        );
      });
  }
  const showcaseImage = document.querySelector('.showcase-reference-image');
  if (showcaseImage) {
    showcaseImage.src = asset(data[3]);
    showcaseImage.alt = `${data[1]} visual`;
    if (animate && !reduceMotion) {
      showcaseImage.animate([{ opacity: .25, transform: 'scale(.97)' }, { opacity: 1, transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
    }
  }
  document.querySelector('.showcase-brand-cover')?.toggleAttribute('hidden', data[3] !== referenceAssets.feature1);
  if (showcasePanel && animate && !reduceMotion) {
    showcasePanel.animate([{ opacity: .45, transform: 'translateY(8px)' }, { opacity: 1, transform: 'translateY(0)' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' });
  }
}
document.querySelectorAll('[data-tab]').forEach((button) => button.addEventListener('click', () => setShowcaseTab(button.dataset.tab)));
if (showcasePanel && !reduceMotion) {
  window.setInterval(() => {
    const keys = Object.keys(tabData);
    const nextIndex = (keys.indexOf(activeShowcaseTab) + 1) % keys.length;
    setShowcaseTab(keys[nextIndex]);
  }, 4400);
}

document.querySelector('form')?.addEventListener('submit', (event) => {
  event.preventDefault();
  const button = event.currentTarget.querySelector('button');
  const input = event.currentTarget.querySelector('input');
  button.textContent = 'You’re in ✓';
  input.value = '';
});

if (reduceMotion) {
  document.querySelectorAll('.reveal, [data-text-reveal]').forEach((element) => element.classList.add('visible'));
  document.querySelectorAll('.appear-motion').forEach((element) => element.classList.add('appear-visible'));
}
