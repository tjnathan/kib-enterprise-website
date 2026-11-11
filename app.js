/* ═══════════════════════════════════════════════════════════
   KIB Enterprise Entertainment — catalogue app
   Live data: TMDB v3 API (same key as the KiB Cards system)
   Pricing: K15 movies, K25 series. Orders via WhatsApp.
   ═══════════════════════════════════════════════════════════ */

const API_KEY  = "efd5a0dc2e09999970b5ba318c2b4e8e";
const API      = "https://api.themoviedb.org/3";
const IMG      = "https://image.tmdb.org/t/p";
const WHATSAPP = "260969870360";

const PRICE = { movie: "K15", tv: "K25" };

const $  = (id) => document.getElementById(id);
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls)  n.className = cls;
  if (html !== undefined) n.innerHTML = html;
  return n;
};

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ── API helpers ─────────────────────────────────────── */
async function tmdb(path, params = {}) {
  const url = new URL(API + path);
  url.searchParams.set("api_key", API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const r = await fetch(url);
  if (!r.ok) throw new Error(`TMDB ${r.status}`);
  return r.json();
}

const titleOf = (item) => item.title || item.name || "";
const yearOf  = (item) => (item.release_date || item.first_air_date || "").slice(0, 4);
const typeOf  = (item) => item.media_type || (item.title ? "movie" : "tv");

function waLink(item) {
  const kind = typeOf(item) === "tv" ? "series" : "movie";
  const msg  = `Hi KIB Enterprise! I'd like the ${kind} "${titleOf(item)}" (${yearOf(item)}) on flash drive. Is it available?`;
  return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(msg)}`;
}

/* ── Poster card ─────────────────────────────────────── */
function card(item) {
  const c = el("div", "card");
  const poster = el("div", "poster");
  if (item.poster_path) {
    const img = new Image();
    img.loading = "lazy";
    img.alt = titleOf(item);
    img.src = `${IMG}/w342${item.poster_path}`;
    img.onload = () => img.classList.add("loaded");
    poster.appendChild(img);
  } else {
    poster.appendChild(el("div", "no-art", '<i class="ph ph-film-slate"></i>'));
  }
  c.appendChild(poster);
  c.appendChild(el("div", "card-title", titleOf(item)));

  const meta = el("div", "card-meta");
  if (yearOf(item)) meta.appendChild(el("span", "", yearOf(item)));
  if (item.vote_average) {
    meta.appendChild(el("span", "star",
      `<i class="ph-fill ph-star"></i>${item.vote_average.toFixed(1)}`));
  }
  c.appendChild(meta);

  c.addEventListener("click", () => openModal(item));
  return c;
}

function fillSkeletons(container, n) {
  container.innerHTML = "";
  for (let i = 0; i < n; i++) {
    const s = el("div", "card");
    s.appendChild(el("div", "skel"));
    container.appendChild(s);
  }
}

function renderInto(container, items, append = false) {
  if (!append) container.innerHTML = "";
  items.filter(i => i.poster_path || i.backdrop_path)
       .forEach(i => container.appendChild(card(i)));
}

function renderError(container, retryFn) {
  container.innerHTML = "";
  const msg = el("p", "state-msg",
    "Couldn't load titles. Check your connection. ");
  const retry = el("button", "btn-ghost", "Retry");
  retry.style.height = "38px";
  retry.addEventListener("click", retryFn);
  msg.appendChild(retry);
  container.appendChild(msg);
}

/* ── HERO (rotating featured) ────────────────────────── */
let heroItems = [], heroIdx = 0, heroTimer = null;

function metaChips(target, parts) {
  target.innerHTML = "";
  parts.filter(Boolean).forEach(p => {
    const chip = el("span", "chip" + (p.rate ? " rate" : ""), p.rate
      ? `<i class="ph-fill ph-star"></i> ${p.text}` : p.text);
    target.appendChild(chip);
  });
}

function showHero(i) {
  const item = heroItems[i];
  if (!item) return;
  heroIdx = i;
  const bd = $("heroBackdrop");
  const swap = () => {
    bd.style.backgroundImage = `url(${IMG}/original${item.backdrop_path})`;
    bd.classList.remove("fading");
  };
  if (reducedMotion) swap();
  else { bd.classList.add("fading"); setTimeout(swap, 350); }

  $("heroTitle").textContent = titleOf(item);
  metaChips($("heroMeta"), [
    { text: yearOf(item) },
    { text: typeOf(item) === "tv" ? "Series" : "Movie" },
    item.vote_average ? { text: item.vote_average.toFixed(1), rate: true } : null,
  ]);
  $("heroOverview").textContent = item.overview || "";
  $("heroOrder").href = waLink(item);
  $("heroDetails").onclick = () => openModal(item);

  [...$("heroDots").children].forEach((d, j) => d.classList.toggle("active", j === i));
}

function startHero(items) {
  heroItems = items.filter(i => i.backdrop_path).slice(0, 5);
  const dots = $("heroDots");
  dots.innerHTML = "";
  heroItems.forEach((_, i) => {
    const b = el("button");
    b.setAttribute("aria-label", `Featured title ${i + 1}`);
    b.addEventListener("click", () => { showHero(i); restartHeroTimer(); });
    dots.appendChild(b);
  });
  showHero(0);
  restartHeroTimer();
}

function restartHeroTimer() {
  if (heroTimer) clearInterval(heroTimer);
  if (reducedMotion || heroItems.length < 2) return;
  heroTimer = setInterval(() => showHero((heroIdx + 1) % heroItems.length), 8000);
}

/* ── DETAIL MODAL ────────────────────────────────────── */
async function openModal(item) {
  const type = typeOf(item);
  $("modal").hidden = false;
  document.body.style.overflow = "hidden";

  $("modalTitle").textContent = titleOf(item);
  $("modalOverview").textContent = item.overview || "";
  $("modalPoster").src = item.poster_path ? `${IMG}/w342${item.poster_path}` : "";
  $("modalHero").style.backgroundImage =
    item.backdrop_path ? `url(${IMG}/w1280${item.backdrop_path})` : "none";
  $("modalGenres").innerHTML = "";
  $("modalCast").innerHTML = "";
  $("modalTrailer").hidden = true;
  $("modalPrice").textContent = PRICE[type];
  $("modalOrder").href = waLink(item);
  metaChips($("modalMeta"), [
    { text: yearOf(item) },
    { text: type === "tv" ? "Series" : "Movie" },
    item.vote_average ? { text: item.vote_average.toFixed(1), rate: true } : null,
  ]);

  try {
    const d = await tmdb(`/${type}/${item.id}`, { append_to_response: "credits,videos" });

    const chips = [
      { text: yearOf(item) },
      type === "tv"
        ? { text: `${d.number_of_seasons} Season${d.number_of_seasons > 1 ? "s" : ""}` }
        : d.runtime ? { text: `${Math.floor(d.runtime / 60)}h ${d.runtime % 60}m` } : null,
      d.vote_average ? { text: d.vote_average.toFixed(1), rate: true } : null,
    ];
    if (type === "tv") {
      chips.push({ text: ["Returning Series", "In Production"].includes(d.status) ? "Ongoing" : "Completed" });
    }
    metaChips($("modalMeta"), chips);

    (d.genres || []).slice(0, 4).forEach(g =>
      $("modalGenres").appendChild(el("span", "gchip", g.name)));

    if (d.overview) $("modalOverview").textContent = d.overview;

    const cast = (d.credits?.cast || []).filter(c => c.profile_path).slice(0, 6);
    cast.forEach(c => {
      const box = el("div", "cast");
      box.innerHTML =
        `<img loading="lazy" src="${IMG}/w185${c.profile_path}" alt="${c.name}"><span>${c.name}</span>`;
      $("modalCast").appendChild(box);
    });

    const trailer = (d.videos?.results || [])
      .find(v => v.site === "YouTube" && v.type === "Trailer") ||
      (d.videos?.results || []).find(v => v.site === "YouTube");
    if (trailer) {
      $("modalTrailer").href = `https://www.youtube.com/watch?v=${trailer.key}`;
      $("modalTrailer").hidden = false;
    }
  } catch (e) { /* base info already shown */ }
}

function closeModal() {
  $("modal").hidden = true;
  document.body.style.overflow = "";
}
$("modalClose").addEventListener("click", closeModal);
$("modalBackdrop").addEventListener("click", closeModal);
document.addEventListener("keydown", e => {
  if (e.key === "Escape") { closeModal(); closeSearch(); }
});

/* ── SEARCH ──────────────────────────────────────────── */
let searchTimer = null;

function closeSearch() {
  $("searchOverlay").hidden = true;
  $("searchInput").value = "";
}
$("searchClose").addEventListener("click", closeSearch);

$("searchInput").addEventListener("input", (e) => {
  clearTimeout(searchTimer);
  const q = e.target.value.trim();
  if (q.length < 2) { $("searchOverlay").hidden = true; return; }
  searchTimer = setTimeout(async () => {
    $("searchOverlay").hidden = false;
    $("searchTitle").textContent = `Results for "${q}"`;
    $("searchEmpty").hidden = true;
    fillSkeletons($("searchGrid"), 8);
    try {
      const d = await tmdb("/search/multi", { query: q });
      const items = (d.results || []).filter(r =>
        (r.media_type === "movie" || r.media_type === "tv") && r.poster_path);
      renderInto($("searchGrid"), items);
      $("searchEmpty").hidden = items.length > 0;
    } catch {
      renderError($("searchGrid"), () => $("searchInput").dispatchEvent(new Event("input")));
    }
  }, 380);
});

/* ── GENRE BROWSE ────────────────────────────────────── */
const genreState = { type: "movie", genre: null, page: 1, lists: { movie: [], tv: [] } };

async function loadGenreChips() {
  const [m, t] = await Promise.all([
    tmdb("/genre/movie/list"), tmdb("/genre/tv/list"),
  ]);
  genreState.lists.movie = m.genres || [];
  genreState.lists.tv    = t.genres || [];
  renderGenreChips();
}

function renderGenreChips() {
  const wrap = $("genreChips");
  wrap.innerHTML = "";
  const list = genreState.lists[genreState.type];
  if (!genreState.genre && list.length) genreState.genre = list[0].id;
  list.forEach(g => {
    const b = el("button", "gchip" + (g.id === genreState.genre ? " active" : ""), g.name);
    b.addEventListener("click", () => {
      genreState.genre = g.id; genreState.page = 1;
      renderGenreChips(); loadGenreGrid();
    });
    wrap.appendChild(b);
  });
}

async function loadGenreGrid(append = false) {
  const grid = $("gridGenre");
  if (!append) fillSkeletons(grid, 7);
  try {
    const d = await tmdb(`/discover/${genreState.type}`, {
      with_genres: genreState.genre,
      sort_by: "popularity.desc",
      page: genreState.page,
      "vote_count.gte": 50,
    });
    renderInto(grid, (d.results || []).slice(0, 14), append);
  } catch { renderError(grid, () => loadGenreGrid()); }
}

document.querySelectorAll("[data-gtype]").forEach(b =>
  b.addEventListener("click", () => {
    document.querySelectorAll("[data-gtype]").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    genreState.type = b.dataset.gtype;
    genreState.genre = null; genreState.page = 1;
    renderGenreChips(); loadGenreGrid();
  }));

$("genreMore").addEventListener("click", () => {
  genreState.page += 1; loadGenreGrid(true);
});

/* ── TIME MACHINE ────────────────────────────────────── */
const DECADES = ["1970s", "1980s", "1990s", "2000s", "2010s"];
const timeState = { type: "movie", decade: "1990s", page: 1 };

function decadeRange(label) {
  const start = parseInt(label);
  return [`${start}-01-01`, `${start + 9}-12-31`];
}

function renderDecadeChips() {
  const wrap = $("decadeChips");
  wrap.innerHTML = "";
  DECADES.forEach(d => {
    const b = el("button", "gchip" + (d === timeState.decade ? " active" : ""), d);
    b.addEventListener("click", () => {
      timeState.decade = d; timeState.page = 1;
      renderDecadeChips(); loadTimeGrid();
    });
    wrap.appendChild(b);
  });
}

async function loadTimeGrid(append = false) {
  const grid = $("gridTime");
  if (!append) fillSkeletons(grid, 7);
  const [from, to] = decadeRange(timeState.decade);
  const isMovie = timeState.type === "movie";
  const params = {
    sort_by: "vote_count.desc",
    page: timeState.page,
    "vote_count.gte": isMovie ? 500 : 100,
  };
  if (isMovie) {
    params["primary_release_date.gte"] = from;
    params["primary_release_date.lte"] = to;
  } else {
    params["first_air_date.gte"] = from;
    params["first_air_date.lte"] = to;
  }
  try {
    const d = await tmdb(`/discover/${timeState.type}`, params);
    renderInto(grid, (d.results || []).slice(0, 14), append);
  } catch { renderError(grid, () => loadTimeGrid()); }
}

document.querySelectorAll("[data-ttype]").forEach(b =>
  b.addEventListener("click", () => {
    document.querySelectorAll("[data-ttype]").forEach(x => x.classList.remove("active"));
    b.classList.add("active");
    timeState.type = b.dataset.ttype; timeState.page = 1;
    loadTimeGrid();
  }));

$("timeMore").addEventListener("click", () => {
  timeState.page += 1; loadTimeGrid(true);
});

/* ── BOOT ────────────────────────────────────────────── */
async function boot() {
  fillSkeletons($("railCinema"), 8);
  fillSkeletons($("railTV"), 8);
  fillSkeletons($("gridTrending"), 7);
  fillSkeletons($("gridGenre"), 7);
  fillSkeletons($("gridTime"), 7);
  renderDecadeChips();

  // Hero + trending
  tmdb("/trending/all/week").then(d => {
    const items = (d.results || []).filter(r => r.media_type !== "person");
    startHero(items);
    renderInto($("gridTrending"), items.slice(0, 14));
  }).catch(() => {
    renderError($("gridTrending"), boot);
    $("heroTitle").textContent = "KIB Enterprise Entertainment";
    $("heroOverview").textContent =
      "Movies and series on flash drives and hard drives. Connect to the internet to browse the live catalogue.";
  });

  // What's new rails
  tmdb("/movie/now_playing", { region: "US" })
    .then(d => renderInto($("railCinema"), (d.results || []).slice(0, 16)))
    .catch(() => renderError($("railCinema"), boot));
  tmdb("/tv/on_the_air")
    .then(d => renderInto($("railTV"), (d.results || []).slice(0, 16)))
    .catch(() => renderError($("railTV"), boot));

  // Genres + time machine
  loadGenreChips().then(() => loadGenreGrid()).catch(() => {});
  loadTimeGrid();
}

boot();
