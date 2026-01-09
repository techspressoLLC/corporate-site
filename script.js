function navigateTo(pageId) {
    document.querySelectorAll('.page-content').forEach(p => p.classList.remove('active'));
    const mobileMenu = document.getElementById('mobile-menu');
    if (mobileMenu) mobileMenu.classList.remove('active');
    const targetPage = document.getElementById('page-' + pageId);
    if (targetPage) {
        targetPage.classList.add('active');
        window.scrollTo(0, 0);
    }
}

window.addEventListener('scroll', () => {
    const header = document.getElementById('header');
    if (window.scrollY > 80) {
        header.classList.add('py-2');
        header.classList.remove('py-4');
    } else {
        header.classList.add('py-4');
        header.classList.remove('py-2');
    }
});

const menuToggle = document.getElementById('menu-toggle');
const mobileMenu = document.getElementById('mobile-menu');
if (menuToggle && mobileMenu) {
    menuToggle.addEventListener('click', () => {
        mobileMenu.classList.toggle('active');
    });
}

const NEWS_LIMIT = 10;
const NEWS_JSON_PATH = './news.json';

let newsItems = [];
let newsLoadFailed = false;
let revealObserver = null;
let newsReadyPromise = null;

const getNewsBadgeClasses = (category) => {
    const key = String(category || '').toUpperCase();
    switch (key) {
        case 'NEWS':
            return 'bg-amber-100 text-amber-800';
        case 'PRODUCT':
            return 'bg-cyan-100 text-cyan-800';
        case 'EVENT':
            return 'bg-purple-100 text-purple-800';
        case 'INFO':
            return 'bg-emerald-100 text-emerald-800';
        default:
            return 'bg-slate-100 text-slate-600';
    }
};

const getDateKey = (dateString) => {
    if (!dateString) return 0;
    return Number(String(dateString).replace(/\./g, '')) || 0;
};

const sortNewsItems = (items) => {
    return items.slice().sort((a, b) => {
        const pinnedDiff = Number(Boolean(b.pinned)) - Number(Boolean(a.pinned));
        if (pinnedDiff !== 0) return pinnedDiff;
        return getDateKey(b.date) - getDateKey(a.date);
    });
};

const setupRevealObserver = () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('active'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return observer;
};

const createNewsCard = (item) => {
    const link = document.createElement('a');
    const slug = item.slug ? encodeURIComponent(item.slug) : '';
    link.href = slug ? `#news/${slug}` : '#news';
    link.className = 'min-w-[300px] md:min-w-[400px] snap-center shrink-0 reveal block bg-white p-6 rounded-2xl group border border-slate-100 hover:shadow-xl transition duration-500 shadow-sm';

    const row = document.createElement('div');
    row.className = 'flex flex-col md:flex-row md:items-center gap-4';

    const date = document.createElement('span');
    date.className = 'text-[10px] font-en font-bold text-slate-400 w-24 tracking-widest text-left';
    date.textContent = item.date || '';

    const badge = document.createElement('span');
    badge.className = `${getNewsBadgeClasses(item.category)} text-[9px] font-bold px-3 py-1 rounded-full w-fit uppercase tracking-widest text-center`;
    badge.textContent = item.category || 'INFO';

    const title = document.createElement('p');
    title.className = 'flex-1 font-bold text-slate-700 group-hover:text-slate-900 transition';
    title.textContent = item.title || '';

    row.appendChild(date);
    row.appendChild(badge);
    row.appendChild(title);
    link.appendChild(row);

    return link;
};

const renderNewsList = () => {
    const container = document.getElementById('news-list');
    if (!container) return;

    container.textContent = '';

    if (newsLoadFailed) {
        const notice = document.createElement('p');
        notice.className = 'text-xs text-slate-400 tracking-wide';
        notice.textContent = 'Newsを読み込めませんでした。';
        container.appendChild(notice);
        return;
    }

    const sorted = sortNewsItems(newsItems).slice(0, NEWS_LIMIT);
    if (!sorted.length) {
        const empty = document.createElement('p');
        empty.className = 'text-xs text-slate-400 tracking-wide';
        empty.textContent = '現在お知らせはありません。';
        container.appendChild(empty);
        return;
    }

    sorted.forEach((item) => {
        const card = createNewsCard(item);
        container.appendChild(card);
        if (revealObserver) revealObserver.observe(card);
    });
};

const renderBodyBlocks = (body, container) => {
    let list = null;
    body.forEach((line) => {
        const text = String(line || '');
        if (text.startsWith('- ')) {
            if (!list) {
                list = document.createElement('ul');
                list.className = 'list-disc list-inside text-slate-600 text-sm md:text-base leading-loose';
                container.appendChild(list);
            }
            const item = document.createElement('li');
            item.textContent = text.slice(2);
            list.appendChild(item);
            return;
        }

        list = null;
        const paragraph = document.createElement('p');
        paragraph.className = 'text-slate-600 text-sm md:text-base leading-loose';
        paragraph.textContent = text;
        container.appendChild(paragraph);
    });
};

const renderNewsDetail = (slug) => {
    const container = document.getElementById('news-detail-content');
    if (!container) return;
    container.textContent = '';

    if (newsLoadFailed) {
        const notice = document.createElement('p');
        notice.className = 'text-sm text-slate-500';
        notice.textContent = 'Newsを読み込めませんでした。';
        container.appendChild(notice);
        return;
    }

    const item = newsItems.find(entry => entry.slug === slug);
    if (!item) {
        const title = document.createElement('h2');
        title.className = 'text-2xl font-black text-slate-900';
        title.textContent = '記事が見つかりません。';
        container.appendChild(title);

        const note = document.createElement('p');
        note.className = 'text-sm text-slate-500';
        note.textContent = '一覧へ戻って別の記事をご確認ください。';
        container.appendChild(note);
        return;
    }

    const headline = document.createElement('h1');
    headline.className = 'text-3xl md:text-5xl font-black text-slate-900 leading-tight';
    headline.textContent = item.title || '';
    container.appendChild(headline);

    const meta = document.createElement('div');
    meta.className = 'flex flex-wrap items-center gap-3';

    const date = document.createElement('span');
    date.className = 'text-[10px] font-en font-bold text-slate-400 tracking-widest';
    date.textContent = item.date || '';

    const badge = document.createElement('span');
    badge.className = `${getNewsBadgeClasses(item.category)} text-[9px] font-bold px-3 py-1 rounded-full w-fit uppercase tracking-widest text-center`;
    badge.textContent = item.category || 'INFO';

    meta.appendChild(date);
    meta.appendChild(badge);
    container.appendChild(meta);

    if (Array.isArray(item.tags) && item.tags.length) {
        const tagWrap = document.createElement('div');
        tagWrap.className = 'flex flex-wrap gap-2';
        item.tags.forEach((tag) => {
            const chip = document.createElement('span');
            chip.className = 'text-[9px] font-bold uppercase tracking-widest text-slate-500 border border-slate-200 rounded-full px-3 py-1';
            chip.textContent = tag;
            tagWrap.appendChild(chip);
        });
        container.appendChild(tagWrap);
    }

    if (item.cover) {
        const coverWrap = document.createElement('div');
        coverWrap.className = 'rounded-[2.5rem] overflow-hidden border border-slate-100 shadow-sm';
        const img = document.createElement('img');
        img.src = item.cover;
        img.alt = item.title || 'News cover';
        img.className = 'w-full h-auto object-cover';
        coverWrap.appendChild(img);
        container.appendChild(coverWrap);
    }

    if (Array.isArray(item.body)) {
        renderBodyBlocks(item.body, container);
    }

    if (item.externalUrl) {
        const link = document.createElement('a');
        link.href = item.externalUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.className = 'inline-flex items-center px-6 py-3 bg-slate-900 text-white rounded-full font-bold text-[10px] uppercase tracking-widest hover:bg-cyan-600 transition shadow-lg';
        link.textContent = 'Related Link';
        container.appendChild(link);
    }
};

const loadNews = async () => {
    try {
        const response = await fetch(NEWS_JSON_PATH, { cache: 'no-store' });
        if (!response.ok) throw new Error('Failed to load news.json');
        const data = await response.json();
        newsItems = Array.isArray(data.items) ? data.items : [];
        newsLoadFailed = false;
    } catch (error) {
        newsLoadFailed = true;
        newsItems = [];
    }
};

const showNewsList = () => {
    navigateTo('home');
    const section = document.getElementById('news');
    if (section) section.scrollIntoView({ behavior: 'smooth' });
};

const showNewsDetail = (slug) => {
    navigateTo('news-detail');
    renderNewsDetail(slug);
};

const handleHashRoute = async () => {
    if (newsReadyPromise) await newsReadyPromise;
    const hash = window.location.hash || '';

    if (hash.startsWith('#news/')) {
        const slug = decodeURIComponent(hash.slice(6));
        showNewsDetail(slug);
        return;
    }

    if (hash === '#news') {
        showNewsList();
    }
};

document.addEventListener('DOMContentLoaded', () => {
    revealObserver = setupRevealObserver();
    newsReadyPromise = loadNews().then(renderNewsList);
    handleHashRoute();

    window.addEventListener('hashchange', handleHashRoute);

    const backButton = document.getElementById('news-back');
    if (backButton) {
        backButton.addEventListener('click', () => {
            window.location.hash = '#news';
        });
    }
});
