from __future__ import annotations

import csv
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "FLOODTWIN_AI_TOAN_BO_Y_TUONG_VA_NOI_DUNG_DAY_DU_MO_RONG_2026.txt"
OUTPUT = ROOT / "docs" / "roadmap-276.csv"

GROUPS = {
    "A": "AI thị giác và ảnh hiện trường",
    "B": "AI dự báo và dữ liệu thời tiết",
    "C": "GIS và bản sao số",
    "D": "Ngôn ngữ và báo cáo hiện trường",
    "E": "Kiểm chứng bằng chứng và chất lượng nguồn",
    "F": "Bản đồ GIS và bản sao số thời gian",
    "G": "FloodPath và tuyến đường",
    "H": "Cảnh báo và tương tác người dùng",
    "I": "FloodCommand và quản trị",
    "J": "FloodLab và mô phỏng",
    "K": "Dữ liệu lịch sử và nghiên cứu",
    "L": "Hạ tầng và tích hợp",
    "M": "Trải nghiệm người dùng",
    "N": "Đánh giá, an toàn và vận hành",
    "O": "Mở rộng AI có điều kiện",
    "P": "Hợp tác thực tế có điều kiện",
}

V1 = {
    2, 3, 5, 7, 8, 9, 10, 11, 12, 13, 16, 18, 19, 20, 21, 22, 23, 24,
    25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 55, 56, 57, 61, 63,
    64, 65, 68, 69, 70, 71, 72, 73, 75, 77, 80, 81, 82, 84, 86, 87, 88,
    90, 91, 92, 93, 94, 95, 98, 100, 101, 102, 103, 104, 105, 108, 109,
    110, 111, 112, 113, 114, 115, 116, 118, 119, 120, 121, 123, 124, 125,
    126, 127, 128, 129, 130, 131, 132, 133, 134, 137, 138, 139, 140, 141,
    142, 143, 144, 145, 146, 147, 148, 149, 150, 151, 152, 153, 154, 155,
    156, 157, 158, 159, 160, 161, 162, 163, 164, 165, 166, 167, 168, 169,
    170, 171, 172, 173, 174, 175, 176, 177, 178, 179, 180, 181, 182, 183,
    184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195, 196, 197,
    198, 199, 200, 201, 202, 203, 204, 205, 206, 207, 208, 209, 210, 211,
    212, 213, 214, 215, 216, 217, 218, 219, 220, 221, 222, 223, 224, 225,
    226, 227, 228, 229, 230, 231, 232, 233, 234, 235, 236, 237, 238, 239,
    240, 241, 242, 243, 244, 245, 246, 247, 248, 249, 250, 251, 252, 253,
    254, 255, 256, 257, 258,
}


def disposition(item_id: int) -> tuple[str, str]:
    if item_id in V1:
        return "V1", "MVP scope; implementation and evidence tracked by milestone"
    if item_id >= 259:
        return "Cần dữ liệu hoặc đối tác", "Requires permissions, official source, partner, or specialist validation"
    return "Mở rộng", "Deferred beyond V1; revisit when data, safety review, or validated need exists"


def main() -> None:
    text = SOURCE.read_text(encoding="utf-8")
    lines = text.splitlines()
    in_catalog = False
    group = ""
    rows: dict[int, dict[str, str]] = {}
    for line in lines:
        if "DANH MỤC CHI TIẾT HÀNG TRĂM CHỨC NĂNG AI" in line:
            in_catalog = True
        if in_catalog:
            heading = re.match(r"\s*([A-P])\.\s+(.+?)\s*\((\d+) Ý TƯỞNG\)", line)
            if heading:
                group = heading.group(1)
            match = re.match(r"\s*(\d{3})\.\s+(.+?)\s*$", line)
            if match:
                item_id = int(match.group(1))
                status, note = disposition(item_id)
                rows[item_id] = {
                    "id": f"FT-{item_id:03d}",
                    "group": group,
                    "group_name": GROUPS.get(group, "Chưa phân nhóm"),
                    "idea": match.group(2),
                    "status": status,
                    "gate": note,
                }
            if "72. KHO Ý TƯỞNG TRẢI NGHIỆM" in line and len(rows) == 276:
                break

    expected = set(range(1, 277))
    missing = sorted(expected - rows.keys())
    extra = sorted(rows.keys() - expected)
    if missing or extra:
        raise SystemExit(f"Expected ideas 1..276; missing={missing[:10]}, extra={extra[:10]}")

    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT.open("w", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=["id", "group", "group_name", "idea", "status", "gate"])
        writer.writeheader()
        writer.writerows(rows[index] for index in sorted(rows))
    print(f"Generated {len(rows)} requirements: {OUTPUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
