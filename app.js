// POZYSK RM: codzienne telefony do właścicieli z ogłoszeń, kolumny jak w arkuszu „Pozysk Klienta, Generał, Codziennie”
// Dane w bazie Zadań RM (Supabase, to samo logowanie). Bez config.js albo z ?proba: tryb próbny w tej przeglądarce.
// Listy do wybierania (i agenci) są w bazie, każdy wpis „Inne” dopisuje się do listy sam.
const WERSJA = 'v1';

// kolumny arkusza, tytuły bez zmian
const KOLUMNY = [['nr', 'LP'], ['nieruchomosc', 'NIERUCHOMOŚĆ'], ['rynek', 'WTÓRNY/ PIERWOTNY'], ['transakcja', 'SPRZEDAŻ/ WYNAJEM'],
  ['lokalizacja', 'LOKALIZACJA'], ['cena', 'CENA KLIENTA'], ['osoba', 'OSOBA DO KONTAKTU'], ['telefon', 'TELEFON'],
  ['pierwszy_telefon', 'PIERWSZY TELEFON'], ['agent', 'AGENT'], ['status', 'STATUS POZYSKU'], ['powod', 'POWÓD ZAMKNIĘCIA / REZYGNACJI'],
  ['dalsze', 'DALSZE DZIAŁANIA / REKOMENDACJE'], ['uwagi', 'UWAGI'], ['link', 'LINK DO OGŁOSZENIA']];
const NAGL = Object.fromEntries(KOLUMNY);
const LISTY = ['nieruchomosc', 'rynek', 'transakcja', 'lokalizacja', 'agent', 'status', 'powod', 'dalsze'];
const START_LISTY = {
  nieruchomosc: ['Kawalerka', '2 pokoje', '3 pokoje', '4 pokoje', 'Mieszkanie powyżej 70 m²', 'Dom', 'Lokal', 'Działka', 'Pensjonat'],
  rynek: ['Wtórny', 'Pierwotny'],
  transakcja: ['Sprzedaż', 'Wynajem'],
  lokalizacja: ['Elbląg', 'Okolice Elbląga', 'Malbork', 'Pasłęk', 'Braniewo', 'Frombork', 'Krynica Morska', 'Nowy Dwór Gdański', 'Gdańsk', 'Pruszcz Gdański', 'Iława', 'Ostróda', 'Morąg'],
  agent: [['Rafał', 'menedżer'], ['Dawid', 'agent']],
  status: ['Nieodebrany telefon', 'Rozmowa odbyta', 'Umówione spotkanie', 'Podpisana umowa', 'Zamknięty, nieaktualne'],
  powod: ['Niezainteresowany współpracą', 'Sprzedana nieruchomość', 'Wynajęta nieruchomość', 'Działa na umowie otwartej', 'Działa na umowie na wyłączność', 'Rezygnacja, zachowanie klienta', 'Chce sprzedawać sam'],
  dalsze: ['Ponowić kontakt', 'Przekonać do wyłączności', 'Oddzwonić w innym terminie', 'Wysłać przypomnienie', 'Zamknięcie kontaktu']
};
const ROLE = ['agent', 'koordynatorka', 'menedżer'];
const TERMINY = [['Jutro', 1], ['Za 3 dni', 3], ['Za tydzień', 7], ['Za 2 tygodnie', 14], ['Za miesiąc', 30]];
const MIESIACE = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
const NA_RAZ = 40; // tyle kart w grupie, reszta pod „pokaż więcej”

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (t) => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const pad = (n) => String(n).padStart(2, '0');
const isoDzien = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const dzis = () => isoDzien(new Date());
const plusDni = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoDzien(d); };
const dataPL = (iso) => { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-'); return `${d}.${m}.${y}`; };
const dataKrotko = (iso) => { if (!iso) return ''; const [y, m, d] = String(iso).slice(0, 10).split('-'); return y === dzis().slice(0, 4) ? `${d}.${m}` : `${d}.${m}.${y}`; };
const norm = (t) => String(t ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l').replace(/\s+/g, ' ').trim();
const klucz = (t) => norm(t).replace(/[^a-z0-9]/g, '');
const cyfry = (t) => String(t ?? '').replace(/\D/g, '');
const liczba = (t) => { const n = Number(String(t ?? '').replace(/[\s zł]/g, '').replace(',', '.')); return String(t ?? '').trim() && Number.isFinite(n) ? Math.round(n * 100) / 100 : null; };
const cenaTxt = (n) => n == null || n === '' ? '' : Number(n).toLocaleString('pl-PL') + ' zł';
const duza = (t) => { t = String(t || '').trim().replace(/\s+/g, ' '); return t ? t[0].toUpperCase() + t.slice(1) : ''; };

function toast(t, ms = 2600) {
  const el = $('#toast'); el.textContent = t; el.hidden = false;
  clearTimeout(toast.t); toast.t = setTimeout(() => { el.hidden = true; }, ms);
}

// telefon: 9 cyfr = numer polski, dzwonimy z +48
function telHref(t) { let c = cyfry(t); if (c.length === 9) c = '48' + c; return c.length >= 9 ? 'tel:+' + c : ''; }
function telTxt(t) {
  const c = cyfry(t);
  if (c.length === 9) return c.replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  if (c.length === 11 && c.startsWith('48')) return '+48 ' + c.slice(2).replace(/(\d{3})(\d{3})(\d{3})/, '$1 $2 $3');
  return String(t ?? '');
}
// link zawsze klikalny: bez http dopisujemy https, inne protokoły odrzucamy
function linkUrl(l) {
  l = String(l || '').trim(); if (!l) return '';
  if (!/^https?:\/\//i.test(l)) l = 'https://' + l;
  try { const u = new URL(l); return /^https?:$/.test(u.protocol) && u.hostname.includes('.') ? u.href : ''; } catch (e) { return ''; }
}
const PORTALE = [['otodom', 'Otodom'], ['olx', 'OLX'], ['adresowo', 'Adresowo'], ['gratka', 'Gratka'], ['nieruchomosci-online', 'Nieruchomości-online'],
  ['morizon', 'Morizon'], ['domiporta', 'Domiporta'], ['sprzedajemy', 'Sprzedajemy'], ['portel', 'Portel'], ['facebook', 'Facebook'], ['allegro', 'Allegro'], ['trojmiasto', 'Trojmiasto.pl']];
function portal(l) {
  const u = linkUrl(l); if (!u) return '';
  const h = new URL(u).hostname.replace(/^www\./, '');
  return (PORTALE.find(([k]) => h.includes(k)) || [, h])[1];
}
const linkKlucz = (l) => { const u = linkUrl(l); if (!u) return ''; const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname).replace(/\/$/, '').toLowerCase(); };

// stany kontaktu
const zamkniety = (r) => /^(podpisana|zamkni)/.test(norm(r.status)) || /^zamkni/.test(norm(r.dalsze));
const nieodebrany = (r) => /^nie ?odebr/.test(norm(r.status));
const spotkanie = (r) => /spotkani/.test(norm(r.status));
function stKlasa(s) {
  const n = norm(s);
  if (!n) return 'nowy';
  if (/^nie ?odebr/.test(n)) return 'nieodebr';
  if (/spotkani/.test(n)) return 'spotk';
  if (/^podpisana/.test(n)) return 'umowa';
  if (/^zamkni/.test(n)) return 'zamk';
  return '';
}
const stBadge = (s) => `<span class="st ${stKlasa(s)}">${esc(s || 'Nowy, bez telefonu')}</span>`;

// ===================== MAGAZYN DANYCH =====================
function magazynSupabase(cfg) {
  const sb = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseKey, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false }
  });
  const blad = (e) => { if (e) throw new Error(e.message || String(e)); };
  let user = null;
  async function profil() {
    const { data, error } = await sb.from('profile').select('*').eq('id', user.id).maybeSingle(); blad(error);
    if (!data || !data.aktywny) throw new Error('To konto nie jest aktywne w zespole RM.');
    return data;
  }
  return {
    demo: false,
    async init() { const { data } = await sb.auth.getSession(); user = data.session?.user || null; return user ? { user, profil: await profil() } : null; },
    async zaloguj(email, haslo) {
      const { data, error } = await sb.auth.signInWithPassword({ email: email.trim().toLowerCase(), password: haslo });
      if (error) throw new Error(/invalid/i.test(error.message) ? 'Zły e-mail albo hasło' : error.message);
      user = data.user; return { user, profil: await profil() };
    },
    async wyloguj() { await sb.auth.signOut(); },
    // baza oddaje maks. 1000 wierszy naraz, więc czytamy stronami
    async rekordy() {
      let wszystko = [];
      for (let od = 0; ; od += 1000) {
        const { data, error } = await sb.from('pozysk').select('*').order('nr', { ascending: false }).range(od, od + 999); blad(error);
        wszystko = wszystko.concat(data); if (data.length < 1000) break;
      }
      return wszystko;
    },
    async dodaj(r) { const { data, error } = await sb.from('pozysk').insert(r).select().single(); blad(error); return data; },
    async dodajWiele(lista) { for (let i = 0; i < lista.length; i += 200) { const { error } = await sb.from('pozysk').insert(lista.slice(i, i + 200)); blad(error); } },
    async zmien(id, zm) { const { error } = await sb.from('pozysk').update({ ...zm, zmieniono: new Date().toISOString() }).eq('id', id); blad(error); },
    async usun(id) { const { error } = await sb.from('pozysk').delete().eq('id', id); blad(error); },
    async listy() { const { data, error } = await sb.from('pozysk_listy').select('*').order('kolejnosc').order('wartosc'); blad(error); return data; },
    async dodajListe(p) { const { data, error } = await sb.from('pozysk_listy').insert(p).select().single(); blad(error); return data; },
    async zmienListe(id, zm) { const { error } = await sb.from('pozysk_listy').update(zm).eq('id', id); blad(error); },
    async usunListe(id) { const { error } = await sb.from('pozysk_listy').delete().eq('id', id); blad(error); },
    nasluchuj(fn) {
      let t; const odpal = () => { clearTimeout(t); t = setTimeout(fn, 600); };
      sb.channel('rm-pozysk')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pozysk' }, odpal)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pozysk_listy' }, odpal)
        .subscribe();
    }
  };
}

function magazynProbny() {
  const czytaj = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch (e) { return d; } };
  const pisz = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { toast('Pamięć przeglądarki pełna, tryb próbny nie zapisał'); } };
  const user = { id: 'ja', email: 'tryb próbny' };
  const ja = { id: 'ja', imie: 'Rafał (próba)', rola: 'admin', aktywny: true };
  const id = () => 'x' + Date.now() + Math.random().toString(36).slice(2, 7);
  if (!czytaj('pz-proba-listy', null)) {
    const l = [];
    for (const pole of LISTY) START_LISTY[pole].forEach((w, i) => l.push({ id: id(), pole, wartosc: Array.isArray(w) ? w[0] : w, rola: Array.isArray(w) ? w[1] : '', kolejnosc: i + 1 }));
    pisz('pz-proba-listy', l);
  }
  const R = () => czytaj('pz-proba-rekordy', []), L = () => czytaj('pz-proba-listy', []);
  const nastepnyNr = () => R().reduce((m, r) => Math.max(m, r.nr || 0), 0) + 1;
  const nowy = (r, nr) => ({ nieruchomosc: '', rynek: '', transakcja: '', lokalizacja: '', cena: null, osoba: '', telefon: '', pierwszy_telefon: null, agent: '', status: '', powod: '', dalsze: '', uwagi: '', link: '', nastepny_kontakt: null, ostatni_kontakt: null, proby: 0, historia: [], ...r, id: id(), nr, utworzono: new Date().toISOString(), zmieniono: new Date().toISOString(), dodal: 'ja' });
  return {
    demo: true,
    async init() { return { user, profil: ja }; },
    async zaloguj() { return { user, profil: ja }; },
    async wyloguj() {},
    async rekordy() { return R().sort((a, b) => b.nr - a.nr); },
    async dodaj(r) { const n = nowy(r, nastepnyNr()); pisz('pz-proba-rekordy', [...R(), n]); return n; },
    async dodajWiele(lista) { let nr = nastepnyNr(); pisz('pz-proba-rekordy', [...R(), ...lista.map(r => nowy(r, nr++))]); },
    async zmien(rid, zm) { pisz('pz-proba-rekordy', R().map(r => r.id === rid ? { ...r, ...zm, zmieniono: new Date().toISOString() } : r)); },
    async usun(rid) { pisz('pz-proba-rekordy', R().filter(r => r.id !== rid)); },
    async listy() { return L().sort((a, b) => a.kolejnosc - b.kolejnosc || a.wartosc.localeCompare(b.wartosc, 'pl')); },
    async dodajListe(p) { const n = { kolejnosc: 100, rola: '', ...p, id: id() }; pisz('pz-proba-listy', [...L(), n]); return n; },
    async zmienListe(lid, zm) { pisz('pz-proba-listy', L().map(x => x.id === lid ? { ...x, ...zm } : x)); },
    async usunListe(lid) { pisz('pz-proba-listy', L().filter(x => x.id !== lid)); },
    nasluchuj() {}
  };
}

const cfg = window.RM_CONFIG || {};
const DB = (cfg.supabaseUrl && !/[?&]proba/.test(location.search)) ? magazynSupabase(cfg) : magazynProbny();

// ===================== STAN =====================
const pamiec = (k, d) => { try { return localStorage.getItem(k) ?? d; } catch (e) { return d; } };
const zapamietaj = (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} };
const S = {
  user: null, profil: null, admin: false, rekordy: [], listy: [],
  dzKto: pamiec('pz-kto', ''), dzWiecej: {},
  w: { q: '', status: 'otwarte', agent: '', ile: 200 },
  okres: 'tydzien', otwarty: null, doUsuniecia: null
};
const opcje = (pole) => S.listy.filter(x => x.pole === pole).map(x => x.wartosc);
const ja = () => duza(String(S.profil?.imie || '').split(/\s+/)[0].replace(/\(.*$/, ''));
// agent z listy, który odpowiada zalogowanej osobie (po imieniu)
const mojAgent = () => opcje('agent').find(a => klucz(a.split(/\s+/)[0]) === klucz(ja())) || '';
const doZadzwonienia = (r) => !zamkniety(r) && (!r.status || (r.nastepny_kontakt && r.nastepny_kontakt <= dzis()) || (nieodebrany(r) && !r.nastepny_kontakt));

// ===================== START =====================
async function start() {
  $$('[data-wersja]').forEach(el => el.textContent = WERSJA);
  if (DB.demo) { const b = $('#banner'); b.hidden = false; b.textContent = 'Tryb próbny: dane zostają tylko w tej przeglądarce.'; }
  try { const s = await DB.init(); if (s) await poZalogowaniu(s); else pokazLogowanie(); }
  catch (e) { pokazLogowanie(); $('#log-blad').textContent = e.message; }
}
function pokazLogowanie() {
  $$('.screen').forEach(el => el.hidden = true); $('#tabs').hidden = true; $('#btn-wyloguj').hidden = true;
  $('#ekran-logowanie').hidden = false;
}
$('#form-logowanie').addEventListener('submit', async (e) => {
  e.preventDefault(); $('#log-blad').textContent = '';
  try { await poZalogowaniu(await DB.zaloguj($('#log-email').value, $('#log-haslo').value)); }
  catch (err) { $('#log-blad').textContent = err.message; }
});
$('#btn-wyloguj').addEventListener('click', async () => { await DB.wyloguj(); location.reload(); });

async function poZalogowaniu({ user, profil }) {
  S.user = user; S.profil = profil; S.admin = profil.rola === 'admin';
  $('#ekran-logowanie').hidden = true; $('#tabs').hidden = false; $('#btn-wyloguj').hidden = false;
  await odswiez();
  if (!S.dzKto) S.dzKto = mojAgent() && !S.admin ? 'moje' : 'wszyscy';
  pokazZakladke('dzwonie');
  DB.nasluchuj(() => odswiez());
  document.addEventListener('visibilitychange', () => { if (!document.hidden) odswiez(); });
}

async function odswiez() {
  try {
    const [rekordy, listy] = await Promise.all([DB.rekordy(), DB.listy()]);
    S.rekordy = rekordy; S.listy = listy;
    rysuj();
  } catch (e) { toast('Nie udało się wczytać: ' + e.message, 5000); }
}
function rysuj() {
  const n = S.rekordy.filter(r => doZadzwonienia(r) && widzeWDzwonie(r)).length;
  $('#tab-ile').textContent = n ? n : '';
  if (!$('#arkusz').hidden) return; // nie przerywamy pisania w karcie
  if (zakladka === 'dzwonie') rysujDzwonie();
  if (zakladka === 'wszystkie') rysujWszystkie();
  if (zakladka === 'wyniki') rysujWyniki();
  if (zakladka === 'listy') rysujListy();
}

// ===================== ZAKŁADKI =====================
let zakladka = 'dzwonie';
function pokazZakladke(t) {
  zakladka = t;
  $$('#tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === t));
  $$('.screen').forEach(el => el.hidden = true);
  $('#ekran-' + t).hidden = false;
  rysuj();
  window.scrollTo(0, 0);
}
$('#tabs').addEventListener('click', (e) => { const b = e.target.closest('button[data-tab]'); if (b) pokazZakladke(b.dataset.tab); });
document.addEventListener('click', (e) => { if (e.target.closest('[data-akcja="nowy"]')) otworzFormularz(null); });

// ===================== DZWONIĘ =====================
const widzeWDzwonie = (r) => S.dzKto !== 'moje' || !r.agent || klucz(r.agent) === klucz(mojAgent());

function kartaKontaktu(r) {
  const tytul = [r.nieruchomosc, r.lokalizacja].filter(Boolean).join(' · ') || 'Kontakt';
  const sub = [r.osoba, r.transakcja, r.rynek, r.agent ? '👤 ' + r.agent : ''].filter(Boolean).map(esc).join(' · ');
  const termin = r.nastepny_kontakt ? (r.nastepny_kontakt < dzis() ? `⚠️ miał być ${dataKrotko(r.nastepny_kontakt)}` : r.nastepny_kontakt === dzis() ? '📅 dziś' : '📅 ' + dataKrotko(r.nastepny_kontakt)) : '';
  const ostatni = r.ostatni_kontakt ? `ost. ${dataKrotko(r.ostatni_kontakt)}${r.proby > 1 ? ` (${r.proby}×)` : ''}` : '';
  const tel = telHref(r.telefon), url = linkUrl(r.link);
  return `<div class="kontakt${r.nastepny_kontakt && r.nastepny_kontakt < dzis() ? ' zaleglo' : ''}">
    <div class="k-gora"><span class="k-tytul">${esc(tytul)}</span><span class="k-cena">${cenaTxt(r.cena)}</span></div>
    <div class="k-sub">${sub}</div>
    <div class="k-sub">${stBadge(r.status)} ${r.dalsze ? esc(r.dalsze) : ''} ${termin} <span class="muted">${ostatni}</span></div>
    ${r.uwagi ? `<div class="k-uwagi">${esc(r.uwagi)}</div>` : ''}
    <div class="k-akcje">
      ${tel ? `<a class="btn-tel" href="${tel}" data-zadzwon="${r.id}">📞 ${esc(telTxt(r.telefon))}</a>` : '<a class="btn-ogl brak">brak numeru</a>'}
      ${url ? `<a class="btn-ogl" href="${esc(url)}" target="_blank" rel="noopener">🔗 ${esc(portal(r.link))}</a>` : '<a class="btn-ogl brak">brak linku</a>'}
      <button class="btn-wynik" data-wynik="${r.id}">✍️ Wynik</button>
    </div>
  </div>`;
}

function rysujDzwonie() {
  const moj = mojAgent();
  $('#dz-kto').innerHTML = `<button class="chip chip-mala${S.dzKto === 'moje' ? ' on' : ''}" data-kto="moje" ${moj ? '' : 'disabled title="Dopisz siebie w Listy > AGENT"'}>👤 Moje${moj ? ' (' + esc(moj) + ')' : ''}</button>
    <button class="chip chip-mala${S.dzKto !== 'moje' ? ' on' : ''}" data-kto="wszyscy">👥 Cały zespół</button>`;
  const L = S.rekordy.filter(r => !zamkniety(r) && widzeWDzwonie(r));
  const poTerminie = (a, b) => (a.nastepny_kontakt || '').localeCompare(b.nastepny_kontakt || '');
  const najdawniej = (a, b) => (a.ostatni_kontakt || '').localeCompare(b.ostatni_kontakt || '');
  const grupy = [
    ['dzis', '🔥 Na dziś i zaległe', 'termin kolejnego telefonu minął albo jest dziś', L.filter(r => r.status && r.nastepny_kontakt && r.nastepny_kontakt <= dzis()).sort(poTerminie), true, true],
    ['nowe', '🆕 Nowe, jeszcze nie dzwoniliśmy', 'świeżo dodane z ogłoszeń', L.filter(r => !r.status).sort((a, b) => b.nr - a.nr), true, true],
    ['nieodebr', '📵 Nie odebrali, dzwonić do skutku', 'bez ustalonego terminu', L.filter(r => nieodebrany(r) && !r.nastepny_kontakt).sort(najdawniej), true, true],
    ['spotk', '🤝 Umówione spotkania', '', L.filter(r => spotkanie(r)).sort(poTerminie), true, false],
    ['ponow', '🔁 Do ponowienia, bez terminu', 'najdawniej rozmawiani na górze', L.filter(r => r.status && !r.nastepny_kontakt && !nieodebrany(r) && !spotkanie(r)).sort(najdawniej), false, false],
    ['potem', '⏳ Zaplanowane na później', '', L.filter(r => r.status && r.nastepny_kontakt > dzis() && !spotkanie(r)).sort(poTerminie), false, false]
  ];
  const dzisN = grupy[0][3].length + grupy[1][3].length + grupy[2][3].length;
  $('#dz-lista').innerHTML = (dzisN ? '' : '<div class="pusto">🎉 Na dziś wszystko obdzwonione. Dodaj nowe kontakty z ogłoszeń przyciskiem u góry.</div>')
    + grupy.filter(g => g[3].length).map(([id, tytul, opis, lista, otwarta, pilne]) => {
      const ile = S.dzWiecej[id] || NA_RAZ;
      return `<details class="grupa${pilne ? ' pilne' : ''}" data-grupa="${id}" ${pamiec('pz-g-' + id, otwarta ? '1' : '0') === '1' ? 'open' : ''}>
        <summary>${tytul}<span class="grupa-ile">${lista.length}</span></summary>
        ${opis ? `<div class="grupa-opis">${opis}</div>` : ''}
        ${lista.slice(0, ile).map(kartaKontaktu).join('')}
        ${lista.length > ile ? `<div class="wiecej"><button class="link" data-wiecej="${id}">Pokaż kolejne (${lista.length - ile})</button></div>` : ''}
      </details>`;
    }).join('');
}
$('#dz-kto').addEventListener('click', (e) => { const b = e.target.closest('[data-kto]'); if (!b || b.disabled) return; S.dzKto = b.dataset.kto; zapamietaj('pz-kto', S.dzKto); rysuj(); });
$('#dz-lista').addEventListener('toggle', (e) => { const d = e.target.closest('details[data-grupa]'); if (d) zapamietaj('pz-g-' + d.dataset.grupa, d.open ? '1' : '0'); }, true);

// klik w numer: telefon dzwoni, a karta wyniku od razu czeka na wpis po rozmowie
document.addEventListener('click', (e) => {
  const z = e.target.closest('[data-zadzwon]');
  if (z) { const id = z.dataset.zadzwon; setTimeout(() => otworzWynik(id), 700); return; }
  const w = e.target.closest('[data-wynik]'); if (w) { otworzWynik(w.dataset.wynik); return; }
  const m = e.target.closest('[data-wiecej]'); if (m) { S.dzWiecej[m.dataset.wiecej] = (S.dzWiecej[m.dataset.wiecej] || NA_RAZ) + 100; rysuj(); }
});

// ===================== WSZYSTKIE (arkusz) =====================
const naKomputerze = () => matchMedia('(min-width: 900px)').matches;
function filtrujWszystkie() {
  const q = norm(S.w.q), qc = cyfry(S.w.q);
  return S.rekordy.filter(r => {
    if (S.w.status === 'otwarte' && zamkniety(r)) return false;
    if (S.w.status === 'zamkniete' && !zamkniety(r)) return false;
    if (!['otwarte', 'zamkniete', ''].includes(S.w.status) && klucz(r.status) !== klucz(S.w.status)) return false;
    if (S.w.agent && klucz(r.agent) !== klucz(S.w.agent)) return false;
    if (!q) return true;
    if (qc.length >= 3 && cyfry(r.telefon).includes(qc)) return true;
    if (/^\d+$/.test(q) && String(r.nr) === q) return true;
    return norm([r.nieruchomosc, r.lokalizacja, r.osoba, r.agent, r.status, r.powod, r.dalsze, r.uwagi, r.link].join(' ')).includes(q);
  });
}
// miesiąc pierwszego telefonu (jak wiersze STYCZEŃ, LUTY… w arkuszu)
const miesiacRek = (r) => (r.pierwszy_telefon || r.utworzono || '').slice(0, 7);
const miesiacTxt = (ym) => ym ? `${MIESIACE[+ym.slice(5, 7) - 1]} ${ym.slice(0, 4)}` : 'bez daty';

function rysujWszystkie() {
  const st = [['otwarte', 'Otwarte'], ['', 'Wszystkie'], ...opcje('status').map(s => [s, s]), ['zamkniete', 'Zamknięte']];
  $('#w-filtry').innerHTML = st.map(([v, t]) => `<button class="chip chip-mala${S.w.status === v ? ' on' : ''}" data-wst="${esc(v)}">${esc(t)}</button>`).join('')
    + '<span class="filtr-sep"></span>'
    + ['', ...opcje('agent')].map(a => `<button class="chip chip-mala${S.w.agent === a ? ' on' : ''}" data-wag="${esc(a)}">${a ? '👤 ' + esc(a) : 'Każdy agent'}</button>`).join('');
  const lista = filtrujWszystkie().sort((a, b) => miesiacRek(b).localeCompare(miesiacRek(a)) || b.nr - a.nr);
  const pokaz = lista.slice(0, S.w.ile);
  let html = `<div class="licznik-wyn"><span>Kontaktów: <b>${lista.length}</b> z ${S.rekordy.length}</span><button class="link" data-csv>⬇️ Pobierz do Excela (CSV)</button></div>`;
  let mies = null;
  if (naKomputerze()) {
    html += `<div class="tabela-box"><table class="arkusz-t"><thead><tr>${KOLUMNY.map(([, t]) => `<th>${t}</th>`).join('')}</tr></thead><tbody>`;
    for (const r of pokaz) {
      const m = miesiacRek(r);
      if (m !== mies) { mies = m; html += `<tr class="mies"><td colspan="${KOLUMNY.length}">${miesiacTxt(m)}</td></tr>`; }
      const url = linkUrl(r.link), tel = telHref(r.telefon);
      html += `<tr class="wiersz" data-edytuj="${r.id}">
        <td>${r.nr}</td><td>${esc(r.nieruchomosc)}</td><td>${esc(r.rynek)}</td><td>${esc(r.transakcja)}</td><td>${esc(r.lokalizacja)}</td>
        <td class="nw">${cenaTxt(r.cena)}</td><td>${esc(r.osoba)}</td>
        <td class="nw">${tel ? `<a class="tel" href="${tel}">${esc(telTxt(r.telefon))}</a>` : esc(r.telefon)}</td>
        <td class="nw">${dataPL(r.pierwszy_telefon)}</td><td>${esc(r.agent)}</td><td>${stBadge(r.status)}</td><td>${esc(r.powod)}</td>
        <td>${esc(r.dalsze)}${r.nastepny_kontakt ? `<br><span class="muted">📅 ${dataPL(r.nastepny_kontakt)}</span>` : ''}</td>
        <td class="uw"><div class="uw-c" title="${esc(r.uwagi)}">${esc(r.uwagi)}</div></td>
        <td class="nw">${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">🔗 ${esc(portal(r.link))}</a>` : '<span class="muted">brak</span>'}</td>
      </tr>`;
    }
    html += '</tbody></table></div>';
  } else {
    for (const r of pokaz) {
      const m = miesiacRek(r);
      if (m !== mies) { mies = m; html += `<div class="mies-tytul">${miesiacTxt(m)}</div>`; }
      const url = linkUrl(r.link), tel = telHref(r.telefon);
      html += `<div class="wiersz-m" data-edytuj="${r.id}">
        <div class="l1">${r.nr}. ${esc([r.nieruchomosc, r.lokalizacja].filter(Boolean).join(' · '))} <span class="k-cena">${cenaTxt(r.cena)}</span></div>
        <div class="l2">${esc(r.osoba)} ${tel ? `<a class="tel" href="${tel}">📞 ${esc(telTxt(r.telefon))}</a>` : ''} ${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">🔗 ${esc(portal(r.link))}</a>` : ''}</div>
        <div class="l3">${stBadge(r.status)} ${[esc(r.powod), r.agent ? '👤 ' + esc(r.agent) : '', dataPL(r.pierwszy_telefon)].filter(Boolean).join(' · ')}</div>
      </div>`;
    }
  }
  if (!lista.length) html += '<div class="pusto">Nic nie pasuje do filtrów.</div>';
  if (lista.length > S.w.ile) html += `<div class="wiecej"><button class="link" data-w-wiecej>Pokaż kolejne (${lista.length - S.w.ile})</button></div>`;
  $('#w-lista').innerHTML = html;
}
$('#w-szukaj').addEventListener('input', (e) => { S.w.q = e.target.value; S.w.ile = 200; rysujWszystkie(); });
$('#w-filtry').addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.wst !== undefined) S.w.status = b.dataset.wst;
  if (b.dataset.wag !== undefined) S.w.agent = b.dataset.wag;
  S.w.ile = 200; rysujWszystkie();
});
$('#w-lista').addEventListener('click', (e) => {
  if (e.target.closest('a')) return;
  if (e.target.closest('[data-csv]')) { pobierzCsv(); return; }
  if (e.target.closest('[data-w-wiecej]')) { S.w.ile += 300; rysujWszystkie(); return; }
  const w = e.target.closest('[data-edytuj]'); if (w) otworzFormularz(w.dataset.edytuj);
});
let szer = naKomputerze();
addEventListener('resize', () => { if (naKomputerze() !== szer) { szer = naKomputerze(); if (zakladka === 'wszystkie') rysujWszystkie(); } });

function pobierzCsv() {
  const pole = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const wiersze = [[...KOLUMNY.map(([, t]) => t), 'NASTĘPNY KONTAKT'].map(pole).join(';')];
  for (const r of filtrujWszystkie().sort((a, b) => a.nr - b.nr)) {
    wiersze.push([r.nr, r.nieruchomosc, r.rynek, r.transakcja, r.lokalizacja, r.cena ?? '', r.osoba, telTxt(r.telefon), dataPL(r.pierwszy_telefon),
      r.agent, r.status, r.powod, r.dalsze, r.uwagi, linkUrl(r.link) || r.link, dataPL(r.nastepny_kontakt)].map(pole).join(';'));
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + wiersze.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  a.download = `Pozysk-RM-${dzis()}.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

// ===================== WYNIKI =====================
function poczatekOkresu(o) {
  const d = new Date(); d.setHours(0, 0, 0, 0);
  if (o === 'dzis') return isoDzien(d);
  if (o === 'tydzien') { d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return isoDzien(d); }
  if (o === 'miesiac') return isoDzien(d).slice(0, 8) + '01';
  if (o === 'poprz') { d.setDate(1); d.setMonth(d.getMonth() - 1); return isoDzien(d); }
  return '0000';
}
function rysujWyniki() {
  const OK = [['dzis', 'Dziś'], ['tydzien', 'Ten tydzień'], ['miesiac', 'Ten miesiąc'], ['poprz', 'Poprzedni miesiąc'], ['wszystko', 'Od początku']];
  $('#wy-okres').innerHTML = OK.map(([v, t]) => `<button class="chip chip-mala${S.okres === v ? ' on' : ''}" data-okres="${v}">${t}</button>`).join('');
  const od = poczatekOkresu(S.okres), doD = S.okres === 'poprz' ? poczatekOkresu('miesiac') : '9999';
  const wOkresie = (iso) => iso && iso.slice(0, 10) >= od && iso.slice(0, 10) < doD;
  // każdy zapis rozmowy to jeden telefon; liczymy po osobie, która dzwoniła
  const tel = [];
  for (const r of S.rekordy) for (const h of (r.historia || [])) if (wOkresie(h.k)) tel.push({ ...h, kto: h.o || r.agent || '?' });
  const nowe = S.rekordy.filter(r => wOkresie(r.pierwszy_telefon || r.utworzono));
  const odebr = (h) => h.s && !/^nie ?odebr/.test(norm(h.s));
  const ile = (l, f) => l.filter(f).length;
  const sp = (h) => /spotkani/.test(norm(h.s)), um = (h) => /^podpisana/.test(norm(h.s));
  const osoby = [...new Set([...tel.map(h => h.kto), ...nowe.map(r => r.agent).filter(Boolean)])].sort((a, b) => a.localeCompare(b, 'pl'));
  const otwarte = S.rekordy.filter(r => !zamkniety(r));
  const wgStatusu = {}; otwarte.forEach(r => { const k = r.status || 'Nowy, bez telefonu'; wgStatusu[k] = (wgStatusu[k] || 0) + 1; });
  const maxS = Math.max(1, ...Object.values(wgStatusu));
  const wgPowodu = {}; S.rekordy.filter(r => r.powod && wOkresie(r.ostatni_kontakt || r.pierwszy_telefon)).forEach(r => { wgPowodu[r.powod] = (wgPowodu[r.powod] || 0) + 1; });
  const maxP = Math.max(1, ...Object.values(wgPowodu));
  const proc = (a, b) => b ? Math.round(a / b * 100) + '%' : '–';
  $('#wy-tresc').innerHTML = `
    <div class="kafle">
      <div class="kafel"><b>${tel.length}</b><span>telefonów</span></div>
      <div class="kafel"><b>${ile(tel, odebr)}</b><span>rozmów (${proc(ile(tel, odebr), tel.length)})</span></div>
      <div class="kafel"><b>${ile(tel, sp)}</b><span>spotkań</span></div>
      <div class="kafel"><b>${ile(tel, um)}</b><span>umów</span></div>
    </div>
    <div class="card"><div class="card-title">Kto ile zrobił</div>
      ${osoby.length ? `<table class="wyn"><thead><tr><th>Osoba</th><th>Nowe</th><th>Telefony</th><th>Rozmowy</th><th>Spotkania</th><th>Umowy</th></tr></thead><tbody>
        ${osoby.map(o => { const t = tel.filter(h => h.kto === o); return `<tr><td>${esc(o)}</td><td>${nowe.filter(r => r.agent === o).length}</td><td><b>${t.length}</b></td><td>${ile(t, odebr)}</td><td>${ile(t, sp)}</td><td>${ile(t, um)}</td></tr>`; }).join('')}
      </tbody></table>` : '<div class="muted">W tym okresie nic jeszcze nie zapisano.</div>'}
      <div class="small muted" style="margin-top:8px">Nowe = kontakty z pierwszym telefonem w tym okresie (wg AGENT). Telefony = zapisane wyniki rozmów (wg osoby, która zapisała).</div>
    </div>
    <div class="card"><div class="card-title">Otwarte kontakty teraz (${otwarte.length})</div>
      ${Object.entries(wgStatusu).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<div class="slupek"><span>${stBadge(k === 'Nowy, bez telefonu' ? '' : k)}</span><i style="width:${Math.round(n / maxS * 40)}%"></i><b>${n}</b></div>`).join('') || '<div class="muted">Brak</div>'}
    </div>
    <div class="card"><div class="card-title">${NAGL.powod} (w okresie)</div>
      ${Object.entries(wgPowodu).sort((a, b) => b[1] - a[1]).map(([k, n]) => `<div class="slupek"><span>${esc(k)}</span><i style="width:${Math.round(n / maxP * 40)}%"></i><b>${n}</b></div>`).join('') || '<div class="muted">Brak w tym okresie</div>'}
    </div>`;
}
$('#wy-okres').addEventListener('click', (e) => { const b = e.target.closest('[data-okres]'); if (b) { S.okres = b.dataset.okres; rysujWyniki(); } });

// ===================== LISTY (opcje do wybierania, agenci, import) =====================
function rysujListy() {
  const karta = (pole) => {
    const poz = S.listy.filter(x => x.pole === pole);
    const agent = pole === 'agent';
    return `<div class="card"><div class="card-title">${NAGL[pole]}${agent ? ' <span class="small muted">(agenci i koordynatorka)</span>' : ''}</div>
      <div class="chips">${poz.map(x => `<span class="lista-poz">${esc(x.wartosc)}
        ${agent ? `<select data-rola="${x.id}">${ROLE.map(r => `<option${x.rola === r ? ' selected' : ''}>${r}</option>`).join('')}</select>` : ''}
        <button data-usun-l="${x.id}" class="${S.doUsuniecia === x.id ? 'potw' : ''}" aria-label="Usuń">${S.doUsuniecia === x.id ? 'usunąć?' : '✕'}</button></span>`).join('') || '<span class="muted small">pusto</span>'}</div>
      <form class="dodaj-wiersz" data-dodaj-l="${pole}">
        <input type="text" maxlength="60" placeholder="${agent ? 'Imię nowej osoby' : 'Dopisz nową opcję'}" autocomplete="off">
        ${agent ? `<select>${ROLE.map(r => `<option>${r}</option>`).join('')}</select>` : ''}
        <button class="btn btn-main" type="submit">Dodaj</button>
      </form></div>`;
  };
  $('#li-tresc').innerHTML = `<p class="small muted">To są opcje do klikania w karcie kontaktu. Gdy ktoś wpisze w karcie „Inne”, nowa opcja dopisze się tu sama.</p>`
    + ['agent', 'status', 'powod', 'dalsze', 'nieruchomosc', 'lokalizacja', 'rynek', 'transakcja'].map(karta).join('')
    + (S.admin ? `<div class="card"><div class="card-title">📥 Wczytaj kontakty z Excela</div>
      <p class="small muted">Plik „Pozysk Klienta, Generał, Codziennie” (.xlsx). Kolumny jak w arkuszu, wiersze z nazwą miesiąca ustawiają datę. Kontakty, które już są w aplikacji (ten sam telefon albo link), są pomijane, więc można wczytać ponownie bez dubli.</p>
      <label>Rok pierwszego wiersza w arkuszu <input type="text" id="imp-rok" inputmode="numeric" maxlength="4" value="2025"></label>
      <input type="file" id="imp-plik" accept=".xlsx,.xlsm,.xls">
      <div id="imp-wynik" class="small" style="margin-top:8px">${S.impWynik || ''}</div></div>` : '');
}
$('#li-tresc').addEventListener('click', async (e) => {
  const b = e.target.closest('[data-usun-l]'); if (!b) return;
  if (S.doUsuniecia !== b.dataset.usunL) { S.doUsuniecia = b.dataset.usunL; rysujListy(); return; }
  try { await DB.usunListe(b.dataset.usunL); S.doUsuniecia = null; toast('Usunięte z listy (kontakty z tą wartością zostają)', 3500); await odswiez(); }
  catch (err) { toast('Nie udało się: ' + err.message, 5000); }
});
$('#li-tresc').addEventListener('change', async (e) => {
  if (e.target.dataset.rola) {
    try { await DB.zmienListe(e.target.dataset.rola, { rola: e.target.value }); toast('Rola zmieniona'); await odswiez(); } catch (err) { toast('Nie udało się: ' + err.message, 5000); }
  }
  if (e.target.id === 'imp-plik' && e.target.files[0]) importuj(e.target.files[0], +$('#imp-rok').value || new Date().getFullYear());
});
$('#li-tresc').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target.closest('[data-dodaj-l]'); if (!f) return;
  const pole = f.dataset.dodajL, w = duza($('input', f).value);
  if (!w) { $('input', f).focus(); return; }
  if (opcje(pole).some(o => klucz(o) === klucz(w))) { toast('Ta opcja już jest na liście'); return; }
  try {
    await DB.dodajListe({ pole, wartosc: w, rola: pole === 'agent' ? $('select', f).value : '', kolejnosc: S.listy.filter(x => x.pole === pole).length + 1 });
    toast(`Dodane: ${w}`); await odswiez();
  } catch (err) { toast('Nie udało się: ' + err.message, 5000); }
});

// dopisuje do listy wartości wpisane ręcznie („Inne”), żeby następnym razem były do kliknięcia
async function dopiszDoList(zm) {
  for (const pole of LISTY) {
    const v = zm[pole];
    if (v && !opcje(pole).some(o => klucz(o) === klucz(v))) {
      try { const n = await DB.dodajListe({ pole, wartosc: v, rola: pole === 'agent' ? 'agent' : '', kolejnosc: S.listy.filter(x => x.pole === pole).length + 1 }); S.listy.push(n); } catch (e) {}
    }
  }
}

// ===================== ARKUSZ: wybór chipami z opcją „Inne” =====================
function grupa(pole, v, inne = true) {
  const op = opcje(pole);
  const lista = v && !op.some(o => klucz(o) === klucz(v)) ? [...op, v] : op;
  return `<div class="cg" data-pole="${pole}" data-v="${esc(v || '')}">
    ${lista.map(o => `<button type="button" class="chip${v && klucz(o) === klucz(v) ? ' on' : ''}" data-v="${esc(o)}">${esc(o)}</button>`).join('')}
    ${inne ? `<button type="button" class="chip chip-plus" data-inne>✏️ Inne</button><input type="text" class="cg-inne" maxlength="60" placeholder="wpisz swoje" hidden>` : ''}
  </div>`;
}
const wartosc = (pole) => { const el = $(`#arkusz .cg[data-pole="${pole}"]`); if (!el) return ''; const i = $('.cg-inne', el); return i && !i.hidden && i.value.trim() ? duza(i.value) : (el.dataset.v || ''); };
function ustaw(pole, v) {
  const el = $(`#arkusz .cg[data-pole="${pole}"]`); if (!el) return;
  el.dataset.v = v || '';
  $$('.chip[data-v]', el).forEach(c => c.classList.toggle('on', !!v && klucz(c.dataset.v) === klucz(v)));
  const i = $('.cg-inne', el); if (i) { i.hidden = true; i.value = ''; }
}
function terminBox(v) {
  return `<div class="termin-box">${TERMINY.map(([t, n]) => `<button type="button" class="chip chip-mala${v === plusDni(n) ? ' on' : ''}" data-termin="${plusDni(n)}">${t}</button>`).join('')}
    <input type="date" id="a-termin" value="${esc(v || '')}"> <button type="button" class="link" data-termin="">bez terminu</button></div>`;
}
const ustawTermin = (v) => { $('#a-termin').value = v || ''; $$('#arkusz [data-termin]').forEach(c => c.classList.toggle('on', !!v && c.dataset.termin === v)); };

// podpowiedzi po wybraniu statusu, żeby agent klikał jak najmniej
function poStatusie(s) {
  const n = norm(s);
  if (/^nie ?odebr/.test(n)) { if (!wartosc('dalsze')) ustaw('dalsze', 'Ponowić kontakt'); if (!$('#a-termin').value) ustawTermin(plusDni(1)); }
  if (/^podpisana/.test(n)) { ustaw('dalsze', ''); ustawTermin(''); }
  if (/^zamkni/.test(n)) { ustaw('dalsze', opcje('dalsze').find(d => /^zamkni/.test(norm(d))) || ''); ustawTermin(''); }
  if (/spotkani/.test(n) && !$('#a-termin').value) { ustawTermin(plusDni(1)); toast('Ustaw dzień spotkania, godzinę dopisz w notatce', 3500); }
}
function poDalszych(d) {
  const n = norm(d);
  if (/^zamkni/.test(n)) ustawTermin('');
  else if (/oddzwonic|ponowic|przypomnienie|przekonac/.test(n) && !$('#a-termin').value) ustawTermin(plusDni(/ponowic/.test(n) ? 7 : 3));
}

function otworzArkusz(nr, html) {
  $('#ark-nr').textContent = nr; $('#ark-tresc').innerHTML = html;
  $('#tlo').hidden = false; $('#arkusz').hidden = false; $('#arkusz').scrollTop = 0;
  document.body.style.overflow = 'hidden';
}
function zamknijArkusz() {
  $('#tlo').hidden = true; $('#arkusz').hidden = true; S.otwarty = null; S.doUsuniecia = null;
  document.body.style.overflow = ''; rysuj();
}
$('#ark-zamknij').addEventListener('click', zamknijArkusz);
$('#tlo').addEventListener('click', zamknijArkusz);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !$('#arkusz').hidden) zamknijArkusz(); });

const historiaHtml = (r) => (r.historia || []).length ? `<div class="pole-t">HISTORIA TELEFONÓW</div><ul class="historia">${[...r.historia].reverse().slice(0, 15).map(h =>
  `<li><b>${dataPL(h.k)}</b> ${esc(h.o || '')}: ${esc([h.s, h.p, h.d].filter(Boolean).join(', ') || 'zapis')}${h.t ? ` · następny ${dataPL(h.t)}` : ''}${h.n ? `<br>${esc(h.n)}` : ''}</li>`).join('')}</ul>` : '';

// ----- szybki wynik rozmowy -----
function otworzWynik(id) {
  const r = S.rekordy.find(x => x.id === id); if (!r) return;
  S.otwarty = { id, tryb: 'wynik' };
  const tel = telHref(r.telefon), url = linkUrl(r.link);
  otworzArkusz(`LP ${r.nr} · wynik rozmowy`, `<form id="f-wynik">
    <div class="ark-nazwa">${esc([r.nieruchomosc, r.lokalizacja].filter(Boolean).join(' · ') || 'Kontakt')} <span class="k-cena">${cenaTxt(r.cena)}</span></div>
    <div class="ark-sub">${esc([r.osoba, r.transakcja, r.agent ? '👤 ' + r.agent : ''].filter(Boolean).join(' · '))} ${r.status ? '· teraz: ' + stBadge(r.status) : ''}</div>
    <div class="ark-akcje">
      ${tel ? `<a class="btn-tel" href="${tel}">📞 ${esc(telTxt(r.telefon))}</a>` : '<a class="btn-ogl brak">brak numeru</a>'}
      ${url ? `<a class="btn-ogl" href="${esc(url)}" target="_blank" rel="noopener">🔗 ${esc(portal(r.link))}</a>` : '<a class="btn-ogl brak">brak linku</a>'}
    </div>
    ${r.uwagi ? `<div class="k-uwagi">${esc(r.uwagi)}</div>` : ''}
    <div class="pole-t">${NAGL.status}</div>${grupa('status', '')}
    <div class="pole-t">${NAGL.powod}</div>${grupa('powod', r.powod)}
    <div class="pole-t">${NAGL.dalsze}</div>${grupa('dalsze', '')}
    <div class="pole-t">KIEDY ZADZWONIĆ ZNOWU</div>${terminBox('')}
    <label class="pole-t">NOTATKA Z ROZMOWY (dopisze się do UWAG)<textarea id="a-notatka" maxlength="500" placeholder="np. sprzedaje sam do końca miesiąca, potem pomyśli"></textarea></label>
    <div class="zapisz-dol"><button class="btn btn-main btn-big" type="submit" style="margin:0">💾 Zapisz rozmowę</button>
    <div style="text-align:center;margin-top:8px"><button type="button" class="link" data-akcja="edytuj-dane">✏️ Popraw dane kontaktu</button></div></div>
    ${historiaHtml(r)}
  </form>`);
}

// ----- pełna karta: nowy kontakt albo edycja -----
function otworzFormularz(id) {
  const r = id ? S.rekordy.find(x => x.id === id) : null;
  if (id && !r) return;
  S.otwarty = { id, tryb: 'dane' };
  const d = r || { agent: mojAgent(), rynek: 'Wtórny', transakcja: 'Sprzedaż' };
  otworzArkusz(r ? `LP ${r.nr}` : 'Nowy kontakt', `<form id="f-dane" autocomplete="off">
    <label>${NAGL.link}<input type="url" id="f-link" inputmode="url" placeholder="wklej link z Otodom, OLX, Adresowo…" value="${esc(d.link || '')}"></label>
    <div id="f-dubel"></div>
    ${r && linkUrl(r.link) ? `<div style="margin:-4px 0 6px"><a href="${esc(linkUrl(r.link))}" target="_blank" rel="noopener" class="link">🔗 Otwórz ogłoszenie (${esc(portal(r.link))})</a></div>` : ''}
    <div class="pole-t">${NAGL.nieruchomosc}</div>${grupa('nieruchomosc', d.nieruchomosc)}
    <div class="grid2"><div><div class="pole-t">${NAGL.rynek}</div>${grupa('rynek', d.rynek, false)}</div>
      <div><div class="pole-t">${NAGL.transakcja}</div>${grupa('transakcja', d.transakcja, false)}</div></div>
    <div class="pole-t">${NAGL.lokalizacja}</div>${grupa('lokalizacja', d.lokalizacja)}
    <div class="grid2" style="margin-top:14px">
      <label>${NAGL.cena}<input type="text" id="f-cena" inputmode="decimal" placeholder="np. 359000" value="${d.cena ?? ''}"></label>
      <label>${NAGL.osoba}<input type="text" id="f-osoba" maxlength="80" placeholder="imię" value="${esc(d.osoba || '')}"></label>
      <label>${NAGL.telefon}<input type="tel" id="f-telefon" inputmode="tel" maxlength="30" placeholder="600 000 000" value="${esc(telTxt(d.telefon || ''))}"></label>
      <label>${NAGL.pierwszy_telefon}<input type="date" id="f-pierwszy" value="${esc(d.pierwszy_telefon || '')}"></label>
    </div>
    <div class="pole-t" style="margin-top:4px">${NAGL.agent}</div>${grupa('agent', d.agent)}
    <div class="pole-t">${NAGL.status}</div>${grupa('status', d.status)}
    <div class="pole-t">${NAGL.powod}</div>${grupa('powod', d.powod)}
    <div class="pole-t">${NAGL.dalsze}</div>${grupa('dalsze', d.dalsze)}
    <div class="pole-t">KIEDY ZADZWONIĆ ZNOWU</div>${terminBox(d.nastepny_kontakt || '')}
    <label class="pole-t">${NAGL.uwagi}<textarea id="f-uwagi" maxlength="4000">${esc(d.uwagi || '')}</textarea></label>
    <div class="zapisz-dol"><button class="btn btn-main btn-big" type="submit" style="margin:0">💾 ${r ? 'Zapisz zmiany' : 'Dodaj kontakt'}</button></div>
    ${r ? historiaHtml(r) : ''}
    ${r && S.admin ? `<div class="akcje-dol" style="margin-top:14px"><button type="button" class="link czerwony" data-akcja="usun">Usuń kontakt</button></div><div id="usun-box"></div>` : ''}
  </form>`);
  if (!r) setTimeout(() => $('#f-link')?.focus(), 60);
  else sprawdzDubel();
}

// czy ten numer albo ogłoszenie już kiedyś było (przed telefonem warto wiedzieć)
function sprawdzDubel() {
  const box = $('#f-dubel'); if (!box) return;
  const tc = cyfry($('#f-telefon').value).slice(-9), lk = linkKlucz($('#f-link').value);
  const inne = S.rekordy.filter(x => x.id !== S.otwarty?.id && ((tc.length === 9 && cyfry(x.telefon).slice(-9) === tc) || (lk && linkKlucz(x.link) === lk)));
  box.innerHTML = inne.length ? `<div class="dubel">⚠️ <b>Ten kontakt już jest${inne.length > 1 ? ` (${inne.length}×)` : ''}:</b>${inne.slice(0, 3).map(x =>
    `<div>LP ${x.nr}, ${esc([x.nieruchomosc, x.lokalizacja].filter(Boolean).join(' · '))}, ${x.pierwszy_telefon ? dataPL(x.pierwszy_telefon) + ', ' : ''}${esc(x.agent || 'bez agenta')}, ${stBadge(x.status)}
      <button type="button" class="link" data-otworz="${x.id}">otwórz</button></div>`).join('')}</div>` : '';
}
// z linku czytamy, co się da: miasto z listy, liczba pokoi, sprzedaż/wynajem
function zgadnijZLinku(l) {
  let s; try { s = ' ' + norm(decodeURIComponent(l)).replace(/[^a-z0-9]+/g, ' ') + ' '; } catch (e) { return {}; }
  const w = {};
  const lok = opcje('lokalizacja').find(v => s.includes(' ' + norm(v).replace(/[^a-z0-9]+/g, ' ') + ' '));
  if (lok) w.lokalizacja = lok;
  const m = s.match(/ ([1-5]) ?(pok|pokoj|pokojowe|pokojowy|pokoje|pokoi) /);
  const nz = (t) => opcje('nieruchomosc').find(o => klucz(o) === klucz(t));
  if (/ kawalerk/.test(s) || (m && m[1] === '1')) w.nieruchomosc = nz('Kawalerka');
  else if (m && +m[1] <= 4) w.nieruchomosc = nz(m[1] + ' pokoje');
  else if (/ dom /.test(s) || / domy /.test(s)) w.nieruchomosc = nz('Dom');
  else if (/ dzialk/.test(s)) w.nieruchomosc = nz('Działka');
  else if (/ lokal/.test(s)) w.nieruchomosc = nz('Lokal');
  if (/ wynaj| najem | do wynajecia /.test(s)) w.transakcja = opcje('transakcja').find(o => /wynaj/.test(norm(o)));
  else if (/ sprzeda/.test(s)) w.transakcja = opcje('transakcja').find(o => /sprzeda/.test(norm(o)));
  return w;
}
$('#arkusz').addEventListener('input', (e) => {
  if (e.target.id === 'f-link') {
    const w = zgadnijZLinku(e.target.value);
    for (const [pole, v] of Object.entries(w)) if (v && (!wartosc(pole) || (pole === 'transakcja' && !S.otwarty?.id))) ustaw(pole, v);
    sprawdzDubel();
  }
  if (e.target.id === 'f-telefon') sprawdzDubel();
  if (e.target.id === 'a-termin') ustawTermin(e.target.value);
});

$('#arkusz').addEventListener('click', async (e) => {
  const b = e.target.closest('button'); if (!b || !S.otwarty) return;
  const cg = b.closest('.cg');
  if (cg) {
    if ('inne' in b.dataset) {
      const i = $('.cg-inne', cg); i.hidden = false; i.focus();
      $$('.chip[data-v]', cg).forEach(c => c.classList.remove('on')); cg.dataset.v = '';
      return;
    }
    const v = cg.dataset.v && klucz(cg.dataset.v) === klucz(b.dataset.v) ? '' : b.dataset.v;
    ustaw(cg.dataset.pole, v);
    if (cg.dataset.pole === 'status') poStatusie(v);
    if (cg.dataset.pole === 'dalsze') poDalszych(v);
    return;
  }
  if (b.dataset.termin !== undefined) { ustawTermin(b.dataset.termin); return; }
  if (b.dataset.otworz) { otworzFormularz(b.dataset.otworz); return; }
  const a = b.dataset.akcja;
  if (a === 'edytuj-dane') otworzFormularz(S.otwarty.id);
  if (a === 'usun') $('#usun-box').innerHTML = `<div class="potwierdz">Na pewno usunąć ten kontakt razem z historią telefonów?
    <div class="akcje-dol"><button type="button" class="link czerwony" data-akcja="usun-tak">Tak, usuń</button><button type="button" class="link" data-akcja="usun-nie">Nie</button></div></div>`;
  if (a === 'usun-nie') $('#usun-box').innerHTML = '';
  if (a === 'usun-tak') {
    try { await DB.usun(S.otwarty.id); S.rekordy = S.rekordy.filter(x => x.id !== S.otwarty.id); toast('Kontakt usunięty'); zamknijArkusz(); }
    catch (err) { toast('Nie udało się: ' + err.message, 5000); }
  }
});

$('#arkusz').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (e.target.id === 'f-wynik') return zapiszWynik();
  if (e.target.id === 'f-dane') return zapiszDane();
});

async function zapiszWynik() {
  const r = S.rekordy.find(x => x.id === S.otwarty.id); if (!r) return;
  const status = wartosc('status');
  if (!status) { toast('Wybierz STATUS POZYSKU'); $('#arkusz .cg[data-pole="status"]').scrollIntoView({ block: 'center', behavior: 'smooth' }); return; }
  const powod = wartosc('powod'), dalsze = wartosc('dalsze'), termin = $('#a-termin').value || null, notatka = $('#a-notatka').value.trim();
  const teraz = new Date().toISOString();
  const zm = {
    status, powod, dalsze, nastepny_kontakt: termin, ostatni_kontakt: teraz, proby: (r.proby || 0) + 1,
    pierwszy_telefon: r.pierwszy_telefon || dzis(), agent: r.agent || mojAgent(),
    historia: [...(r.historia || []), { k: teraz, o: ja(), s: status, p: powod, d: dalsze, t: termin, n: notatka }],
    uwagi: notatka ? ((r.uwagi ? r.uwagi + '\n' : '') + dataKrotko(dzis()) + ': ' + notatka).slice(-4000) : r.uwagi
  };
  try {
    await DB.zmien(r.id, zm); Object.assign(r, zm); await dopiszDoList(zm);
    toast(termin ? `Zapisane, następny telefon ${dataPL(termin)}` : 'Zapisane'); zamknijArkusz();
  } catch (err) { toast('Nie zapisało się: ' + err.message, 5000); }
}

async function zapiszDane() {
  const r = S.otwarty.id ? S.rekordy.find(x => x.id === S.otwarty.id) : null;
  const link = $('#f-link').value.trim(), telefon = cyfry($('#f-telefon').value) ? $('#f-telefon').value.trim() : '';
  if (!link && !telefon) { toast('Wpisz co najmniej link do ogłoszenia albo telefon'); $('#f-link').focus(); return; }
  if (link && !linkUrl(link)) { toast('Link wygląda na niepełny, skopiuj go jeszcze raz z ogłoszenia', 4000); $('#f-link').focus(); return; }
  const cenaW = $('#f-cena').value.trim(), cena = liczba(cenaW);
  if (cenaW && cena == null) { toast('Cenę wpisz samymi cyframi, np. 359000'); $('#f-cena').focus(); return; }
  const zm = {
    link: linkUrl(link) || '', telefon: cyfry(telefon).length === 9 ? cyfry(telefon) : telefon, cena,
    osoba: duza($('#f-osoba').value), pierwszy_telefon: $('#f-pierwszy').value || null,
    nastepny_kontakt: $('#a-termin').value || null, uwagi: $('#f-uwagi').value.trim()
  };
  for (const p of LISTY) zm[p] = wartosc(p);
  try {
    if (r) { await DB.zmien(r.id, zm); Object.assign(r, zm); toast('Zapisane'); }
    else { const n = await DB.dodaj(zm); S.rekordy.unshift(n); toast(`Dodane jako LP ${n.nr}`); }
    await dopiszDoList(zm); zamknijArkusz();
  } catch (err) { toast('Nie zapisało się: ' + err.message, 5000); }
}

// ===================== IMPORT Z EXCELA =====================
function wczytajSkrypt(src) {
  return new Promise((ok, nie) => {
    if (window.XLSX) return ok();
    const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => nie(new Error('Nie wczytał się czytnik Excela')); document.head.appendChild(s);
  });
}
// stary status z jednej kolumny („Niezainteresowany współpracą, ponowić kontakt”) rozbity na STATUS, POWÓD i DALSZE
function mapujStatus(raw) {
  const n = norm(raw);
  if (!n) return {};
  const Z = 'Zamknięty, nieaktualne', K = 'Zamknięcie kontaktu';
  if (/nie ?odebra/.test(n)) return { status: 'Nieodebrany telefon', dalsze: 'Ponowić kontakt' };
  if (/podpisan/.test(n)) return { status: 'Podpisana umowa' };
  if (/umowione/.test(n)) return { status: 'Umówione spotkanie' };
  if (/sprzedana/.test(n)) return { status: Z, powod: 'Sprzedana nieruchomość', dalsze: K };
  if (/wynajeta/.test(n)) return { status: Z, powod: 'Wynajęta nieruchomość', dalsze: K };
  if (/wylacznosc/.test(n) && !/przekonac/.test(n)) return { status: Z, powod: 'Działa na umowie na wyłączność', dalsze: K };
  if (/otwartej/.test(n)) return { status: 'Rozmowa odbyta', powod: 'Działa na umowie otwartej', dalsze: 'Przekonać do wyłączności' };
  if (/rezygnacja|zachowani/.test(n)) return { status: Z, powod: 'Rezygnacja, zachowanie klienta', dalsze: K };
  if (/sprzedawac sam|sam sprzeda/.test(n)) return { status: 'Rozmowa odbyta', powod: 'Chce sprzedawać sam', dalsze: 'Ponowić kontakt' };
  if (/niezainteresowan/.test(n)) return { status: 'Rozmowa odbyta', powod: 'Niezainteresowany współpracą', dalsze: 'Ponowić kontakt' };
  if (/zainteresowan/.test(n)) return { status: 'Rozmowa odbyta', dalsze: 'Oddzwonić w innym terminie' };
  if (/rozmowa/.test(n)) return { status: 'Rozmowa odbyta' };
  if (/zamkni|nieaktual/.test(n)) return { status: Z, dalsze: K };
  return { status: duza(String(raw).toLowerCase()) };
}
const ALIASY = { pensjonaty: 'Pensjonat', mieszkaniepowyzej70m2: 'Mieszkanie powyżej 70 m²', zamknietynieaktualne: 'Zamknięty, nieaktualne', rezygnacjazachowanieklienta: 'Rezygnacja, zachowanie klienta', podpisanaumowa: 'Podpisana umowa' };
function dopasuj(pole, raw, nowe) {
  const t = String(raw ?? '').trim(); if (!t) return '';
  const k = klucz(t);
  const jest = opcje(pole).find(o => klucz(o) === k) || (ALIASY[k] && opcje(pole).find(o => o === ALIASY[k])) || ALIASY[k];
  if (jest) return jest;
  if (pole === 'rynek' || pole === 'transakcja') return ''; // w arkuszu zdarzały się pomylone kolumny
  const ladna = pole === 'lokalizacja' || pole === 'agent' ? t.toLowerCase().replace(/(^|[\s-])(\S)/g, (m, a, b) => a + b.toUpperCase()) : duza(t.toLowerCase());
  (nowe[pole] = nowe[pole] || new Set()).add(ladna);
  return ladna;
}

async function importuj(plik, rok) {
  // wynik trzymamy w stanie, bo odświeżenie zakładki rysuje kartę importu od nowa
  const wyn = { set innerHTML(t) { S.impWynik = t; const el = $('#imp-wynik'); if (el) el.innerHTML = t; }, set textContent(t) { this.innerHTML = esc(t); } };
  wyn.textContent = '⏳ Czytam plik…';
  try {
    await wczytajSkrypt('vendor/xlsx.full.min.js');
    const wb = XLSX.read(await plik.arrayBuffer(), { cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const zakres = XLSX.utils.decode_range(ws['!ref']);
    const kom = (r, c) => ws[XLSX.utils.encode_cell({ r, c })];
    const war = (r, c) => { const k = kom(r, c); return k ? k.v : null; };
    const juz = new Set(); S.rekordy.forEach(x => { if (cyfry(x.telefon).length >= 9) juz.add('t' + cyfry(x.telefon).slice(-9)); if (linkKlucz(x.link)) juz.add('l' + linkKlucz(x.link)); });
    const nowe = {}, wiersze = [], zPliku = new Map(); let pominiete = 0, polaczone = 0, mies = 0, ostM = 0;
    for (let r = 1; r <= zakres.e.r; r++) {
      const a = war(r, 0), b = war(r, 1), h = war(r, 7), oK = kom(r, 14);
      // wiersz z nazwą miesiąca (STYCZEŃ, LUTY…)
      if (typeof a === 'string' && !b && !h) {
        const i = MIESIACE.findIndex(m => norm(a).startsWith(norm(m).slice(0, 3)));
        if (i >= 0) { if (ostM && i + 1 < ostM - 5) rok++; mies = i + 1; ostM = mies; }
        continue;
      }
      if (!h && !oK) continue;
      const link = linkUrl(oK?.l?.Target || (oK ? String(oK.v) : '')), tel = cyfry(h);
      const kt = tel.length >= 9 ? 't' + tel.slice(-9) : '', kl = link ? 'l' + linkKlucz(link) : '';
      if ((kt && juz.has(kt)) || (kl && juz.has(kl))) { pominiete++; continue; }
      const wczesniej = (kt && zPliku.get(kt)) || (kl && zPliku.get(kl)); // ten sam kontakt drugi raz w arkuszu = kolejny telefon
      // PIERWSZY TELEFON: „17.01”, data z Excela albo liczba 17.01
      let pt = null; const v = war(r, 8);
      if (v instanceof Date) pt = isoDzien(v);
      else if (v != null && v !== '') {
        const m = (typeof v === 'number' ? v.toFixed(2) : String(v)).trim().match(/^(\d{1,2})[.\-/ ](\d{1,2})(?:[.\-/ ](\d{2,4}))?/);
        if (m && +m[2] >= 1 && +m[2] <= 12 && +m[1] >= 1 && +m[1] <= 31) {
          if (!m[3] && ostM && +m[2] < ostM - 5) { rok++; } if (!m[3]) ostM = +m[2];
          const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : rok;
          pt = `${y}-${pad(m[2])}-${pad(m[1])}`;
        }
      }
      if (!pt && mies) pt = `${rok}-${pad(mies)}-01`;
      const st = mapujStatus(war(r, 10));
      const powodX = war(r, 11), dalszeX = war(r, 12), uw = war(r, 13);
      const rek = {
        nieruchomosc: dopasuj('nieruchomosc', b, nowe), rynek: dopasuj('rynek', war(r, 2), nowe), transakcja: dopasuj('transakcja', war(r, 3), nowe),
        lokalizacja: dopasuj('lokalizacja', war(r, 4), nowe), cena: liczba(war(r, 5)), osoba: duza(String(war(r, 6) ?? '').toLowerCase().replace(/(^|\s)(\S)/g, (x, p, q) => p + q.toUpperCase())),
        telefon: tel.length === 9 ? tel : String(h ?? ''), pierwszy_telefon: pt, agent: dopasuj('agent', war(r, 9), nowe),
        status: dopasuj('status', st.status, nowe), powod: powodX ? dopasuj('powod', mapujStatus(powodX).powod || powodX, nowe) : dopasuj('powod', st.powod, nowe),
        dalsze: dalszeX ? dopasuj('dalsze', dalszeX, nowe) : dopasuj('dalsze', st.dalsze, nowe),
        uwagi: uw instanceof Date ? dataPL(isoDzien(uw)) : String(uw ?? '').trim(), link
      };
      rek.historia = pt && rek.status ? [{ k: pt + 'T12:00:00', o: rek.agent, s: rek.status, p: rek.powod, d: rek.dalsze, imp: 1 }] : [];
      rek.proby = rek.historia.length; rek.ostatni_kontakt = pt && rek.status ? pt + 'T12:00:00' : null;
      if (wczesniej) {
        for (const p of ['status', 'powod', 'dalsze', 'ostatni_kontakt']) if (rek[p]) wczesniej[p] = rek[p];
        wczesniej.historia.push(...rek.historia); wczesniej.proby += rek.proby;
        if (rek.uwagi && !wczesniej.uwagi.includes(rek.uwagi)) wczesniej.uwagi = [wczesniej.uwagi, rek.uwagi].filter(Boolean).join('\n');
        for (const p of ['link', 'telefon', 'osoba', 'cena', 'lokalizacja', 'nieruchomosc']) if (!wczesniej[p] && rek[p]) wczesniej[p] = rek[p];
        polaczone++; continue;
      }
      if (kt) zPliku.set(kt, rek); if (kl) zPliku.set(kl, rek);
      wiersze.push(rek);
    }
    if (!wiersze.length) { wyn.innerHTML = `Nic nowego do wczytania${pominiete ? ` (${pominiete} już jest w aplikacji)` : ''}.`; return; }
    wyn.textContent = `⏳ Zapisuję ${wiersze.length} kontaktów…`;
    for (const [pole, zb] of Object.entries(nowe)) for (const w of zb) if (!opcje(pole).some(o => klucz(o) === klucz(w))) {
      try { S.listy.push(await DB.dodajListe({ pole, wartosc: w, rola: pole === 'agent' ? 'agent' : '', kolejnosc: 50 })); } catch (e) {}
    }
    await DB.dodajWiele(wiersze); // kolejność jak w arkuszu, LP rośnie od góry
    wyn.innerHTML = `✅ Wczytano <b>${wiersze.length}</b> kontaktów${polaczone ? `, ${polaczone} powtórzonych numerów dopisanych do historii` : ''}${pominiete ? `, pominięto ${pominiete} (już były w aplikacji)` : ''}.`;
    await odswiez();
  } catch (err) { wyn.textContent = '❌ ' + err.message; }
}

// ===================== SERVICE WORKER =====================
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).catch(() => {});
  let przeladowano = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (przeladowano || !$('#arkusz').hidden || ['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) return;
    przeladowano = true; location.reload();
  });
}

start();
