
import ast
import operator
import re
import random

OPS = {
    ast.Add: operator.add,
    ast.Sub: operator.sub,
    ast.Mult: operator.mul,
    ast.Div: operator.truediv,
    ast.FloorDiv: operator.floordiv,
    ast.Mod: operator.mod,
    ast.Pow: operator.pow,
    ast.USub: operator.neg,
    ast.UAdd: operator.pos,
}

MAX_EXPRESSION_LENGTH = 200
MAX_NUMBER = 1_000_000


def _eval(node):
    """Evaluator matematika aman menggunakan AST."""

    if isinstance(node, ast.Expression):
        return _eval(node.body)

    if isinstance(node, ast.Constant):
        if type(node.value) not in (int, float):
            raise ValueError("Invalid number")

        if abs(node.value) > MAX_NUMBER:
            raise OverflowError

        return node.value

    if isinstance(node, ast.BinOp):
        if type(node.op) not in OPS:
            raise ValueError("Invalid operator")

        a = _eval(node.left)
        b = _eval(node.right)

        if isinstance(node.op, ast.Pow):
            if abs(b) > 10:
                raise OverflowError

            if abs(a) > 1000:
                raise OverflowError

        result = OPS[type(node.op)](a, b)

        if isinstance(result, (int, float)):
            if abs(result) > 1e100:
                raise OverflowError

        return result

    if isinstance(node, ast.UnaryOp):
        if type(node.op) not in OPS:
            raise ValueError("Invalid unary operator")

        return OPS[type(node.op)](_eval(node.operand))

    raise ValueError("Invalid expression")


WORDS = [
    # Bahasa Indonesia
    (r"\bsisa bagi\b|\bmodulo\b|\bmod\b", "%"),
    (r"\bditambah\b|\btambah\b|\bplus\b", "+"),
    (r"\bdikurangi\b|\bdikurang\b|\bkurang\b|\bminus\b", "-"),
    (r"\bdikalikan\b|\bdikali\b|\bkali\b|\btimes\b|\bmultiplied by\b", "*"),
    (r"\bdibagi\b|\bbagi\b|\bdivided by\b|\bdivide by\b|\bover\b", "/"),
    (r"\bto the power of\b|\braised to\b|\bpangkat\b|\bpower\b", "**"),
]

FILLER = (
    r"\b(berapa|hitung|hitungin|hasil|hasilnya|dari|adalah|"
    r"sama dengan|tolong|emilly|dong|ya|what|what's|whats|"
    r"is|calculate|compute|the|of|equals|equal to|result|"
    r"please|how much)\b|[?=]"
)

RESULT = {
    "id": [
        "Hasilnya {x}, Master~ ✦",
        "Itu {x}! Bener gak?",
        "{x}, Master. Emilly udah hitung ya~",
    ],
    "en": [
        "The result is {x}, Master~ ✦",
        "That's {x}! Am I right?",
        "{x}, Master. Emilly did the math~",
    ],
}

DIV_ZERO = {
    "id": "Dibagi nol gak bisa, Master. Hasilnya gak terdefinisi~ ✦",
    "en": "Can't divide by zero, Master. It's undefined~ ✦",
}


def try_math(text, lang="id"):
    """Mengembalikan jawaban matematika atau None."""

    if lang not in RESULT:
        lang = "id"

    if not isinstance(text, str):
        return None

    if len(text) > MAX_EXPRESSION_LENGTH:
        return None

    t = text.lower().strip()

    # Ubah kata menjadi operator.
    for pattern, symbol in WORDS:
        t = re.sub(pattern, symbol, t)

    # Hapus kata-kata tambahan.
    t = re.sub(FILLER, " ", t)

    # Simbol matematika.
    t = t.replace("×", "*")
    t = t.replace("÷", "/")
    t = t.replace("^", "**")
    t = t.replace(",", ".")

    # Rapikan ekspresi.
    expr = t.strip()

    # Validasi karakter.
    if not re.fullmatch(r"[\d.+*/%()\- \t]+", expr):
        return None

    try:
        tree = ast.parse(expr, mode="eval")

        # Abaikan input yang hanya berupa angka.
        if not isinstance(tree.body, ast.BinOp):
            return None

        result = _eval(tree)

    except ZeroDivisionError:
        return DIV_ZERO[lang]

    except (
        ValueError,
        SyntaxError,
        OverflowError,
        TypeError
    ):
        return None

    if isinstance(result, complex):
        return None

    if isinstance(result, float):
        if not result.is_integer():
            result = round(result, 6)
        else:
            result = int(result)

    return random.choice(RESULT[lang]).format(x=result)


if __name__ == "__main__":
    tests = [
        ("berapa 5 ditambah 3", "id"),
        ("what is 12 times 4", "en"),
        ("10 divided by 0", "en"),
        ("2 pangkat 10", "id"),
        ("what is 2 to the power of 8", "en"),
        ("halo", "id"),
        ("100 dikurangi 25", "id"),
        ("10 modulo 3", "en"),
    ]

    for question, language in tests:
        print(
            question,
            "->",
            try_math(question, language)
        )
