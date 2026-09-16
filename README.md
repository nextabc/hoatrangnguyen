# Game Hoa Trạng nguyên: Văn Miếu - Quốc Tử Giám

Web game luyện thi cho học sinh lớp 4, xây dựng từ PowerPoint 66 slide và tài liệu kế hoạch đã audit.

## Nội dung

- 234 câu hỏi không trùng nguyên văn, toàn bộ ở dạng chọn một hoặc nhiều đáp án trong 4 phương án.
- Các câu hỏi một dữ kiện chấm ngay sau khi chọn; các câu có nhiều ý cho phép tích nhiều phương án rồi bấm **Chốt đáp án**.
- 13 bộ đề, mỗi bộ 23 câu theo cấu trúc 10 Khởi động, 8 Tăng tốc, 5 Về đích.
- 15 giây cho mỗi câu.
- Ba chế độ: luyện đủ 23 câu, thi thử đủ 23 câu và ôn toàn bộ 234 câu; trả lời sai không làm dừng lượt chơi.
- Dùng phím `←`/`→` trong mọi chế độ để chuyển câu. Khi quay lại, lựa chọn cũ và kết quả được giữ nguyên, không cộng điểm hai lần.
- Trong chế độ ôn toàn bộ, có thể mở đáp án đúng ở bất kỳ câu nào.
- Sau khi hoàn thành, nút **Chơi bộ đề mới** tự chuyển sang bộ tiếp theo.
- Ghi nhớ độ bao phủ và điểm cao nhất trên chính trình duyệt.
- Chạy được trên máy tính, máy tính bảng và điện thoại.

## Chạy mã nguồn

```bash
npm install
npm run dev
```

## Tạo bản phát hành

```bash
npm test
```

Lệnh này kiểm tra toàn bộ ngân hàng câu hỏi rồi tạo bản phát hành. Thư mục `dist` là bản web tĩnh sẵn sàng triển khai.

## Deploy lên Render

### Cách 1: Dùng Blueprint

1. Giải nén toàn bộ thư mục và đẩy lên một repository GitHub.
2. Trong Render, chọn **New > Blueprint**.
3. Kết nối repository vừa tạo.
4. Render tự đọc file `render.yaml`; chọn **Apply** để triển khai.

### Cách 2: Tạo Static Site thủ công

- **Build Command:** `npm ci && npm run build`
- **Publish Directory:** `dist`
- **Node:** phiên bản 20.19 trở lên

Ứng dụng không cần cơ sở dữ liệu, biến môi trường hay máy chủ backend.

## Cơ sở dữ liệu câu hỏi

Tệp `src/data/questionBank.json` chứa ngân hàng câu hỏi và danh sách nguồn chính thức dùng trong lần audit ngày 16/09/2026. Script `scripts/build_question_bank.py` tái tạo dữ liệu từ tài liệu kế hoạch gốc trong workspace. Script `scripts/audit-game.mjs` kiểm tra số câu, cấu trúc bộ đề, độ bao phủ, kiểu dữ liệu, tính khớp giữa đáp án và phương án đúng, cùng các dữ kiện lịch sử–kiến trúc có rủi ro nhầm lẫn cao.
