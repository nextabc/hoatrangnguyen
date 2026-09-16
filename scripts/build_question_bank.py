from __future__ import annotations

import ast
import json
import random
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
    ("Chọn mô tả đúng về số tầng mái của Khuê Văn Các.", "2 tầng mái", ["1 tầng mái", "2 tầng mái", "4 tầng mái", "8 tầng mái"], 1, "medium"),
    ("Vua nào cho tu sửa Quốc Tử Giám năm 1243?", "Vua Trần Thái Tông", ["Vua Lý Thánh Tông", "Vua Trần Thái Tông", "Vua Lê Thánh Tông", "Vua Gia Long"], 1, "hard"),
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

# Keep disputed or easily confused facts aligned with the official sources even
# when the working document used to generate the broader bank has older wording.
audited_overrides = {
    "q105": {
        "prompt": "Nhà Bái Đường trong khu Đại Thành có bao nhiêu gian?",
        "answer": "9 gian",
    },
    "q111": {
        "prompt": "Theo mô tả chính thức, mái Khuê Văn Các có bao nhiêu tầng?",
        "answer": "2 tầng mái",
    },
    "q133": {
        "prompt": "Mốc 1536 gắn với sự kiện nào tại Quốc Tử Giám?",
        "answer": "Vua Mạc Đăng Doanh cho trùng tu Quốc Tử Giám",
    },
    "q134": {
        "prompt": "Theo hồ sơ Memory of the World của UNESCO, hai mốc 2010 và 2011 của 82 bia Tiến sĩ có ý nghĩa gì?",
        "answer": "2010 là năm Việt Nam nộp hồ sơ; 2011 là năm được đăng ký vào Danh mục Di sản tư liệu thế giới",
    },
    "q186": {
        "prompt": "Điền từ theo cách giới thiệu chính thức: Quốc Tử Giám là trường ... đầu tiên của Việt Nam.",
        "answer": "quốc học",
    },
    "q170": {
        "prompt": "In which year was the Imperial Academy founded?",
        "answer": "1076",
        "type": "choice",
        "options": ["1070", "1076", "1484", "1805"],
        "correct": 1,
    },
    "q171": {
        "prompt": "In which city is the Temple of Literature located?",
        "answer": "Ha Noi",
        "type": "choice",
        "options": ["Hue", "Hoi An", "Ha Noi", "Da Nang"],
        "correct": 2,
    },
    "q172": {
        "prompt": "Complete the sentence: There are ... doctoral steles today.",
        "answer": "Eighty-two",
        "type": "choice",
        "options": ["Eighty", "Eighty-one", "Eighty-two", "Eighty-three"],
        "correct": 2,
    },
}
for question in deduped:
    if question["id"] in audited_overrides:
        question.update(audited_overrides[question["id"]])

def normalized_answer(value):
    value = str(value).replace("Đ", "D").replace("đ", "d")
    return re.sub(
        r"[^a-z0-9]+",
        " ",
        unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode().casefold(),
    ).strip()

def semantic_answer(value):
    normalized = normalized_answer(value)
    normalized = re.sub(r"\b(vua|king|phia|huong)\b", "", normalized)
    normalized = re.sub(r"\s+", " ", normalized).strip()
    return normalized

def answer_kind(question):
    answer = question["answer"]
    normalized = normalized_answer(answer)
    if question["category"] == "Tiếng Anh":
        return "english"
    if normalized in {"dung", "sai", "true", "false"}:
        return "boolean"
    if re.search(r"\d", answer):
        return "number"
    if any(name in answer for name in ["Vua ", "Lý ", "Trần ", "Lê ", "Chu Văn An", "Khổng Tử", "Nguyễn ", "Mạc "]):
        return "person"
    if len(answer) > 75:
        return "long"
    if ";" in answer or ", " in answer:
        return "list"
    return "short"

def convert_to_four_choices(items):
    """Make every audited item a deterministic one-of-four question."""
    for question in items:
        options = question.get("options", [])
        if question.get("type") == "choice" and len(options) == 4:
            question["answer"] = options[question["correct"]]
            question["selectionMode"] = "single"
            continue

        normalized = normalized_answer(question["answer"])
        if normalized in {"dung", "sai"}:
            options = ["Đúng", "Sai", "Đúng một phần", "Không đủ thông tin"]
            correct = 0 if normalized == "dung" else 1
        elif normalized in {"true", "false"}:
            options = ["True", "False", "Partly true", "Not enough information"]
            correct = 0 if normalized == "true" else 1
        else:
            kind = answer_kind(question)
            ranked = sorted(
                (candidate for candidate in items if candidate["id"] != question["id"]),
                key=lambda candidate: (
                    candidate["category"] != question["category"],
                    answer_kind(candidate) != kind,
                    abs(int(candidate["id"][1:]) - int(question["id"][1:])),
                ),
            )
            distractors = []
            used = {semantic_answer(question["answer"])}
            for candidate in ranked:
                candidate_answer = candidate["answer"]
                candidate_key = semantic_answer(candidate_answer)
                if not candidate_key or candidate_key in used:
                    continue
                used.add(candidate_key)
                distractors.append(candidate_answer)
                if len(distractors) == 3:
                    break
            if len(distractors) != 3:
                raise RuntimeError(f"Không tạo đủ phương án cho {question['id']}")
            options = [question["answer"], *distractors]
            random.Random(int(question["id"][1:]) * 1484).shuffle(options)
            correct = options.index(question["answer"])

        question["type"] = "choice"
        question["selectionMode"] = "single"
        question["options"] = options
        question["correct"] = correct
        question["answer"] = options[correct]

convert_to_four_choices(deduped)

multi_select_overrides = {
    "q022": ("Những địa danh nào sau đây thuộc 5 khu Nội tự? (Chọn tất cả đáp án đúng.)", ["Nhập đạo", "Thành Đạt", "Đại Thành", "Hồ Văn"], [0, 1, 2]),
    "q025": ("Ba thành phần không gian lớn của di tích là những thành phần nào? (Chọn tất cả đáp án đúng.)", ["Hồ Văn", "Vườn Giám", "Nội tự", "Hồ Gươm"], [0, 1, 2]),
    "q037": ("Những truyền thống giáo dục nào gắn tiêu biểu với di tích? (Chọn tất cả đáp án đúng.)", ["Hiếu học", "Tôn sư trọng đạo", "Sùng bái võ lực", "Coi nhẹ việc học"], [0, 1]),
    "q040": ("Chọn các mô tả đúng về vai trò của Văn Miếu và Quốc Tử Giám.", ["Văn Miếu gắn với thờ tự", "Quốc Tử Giám gắn với đào tạo", "Văn Miếu chỉ dùng để thi cử", "Quốc Tử Giám chỉ dùng để thờ tự"], [0, 1]),
    "q072": ("Chọn các cặp vua - công việc đúng.", ["Lý Thánh Tông - dựng Văn Miếu", "Lý Nhân Tông - lập Quốc Tử Giám", "Lê Thánh Tông - khởi dựng bia Tiến sĩ", "Gia Long - dựng Văn Miếu năm 1070"], [0, 1, 2]),
    "q076": ("Chọn các mô tả đúng để phân biệt hai danh hiệu.", ["82 bia Tiến sĩ được UNESCO ghi danh Di sản tư liệu thế giới năm 2011", "Toàn di tích được công nhận Di tích quốc gia đặc biệt năm 2012", "Toàn di tích được UNESCO ghi danh Di sản thiên nhiên năm 2011", "82 bia được công nhận Di tích quốc gia đặc biệt năm 2012"], [0, 1]),
    "q083": ("Những giá trị nào được di tích nhắc nhở thế hệ trẻ? (Chọn tất cả đáp án đúng.)", ["Hiếu học", "Tôn sư trọng đạo", "Trọng dụng nhân tài", "Lãng quên di sản"], [0, 1, 2]),
    "q110": ("Những vị vua nào được thờ ở tầng trên Hậu Đường? (Chọn tất cả đáp án đúng.)", ["Lý Thánh Tông", "Lý Nhân Tông", "Lê Thánh Tông", "Gia Long"], [0, 1, 2]),
    "q112": ("Các câu đối ở bốn mặt Khuê Văn Các ca ngợi những nội dung nào? (Chọn tất cả đáp án đúng.)", ["Nền văn hiến và văn chương", "Sao Khuê", "Chiến trận", "Nghề thủ công"], [0, 1]),
    "q132": ("Chọn các giải thích đúng về hai mốc 1779 và 1780.", ["1779 là năm khoa thi cuối được bia ghi", "1780 là năm dựng bia cuối", "1779 là năm dựng Văn Miếu", "1780 là năm lập Quốc Tử Giám"], [0, 1]),
    "q140": ("Những nhân vật nào sau đây thuộc Tứ phối? (Chọn tất cả đáp án đúng.)", ["Nhan Tử", "Tăng Tử", "Tử Tư", "Chu Văn An"], [0, 1, 2]),
    "q148": ("Bốn nhóm giá trị của di tích theo đề test gồm những nhóm nào? (Chọn tất cả đáp án đúng.)", ["Lịch sử", "Văn hóa", "Giáo dục", "Nghệ thuật"], [0, 1, 2, 3]),
    "q175": ("Chọn các cặp mốc - sự kiện đúng.", ["1070 - dựng Văn Miếu", "1076 - lập Quốc Tử Giám", "1484 - khởi dựng bia Tiến sĩ", "1805 - tổ chức khoa thi Nho học đầu tiên"], [0, 1, 2]),
    "q176": ("Chọn ba địa danh thuộc hệ thống 5 khu Nội tự.", ["Nhập đạo", "Vườn bia", "Thái Học", "Hồ Văn"], [0, 1, 2]),
    "q177": ("Chọn các vị vua được thờ ở tầng trên Hậu Đường.", ["Lý Thánh Tông", "Lý Nhân Tông", "Lê Thánh Tông", "Trần Thái Tông"], [0, 1, 2]),
    "q178": ("Chọn các nhận định đúng về mốc 1442 và 1484.", ["1442 là năm diễn ra khoa Nhâm Tuất", "1484 là năm dựng bia ghi khoa 1442", "1442 là năm lập Quốc Tử Giám", "1484 là năm dựng Văn Miếu"], [0, 1]),
    "q179": ("Chọn các nhận định đúng về mốc 1779 và 1780.", ["1779 là năm khoa thi cuối được bia ghi", "1780 là năm dựng bia cuối", "1779 là năm xây Khuê Văn Các", "1780 là năm lập Quốc Tử Giám"], [0, 1]),
    "q180": ("Những chi tiết hình học nào nổi bật ở Khuê Văn Các? (Chọn tất cả đáp án đúng.)", ["Bốn trụ gạch ở tầng dưới", "Bốn cửa sổ tròn ở tầng trên", "Tám tầng mái", "Tầng dưới hoàn toàn bằng gỗ"], [0, 1]),
    "q194": ("Chọn đúng hai truyền thống giáo dục tiêu biểu gắn với di tích.", ["Hiếu học", "Tôn sư trọng đạo", "Coi nhẹ người tài", "Lãng quên lịch sử"], [0, 1]),
    "q211": ("Chọn ba nhân vật thuộc Tứ phối trong các phương án sau.", ["Mạnh Tử", "Nhan Tử", "Tăng Tử", "Chu Văn An"], [0, 1, 2]),
    "q213": ("Chọn đúng ba thành phần không gian lớn của di tích.", ["Hồ Văn", "Vườn Giám", "Nội tự", "Hoàng thành"], [0, 1, 2]),
    "q225": ("Chọn các nhận định đúng để phân biệt 1779 và 1780.", ["1779 là năm khoa thi cuối được bia ghi", "1780 là năm dựng bia cuối", "1779 là năm dựng bia đầu tiên", "1780 là năm khoa thi đầu tiên"], [0, 1]),
    "q227": ("Chọn các mô tả đúng về Khuê Văn Các và sao Khuê.", ["Tầng dưới có bốn trụ gạch", "Tầng trên có bốn cửa sổ tròn", "Sao Khuê tượng trưng cho văn chương", "Sao Khuê tượng trưng riêng cho võ nghệ"], [0, 1, 2]),
    "q228": ("Phát biểu nào mô tả đúng vai trò riêng của Văn Miếu và Quốc Tử Giám? (Chọn nhiều đáp án.)", ["Văn Miếu gắn với thờ tự", "Quốc Tử Giám gắn với đào tạo", "Văn Miếu là nơi đào tạo duy nhất", "Quốc Tử Giám chỉ là nơi thờ tự"], [0, 1]),
}

for question in deduped:
    if question["id"] not in multi_select_overrides:
        continue
    prompt, options, correct = multi_select_overrides[question["id"]]
    question.update({
        "prompt": prompt,
        "selectionMode": "multiple",
        "options": options,
        "correct": correct,
        "answer": "; ".join(options[index] for index in correct),
    })

payload = {
    "meta": {
        "title": "Hoa Trạng nguyên Văn Miếu - Quốc Tử Giám",
        "secondsPerQuestion": 15,
        "rounds": {"easy": 10, "medium": 8, "hard": 5},
        "auditedAt": "2026-09-16",
        "auditNote": "Đã rà 234/234 câu theo nguồn chính thức; toàn bộ được chuẩn hóa thành câu hỏi chọn một hoặc nhiều trong 4 đáp án; sửa cách gọi Bái Đường/Điện Đại Thành, chuẩn hóa Khuê Văn Các có 2 tầng mái và làm rõ mốc hồ sơ UNESCO 2010/2011.",
        "officialSources": [
            "https://vanmieu.gov.vn/vi/introduction/site-history",
            "https://vanmieu.gov.vn/vi/introduction/areas/inner-temple",
            "https://vanmieu.gov.vn/vi/visit/architecture/khue-van-pavilion",
            "https://vanmieu.gov.vn/vi/visit/architecture/dien-dai-thanh",
            "https://vanmieu.gov.vn/vi/visit/architecture/thai-hoc-house",
            "https://vanmieu.gov.vn/vi/visit/doctoral-stelae",
            "https://vanmieu.gov.vn/vi/visit/notable-figures/chu-van-an",
            "https://vanmieu.gov.vn/vi/visit/notable-figures/four-sages",
            "https://www.unesco.org/en/memory-world/stone-stele-records-royal-examinations-le-and-mac-dynasties-1442-1779",
            "https://hue.gov.vn/Du-khach/Thong-tin-du-khach/Kham-pha-Hue/tb/Tu-nam-1885-den-nam-1945-213018",
        ],
    },
    "questions": deduped,
}
OUT.parent.mkdir(parents=True, exist_ok=True)
OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
print(f"Wrote {len(deduped)} unique questions to {OUT}")
