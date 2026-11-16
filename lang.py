import re

# Kata-kata umum yang khas tiap bahasa. Tambah sendiri kalau ada yang kurang.
ID_WORDS = set("""
yang dan di ke dari aku kamu saya gue gw lu lo kita kami mereka dia nggak gak ga enggak engga
tidak bukan ini itu apa siapa kenapa gimana bagaimana kapan dimana udah sudah belum mau bisa
dong deh sih banget aja juga lagi sama buat untuk dengan halo hai makasih terima kasih selamat
pagi siang sore malam capek sedih senang bosan lapar ngantuk kangen tolong ayo yuk kok nih tuh
ya iya kalau kalo karena tapi atau jadi masih harus punya ada banyak sekali besok hari tadi
sekarang nanti dulu pengin pengen ingin lagi cuma hanya saja akan sedang oke baik maaf sayang
berapa ditambah dikurangi dikali dikalikan dibagi pangkat hitung hitungin
""".split())

EN_WORDS = set("""
the and is are am was were i you he she it we they my your me what who why how when where do does
did don't dont not no yes can could will would have has had this that to of in on for with about
hello hi hey thanks thank please sorry good morning night bye tired sad happy bored hungry sleepy
miss love like want need feel feeling today tomorrow just so very really im i'm you're it's
what's let's can't cant i'll i've who's how's there here been being got get going
plus minus times divided power calculate compute
""".split())


def detect(text):
    """'id', 'en', atau None kalau seri / tidak ketahuan."""
    words = re.findall(r"[a-z']+", text.lower())
    id_score = sum(w in ID_WORDS for w in words)
    en_score = sum(w in EN_WORDS for w in words)
    if id_score > en_score:
        return "id"
    if en_score > id_score:
        return "en"
    return None


def detect_turns(turns, default="id"):
    """Pakai pesan terakhir; kalau seri, mundur ke pesan user sebelumnya."""
    for t in reversed(turns):
        if t.get("role", "user") == "user":
            lang = detect(t["content"])
            if lang:
                return lang
    return default
