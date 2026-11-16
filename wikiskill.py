import json, os, re, urllib.error, urllib.parse, urllib.request

UA = {"User-Agent": "EmillyBot/1.0 (proyek pribadi)"}
DEBUG = bool(os.environ.get("EMILLY_DEBUG"))     # set EMILLY_DEBUG=1 untuk lihat error asli
_cache = {}

# pola pertanyaan pengetahuan per bahasa -> topik yang dicari
PATTERNS = {
    "id": [
        r"^(?:apa itu|apa sih|apa yang dimaksud(?: dengan)?)\s+(.+)",
        r"^(?:siapa itu|siapa sih|siapa)\s+(.+)",
        r"^(?:jelaskan|jelasin|ceritakan|ceritain)(?: tentang| soal)?\s+(.+)",
        r"^(?:cari|carikan|cariin)\s+(.+)",
    ],
    "en": [
        r"^(?:what is|what's|what are|what was)\s+(?:an?\s+|the\s+)?(.+)",
        r"^(?:who is|who's|who was|who are)\s+(.+)",
        r"^(?:explain|describe|tell me about)\s+(.+)",
        r"^(?:search|look up|find)\s+(?:for\s+)?(.+)",
    ],
}

# Kata umum yang judul Wikipedia-nya beda dari kata sehari-hari. Tambah sendiri sesukamu.
ALIAS = {
    "id": {"batu": "batuan"},
    "en": {},
}

PREFIX = {"id": "Menurut Wikipedia,", "en": "According to Wikipedia,"}
SOURCE = {"id": "sumber", "en": "source"}
CHOICE = {
    "id": "'{t}' bisa berarti beberapa hal, Master: {opts}. Maksud Master yang mana? ✦",
    "en": "'{t}' can mean a few things, Master: {opts}. Which one do you mean? ✦",
}

# pertanyaan tentang Emilly sendiri jangan dilempar ke Wikipedia
SELF_WORDS = {"kamu", "emilly", "anda", "lu", "lo", "you", "your", "yours", "yourself", "emilly's"}


def _log(*a):
    if DEBUG:
        print("[wikiskill]", *a)


def _get(url):
    req = urllib.request.Request(url, headers=UA)
    with urllib.request.urlopen(req, timeout=6) as r:
        return json.load(r)


def _topic(text, lang):
    """Ambil topik dari kalimat, atau None kalau bukan pertanyaan pengetahuan."""
    t = text.lower().strip().rstrip("?!. ")
    for p in PATTERNS.get(lang, []):
        m = re.match(p, t)
        if m:
            topic = m.group(1).strip()
            words = re.findall(r"[a-z']+", topic)
            # kata ganti Emilly, atau akhiran -mu ("pembuatmu"; "ilmu"/"tamu" aman karena pendek)
            if set(words) & SELF_WORDS or any(re.fullmatch(r"\w{3,}mu", x) for x in words):
                return None
            return topic
    return None


def is_knowledge_question(text, lang="id"):
    """True kalau kalimat berpola pertanyaan pengetahuan (apa itu / what is / dst)."""
    return lang in PATTERNS and _topic(text, lang) is not None


def _summary(lang, title):
    """Ringkasan artikel (ikut redirect). None kalau judul tidak ada (404)."""
    url = (f"https://{lang}.wikipedia.org/api/rest_v1/page/summary/"
           + urllib.parse.quote(title.replace(" ", "_"), safe=""))
    try:
        return _get(url)
    except urllib.error.HTTPError as e:
        if e.code == 404:
            return None
        raise


def _search(lang, topic, n=5):
    q = urllib.parse.urlencode({
        "action": "query", "list": "search", "srsearch": topic,
        "srlimit": n, "srnamespace": 0, "format": "json",
    })
    hits = _get(f"https://{lang}.wikipedia.org/w/api.php?{q}")["query"]["search"]
    return [h["title"] for h in hits]


def _format(lang, s):
    kalimat = re.split(r"(?<=[.!?])\s+", s["extract"].strip())
    ringkas = " ".join(kalimat[:2])                       # 2 kalimat pertama saja
    title = urllib.parse.quote(s.get("title", "").replace(" ", "_"))
    return f"{PREFIX[lang]} {ringkas} ✦ ({SOURCE[lang]}: {lang}.wikipedia.org/wiki/{title})"


def _choices(lang, topic, titles, skip=""):
    opts = [t for t in titles if t != skip][:3]
    if not opts:
        return None
    return CHOICE[lang].format(t=topic, opts=", ".join(opts))


def _lookup(lang, topic):
    key = ALIAS.get(lang, {}).get(topic, topic)

    # 1) coba judul persis dulu (ikut redirect, lebih tepat daripada pencarian)
    s = _summary(lang, key[:1].upper() + key[1:])
    if s and s.get("type") == "disambiguation":           # kata ambigu -> tawarkan pilihan
        _log("disambiguasi:", s.get("title"))
        return _choices(lang, topic, _search(lang, key), skip=s.get("title", ""))
    if s and s.get("extract"):
        return _format(lang, s)

    # 2) judul persis tidak ada -> pakai pencarian, ambil hasil pertama yang bukan disambiguasi
    titles = _search(lang, key)
    _log("hasil pencarian:", titles)
    for t in titles[:3]:
        s = _summary(lang, t)
        if not s:
            continue
        if s.get("type") == "disambiguation":
            return _choices(lang, topic, titles, skip=t)
        if s.get("extract"):
            return _format(lang, s)
    return None


def try_wiki(text, lang="id"):
    """Jawaban dari Wikipedia (bahasa sesuai lang) atau None."""
    if lang not in PATTERNS:
        return None
    topic = _topic(text, lang)
    if not topic:
        return None
    key = (lang, topic)
    if key in _cache:
        return _cache[key]
    try:
        out = _lookup(lang, topic)
    except Exception as e:                  # internet mati / timeout / diblokir
        _log("ERROR:", repr(e))
        return None                         # jangan di-cache, mungkin cuma gangguan sesaat
    if out:
        _cache[key] = out
    return out


if __name__ == "__main__":
    # tes cepat:  EMILLY_DEBUG=1 python wikiskill.py
    DEBUG = True
    for tes, lg in [("apa itu batu", "id"), ("apa itu batuan", "id"), ("apa itu fotosintesis", "id"),
                    ("siapa Soekarno", "id"), ("what is photosynthesis", "en"), ("halo", "id")]:
        print(tes, "->", try_wiki(tes, lg), "\n")
