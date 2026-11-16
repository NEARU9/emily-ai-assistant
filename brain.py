import json, random, glob, os
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from lang import detect_turns
from mathskill import try_math
from wikiskill import try_wiki, is_knowledge_question

BASE = os.path.dirname(os.path.abspath(__file__))
LANGS = ["id", "en"]
DEFAULT_LANG = "id"
THRESHOLD = 0.35      # batas minimal agar jawaban data dipakai
STRONG = 0.60         # kecocokan kuat -> data menang atas Wikipedia
STRONG_KNOW = 0.85    # untuk pertanyaan pengetahuan, data harus nyaris persis agar menang atas Wikipedia

FALLBACK = {
    "id": [
        "Hmm, Emilly belum ngerti itu. Bisa jelasin lagi?",
        "Eh? Coba bilang dengan cara lain, Master.",
    ],
    "en": [
        "Hmm, Emilly doesn't get that yet. Could you explain it again?",
        "Eh? Try saying it another way, Master.",
    ],
}


# dipakai kalau pertanyaan pengetahuan gagal dicari (offline / artikel tidak ada)
NO_ANSWER = {
    "id": "Emilly belum tahu soal itu, Master, dan lagi gak bisa nyari di Wikipedia. Coba lagi nanti ya~",
    "en": "Emilly doesn't know about that yet, Master, and can't look it up on Wikipedia right now. Try again later~",
}


# ---------- muat data: data/<bahasa>/*.json ----------
def load_lang(lang):
    qs, ans = [], []
    for path in sorted(glob.glob(os.path.join(BASE, "data", lang, "*.json"))):
        for d in json.load(open(path, encoding="utf-8")):
            variants = d["q"] if isinstance(d["q"], list) else [d["q"]]
            for q in variants:
                qs.append(q.lower().strip())
                ans.append(d["a"])
    return qs, ans


INDEX = {}            # lang -> (vectorizer, matriks, daftar jawaban)
for _lang in LANGS:
    _qs, _ans = load_lang(_lang)
    if _qs:
        _vec = TfidfVectorizer(analyzer="char_wb", ngram_range=(2, 4))
        INDEX[_lang] = (_vec, _vec.fit_transform(_qs), _ans)

if DEFAULT_LANG not in INDEX:
    raise RuntimeError(f"Folder data/{DEFAULT_LANG}/ kosong atau tidak ada.")


def _log_unknown(lang, text):
    with open(os.path.join(BASE, "unknown.txt"), "a", encoding="utf-8") as f:
        f.write(f"{lang}\t{text}\n")


# ---------- balas pesan ----------
def reply(turns, name="", style="sweet"):
    raw = turns[-1]["content"]
    last = raw.lower().strip()

    lang = detect_turns(turns, DEFAULT_LANG)
    if lang not in INDEX:                      # bahasa belum punya data -> default
        lang = DEFAULT_LANG
    vec, mat, answers = INDEX[lang]

    text = try_math(raw, lang)                 # 1) hitungan

    if text is None:
        score = cosine_similarity(vec.transform([last]), mat)[0]
        i = score.argmax()
        best = score[i]
        knowledge = is_knowledge_question(raw, lang)

        if best >= (STRONG_KNOW if knowledge else STRONG):   # 2) data kuat
            text = random.choice(answers[i])
        else:
            text = try_wiki(raw, lang)         # 3) Wikipedia
            if text is None:
                if knowledge:
                    # pertanyaan pengetahuan yang gagal dicari: jangan dijawab asal dari data lemah
                    _log_unknown(lang, last)
                    text = NO_ANSWER[lang]
                elif best >= THRESHOLD:        # 4) data lemah tapi masih masuk akal
                    text = random.choice(answers[i])
                else:                          # 5) fallback
                    _log_unknown(lang, last)
                    text = random.choice(FALLBACK[lang])

    return text.replace("Master", name) if name else text


if __name__ == "__main__":
    history = []
    while True:
        msg = input("You: ")
        if not msg:
            break
        history.append({"role": "user", "content": msg})
        out = reply(history)
        history.append({"role": "assistant", "content": out})
        print("Emilly:", out)
