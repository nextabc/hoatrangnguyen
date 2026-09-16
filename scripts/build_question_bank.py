from __future__ import annotations

import ast
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / "build_strategy_doc.py"
OUT = Path(__file__).resolve().parents[1] / "src" / "data" / "questionBank.json"

tree = ast.parse(SOURCE.read_text(encoding="utf-8"))
values = {}
for node in tree.body:
    if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
        try:
            values[node.targets[0].id] = ast.literal_eval(node.value)
        except Exception:
            pass

questions = []

def add(prompt, answer, difficulty, category, options=None, correct=None, explanation=None, source="Tài liệu audit"):
    prompt = re.sub(r"^\[(?:KĐ|TT|VĐ)\d+\]\s*", "", str(prompt)).strip()
    item = {
        "id": f"q{len(questions)+1:03d}",
        "prompt": prompt,
        "answer": str(answer).strip(),
        "difficulty": difficulty,
        "category": category,
        "source": source,
    }
    if options:
        item["type"] = "choice"
        item["options"] = options
        item["correct"] = correct
    else:
        item["type"] = "text"
    if explanation:
        item["explanation"] = explanation
    questions.append(item)

for _, q, a in values["basic"]:
    add(q, a, "easy", "Kiến thức lõi")

for _, q, a in values["tf"]:
    is_true = a.startswith("Đúng")
    add(q, "Đúng" if is_true else "Sai", "easy" if len(questions) % 2 else "medium", "Đúng / Sai",
        ["Đúng", "Sai"], 0 if is_true else 1, a)

for _, q, a in values["hard"]:
    add(q, a, "hard", "Câu phân loại")

for name, category, difficulty in [
    ("ext_arch", "Kiến trúc", "medium"),
    ("ext_stelae", "Bia Tiến sĩ và khoa cử", "medium"),
    ("ext_people", "Danh nhân và giá trị", "easy"),
    ("ext_english", "Tiếng Anh", "medium"),
    ("tie", "Câu phụ phân hạng", "hard"),
]:
    for _, q, a in values[name]:
        # Convert two explicit true/false English items to buttons.
        if q.lower().startswith("true or false:"):
            is_true = a.lower() == "true"
            add(q, a, difficulty, category, ["True", "False"], 0 if is_true else 1)
        else:
            add(q, a, difficulty, category)

def parse_inline_choices(text):
    # Questions in the audited document encode options as A.foo B.bar C.baz D.qux.
    match = re.search(r"\sA\.(.*?)\sB\.(.*?)\sC\.(.*?)\sD\.(.*)$", text)
    if not match:
        return text, None
    return text[:match.start()].strip(), [x.strip() for x in match.groups()]

for letter, label in [("A", "Đề mô phỏng A"), ("B", "Đề mô phỏng B"), ("C", "Đề mô phỏng C")]:
    qs = values[f"actual{letter}"]
    answers = values[f"actualAns{letter}"]
    for idx, (q, ans) in enumerate(zip(qs, answers)):
        prompt, options = parse_inline_choices(q)
        difficulty = "easy" if idx < 10 else "medium" if idx < 18 else "hard"
        if options and ans in "ABCD" and len(ans) == 1:
            correct = ord(ans) - ord("A")
            add(prompt, options[correct], difficulty, label, options, correct, source="Đề mô phỏng theo PPTX")
        elif prompt.lower().startswith("đúng hay sai:"):
            is_true = ans.lower().startswith("đúng")
            add(prompt, "Đúng" if is_true else "Sai", difficulty, label, ["Đúng", "Sai"], 0 if is_true else 1,
                ans, "Đề mô phỏng theo PPTX")
        else:
            add(prompt, ans, difficulty, label, source="Đề mô phỏng theo PPTX")

# Add the original PowerPoint questions that are not verbatim in the audited mock sets.
ppt_extra = [
    ("Văn Miếu - Quốc Tử Giám được bắt đầu xây dựng vào thời kì nào?", "Thời nhà Lý", ["Thời nhà Lý", "Thời nhà Lê", "Thời nhà Trần", "Thời nhà Nguyễn"], 0, "easy"),
    ("Khuê Văn Các có bao nhiêu mái và tầng theo cách mô tả trong đề?", "8 mái, 2 tầng", ["4 mái, 2 tầng", "8 mái, 2 tầng", "12 mái, 3 tầng", "16 mái, 4 tầng"], 1, "medium"),
    ("Trong triều đại nào, Quốc Tử Giám được mở rộng cho cả con em thường dân ưu tú theo học?", "Triều Trần", ["Triều Lý", "Triều Trần", "Triều Hồ", "Triều Nguyễn"], 1, "hard"),
    ("Hệ thống bia Tiến sĩ tại Văn Miếu - Quốc Tử Giám được UNESCO công nhận là gì?", "Di sản tư liệu thế giới", ["Di sản thiên nhiên thế giới", "Di sản văn hóa phi vật thể", "Di sản tư liệu thế giới", "Di sản văn hóa thế giới"], 2, "medium"),
    ("Lễ hội đầu xuân đặc trưng tại Văn Miếu - Quốc Tử Giám có tên chính thức là gì?", "Hội chữ Xuân", ["Hội chữ Xuân", "Lễ hội viết thư pháp", "Lễ dâng hương", "Lễ tuyên dương thủ khoa"], 0, "easy"),
]
for q, a, opts, correct, diff in ppt_extra:
    add(q, a, diff, "Câu hỏi PPTX", opts, correct, source="PowerPoint 66 slide, đã chuẩn hóa")

# De-duplicate exact prompts while preserving the first authoritative formulation.
seen = set()
deduped = []
for q in questions:
    key = unicodedata.normalize("NFKC", q["prompt"]).casefold().strip(" .?")
    if key in seen:
        continue
    seen.add(key)
    q["id"] = f"q{len(deduped)+1:03d}"
    deduped.append(q)

payload = {
    "meta": {
        "title": "Hoa Trạng nguyên Văn Miếu - Quốc Tử Giám",
        "secondsPerQuestion": 15,
        "rounds": {"easy": 10, "medium": 8, "hard": 5},
        "auditNote": "Hai câu sai trong PPTX đã được sửa: Nhâm Tuất 1442 dưới vua Lê Thái Tông; khoa Nho học cuối cùng năm 1919 diễn ra tại Huế.",
    },
    "questions": deduped,
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Wrote {len(deduped)} unique questions to {OUT}")
