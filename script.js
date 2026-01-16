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
let selectedCategory = 'ALL';
let selectedTag = 'ALL';

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
        case 'IMPORTANT':
            return 'bg-rose-100 text-rose-700';
        default:
            return 'bg-slate-100 text-slate-600';
    }
};

const normalizeFilterValue = (value) => String(value || '').toUpperCase();

const getCategoryValues = (category) => {
    if (Array.isArray(category)) return category.filter(Boolean);
    if (category) return [category];
    return [];
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

const applyFilters = (items) => {
    return items.filter((item) => {
        const categories = getCategoryValues(item.category).map(normalizeFilterValue);
        const categoryMatch = selectedCategory === 'ALL'
            || categories.includes(selectedCategory);
        const tagMatch = selectedTag === 'ALL'
            || (Array.isArray(item.tags)
                && item.tags.map(normalizeFilterValue).includes(selectedTag));
        return categoryMatch && tagMatch;
    });
};

const setupRevealObserver = () => {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => { if (entry.isIntersecting) entry.target.classList.add('active'); });
    }, { threshold: 0.1 });
    document.querySelectorAll('.reveal').forEach(el => observer.observe(el));
    return observer;
};

const createFilterButton = (label, type, value, isActive) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.filterType = type;
    button.dataset.filterValue = value;
    button.className = `text-[9px] font-bold uppercase tracking-widest px-3 py-1 rounded-full border transition ${isActive ? 'bg-slate-900 text-white border-slate-900' : 'border-slate-200 text-slate-600 hover:text-slate-900'}`;
    button.textContent = label;
    return button;
};

const renderFilters = () => {
    const categoryContainer = document.getElementById('news-filter-categories');
    const tagContainer = document.getElementById('news-filter-tags');
    if (!categoryContainer || !tagContainer) return;

    const categories = Array.from(new Set(
        newsItems.flatMap(item => getCategoryValues(item.category)).filter(Boolean)
    ));
    const tags = Array.from(new Set(
        newsItems.flatMap(item => Array.isArray(item.tags) ? item.tags : []).filter(Boolean)
    ));

    categoryContainer.textContent = '';
    tagContainer.textContent = '';

    categoryContainer.appendChild(createFilterButton('ALL', 'category', 'ALL', selectedCategory === 'ALL'));
    categories.forEach((category) => {
        const key = normalizeFilterValue(category);
        categoryContainer.appendChild(createFilterButton(category, 'category', key, selectedCategory === key));
    });

    tagContainer.appendChild(createFilterButton('ALL', 'tag', 'ALL', selectedTag === 'ALL'));
    tags.forEach((tag) => {
        const key = normalizeFilterValue(tag);
        tagContainer.appendChild(createFilterButton(tag, 'tag', key, selectedTag === key));
    });
};

const createNewsCard = (item) => {
    const link = document.createElement('a');
    const slug = item.slug ? encodeURIComponent(item.slug) : '';
    link.href = slug ? `#news/${slug}` : '#news';
    link.className = 'min-w-[300px] md:min-w-[400px] snap-center shrink-0 reveal block bg-white p-6 rounded-2xl group border border-slate-100 hover:shadow-xl transition duration-500 shadow-sm relative';

    const row = document.createElement('div');
    row.className = 'flex flex-col md:flex-row md:items-center gap-4';

    const date = document.createElement('span');
    date.className = 'text-[10px] font-en font-bold text-slate-400 w-24 tracking-widest text-left';
    date.textContent = item.date || '';

    const badgeWrap = document.createElement('div');
    badgeWrap.className = 'flex flex-wrap items-center gap-2';
    const categories = getCategoryValues(item.category);
    categories.forEach((category) => {
        const badge = document.createElement('button');
        badge.type = 'button';
        badge.dataset.filterType = 'category';
        badge.dataset.filterValue = normalizeFilterValue(category);
        badge.className = `${getNewsBadgeClasses(category)} text-[9px] font-bold px-3 py-1 rounded-full w-fit uppercase tracking-widest text-center`;
        badge.textContent = category || 'INFO';
        badgeWrap.appendChild(badge);
    });

    const title = document.createElement('p');
    title.className = 'flex-1 font-bold text-slate-700 group-hover:text-slate-900 transition';
    title.textContent = item.title || '';

    row.appendChild(date);
    if (badgeWrap.childNodes.length) row.appendChild(badgeWrap);
    row.appendChild(title);
    link.appendChild(row);

    if (item.pinned) {
        const pinnedBadge = document.createElement('div');
        pinnedBadge.className = 'absolute top-4 right-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-slate-600';
        pinnedBadge.innerHTML = `
            <svg class="w-5 h-5 text-slate-500" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M16 3l-2 2 4 4-2 2-4-4-2 2-4 10 10-4 2-2-4-4 2-2-4-4z"></path>
            </svg>
            <span>Pinned</span>
        `;
        link.appendChild(pinnedBadge);
    }

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

    const sorted = sortNewsItems(newsItems);
    const filtered = applyFilters(sorted).slice(0, NEWS_LIMIT);
    if (!filtered.length) {
        const empty = document.createElement('p');
        empty.className = 'text-xs text-slate-400 tracking-wide';
        empty.textContent = '条件に一致するNewsがありません。';
        container.appendChild(empty);

        const reset = document.createElement('button');
        reset.type = 'button';
        reset.dataset.filterType = 'clear';
        reset.className = 'mt-4 text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 transition';
        reset.textContent = 'Clear Filters';
        container.appendChild(reset);
        return;
    }

    filtered.forEach((item) => {
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

        const backLink = document.createElement('a');
        backLink.href = '#news';
        backLink.className = 'inline-flex items-center text-xs font-bold uppercase tracking-widest text-slate-500 hover:text-slate-900 transition';
        backLink.textContent = 'Back to News';
        container.appendChild(backLink);
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

    const badgeWrap = document.createElement('div');
    badgeWrap.className = 'flex flex-wrap items-center gap-2';
    const categories = getCategoryValues(item.category);
    categories.forEach((category) => {
        const badge = document.createElement('button');
        badge.type = 'button';
        badge.dataset.filterType = 'category';
        badge.dataset.filterValue = normalizeFilterValue(category);
        badge.className = `${getNewsBadgeClasses(category)} text-[9px] font-bold px-3 py-1 rounded-full w-fit uppercase tracking-widest text-center`;
        badge.textContent = category || 'INFO';
        badgeWrap.appendChild(badge);
    });

    meta.appendChild(date);
    if (badgeWrap.childNodes.length) meta.appendChild(badgeWrap);
    if (item.pinned) {
        const pinnedBadge = document.createElement('span');
        pinnedBadge.className = 'text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-full bg-slate-100 text-slate-600';
        pinnedBadge.textContent = 'Pinned';
        meta.appendChild(pinnedBadge);
    }
    container.appendChild(meta);

    if (Array.isArray(item.tags) && item.tags.length) {
        const tagWrap = document.createElement('div');
        tagWrap.className = 'flex flex-wrap gap-2';
        item.tags.forEach((tag) => {
            const chip = document.createElement('button');
            chip.type = 'button';
            chip.dataset.filterType = 'tag';
            chip.dataset.filterValue = normalizeFilterValue(tag);
            chip.className = 'text-[9px] font-bold uppercase tracking-widest text-slate-500 border border-slate-200 rounded-full px-3 py-1 hover:text-slate-900 transition';
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

const resetFilters = () => {
    selectedCategory = 'ALL';
    selectedTag = 'ALL';
    renderFilters();
    renderNewsList();
};

const applyFilterSelection = (type, value) => {
    if (type === 'category') selectedCategory = value;
    if (type === 'tag') selectedTag = value;
    renderFilters();
    renderNewsList();

    if (window.location.hash.startsWith('#news/')) {
        window.location.hash = '#news';
    } else {
        showNewsList();
    }
};

const handleFilterClick = (event) => {
    const target = event.target.closest('[data-filter-type]');
    if (!target) return;

    const type = target.dataset.filterType;
    if (!type) return;

    event.preventDefault();
    event.stopPropagation();

    if (type === 'clear') {
        resetFilters();
        return;
    }

    const value = target.dataset.filterValue;
    if (!value) return;
    applyFilterSelection(type, value);
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
    newsReadyPromise = loadNews().then(() => {
        renderFilters();
        renderNewsList();
    });
    handleHashRoute();

    window.addEventListener('hashchange', handleHashRoute);
    document.addEventListener('click', handleFilterClick);

    const backButton = document.getElementById('news-back');
    if (backButton) {
        backButton.addEventListener('click', () => {
            window.location.hash = '#news';
        });
    }

    const crowdfundingBar = document.getElementById('crowdfunding-bar');
    const hideCrowdfunding = document.getElementById('crowdfunding-hide');
    const showCrowdfunding = document.getElementById('crowdfunding-show');
    if (crowdfundingBar && hideCrowdfunding && showCrowdfunding) {
        hideCrowdfunding.addEventListener('click', () => {
            crowdfundingBar.classList.add('hidden');
            showCrowdfunding.classList.remove('hidden');
            showCrowdfunding.classList.add('flex');
        });
        showCrowdfunding.addEventListener('click', () => {
            crowdfundingBar.classList.remove('hidden');
            showCrowdfunding.classList.add('hidden');
            showCrowdfunding.classList.remove('flex');
        });
    }
});
