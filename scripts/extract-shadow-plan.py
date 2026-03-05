#!/usr/bin/env python3
"""Extract weekly occupancy slots from operator XLSX and normalize them for verification."""

from __future__ import annotations

import argparse
import json
import re
import xml.etree.ElementTree as ET
import zipfile
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional, Tuple

NS = {
    "a": "http://schemas.openxmlformats.org/spreadsheetml/2006/main",
    "r": "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
    "pr": "http://schemas.openxmlformats.org/package/2006/relationships",
}

WEEKDAYS_DE = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"]
WEEKDAY_TO_NUM = {d: i + 1 for i, d in enumerate(WEEKDAYS_DE)}
TIME_RANGE_RE = re.compile(r"^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$")

SCHOOL_LABELS = {"FAW", "GS", "Freie Schule"}
EXTERNAL_LABELS = {
    "SG CE",
    "Niko",
    "Just Ju",
    "Zwerg",
    "FitandDance",
    "StepbyStep",
    "MediKlangHaus",
    "EWG",
}

HINT_PREFIXES = ["FAWZ ab Ostern"]

LOCATION_MAP = {
    "Turnhalle": "Turnhalle",
    "2-Feld-Sporthalle": "MZH",
    "Sporthalle": "MZH",
    "Stadion": "Sportplatz",
    "Tanzraum": "Tanzraum",
}


def col_to_num(col_ref: str) -> int:
    value = 0
    for ch in col_ref:
        if "A" <= ch <= "Z":
            value = value * 26 + (ord(ch) - 64)
    return value


def parse_cell_value(cell: ET.Element, shared_strings: List[str]) -> str:
    cell_type = cell.get("t")
    value_node = cell.find("a:v", NS)
    inline_node = cell.find("a:is", NS)

    if cell_type == "s" and value_node is not None and value_node.text is not None:
        idx = int(value_node.text)
        return shared_strings[idx] if 0 <= idx < len(shared_strings) else ""

    if cell_type == "inlineStr" and inline_node is not None:
        return "".join((t.text or "") for t in inline_node.findall(".//a:t", NS))

    if value_node is not None and value_node.text is not None:
        return value_node.text

    return ""


def normalize_owner(raw: str) -> Tuple[Optional[str], Optional[str], Optional[str]]:
    value = raw.strip()
    if not value:
        return None, None, None

    if any(value.startswith(prefix) for prefix in HINT_PREFIXES):
        return None, None, None

    if value in SCHOOL_LABELS:
        return value, "schule", None

    if value in EXTERNAL_LABELS:
        return value, "extern", None

    if value.startswith("SV "):
        normalized = re.sub(r"\s+", " ", value.replace("Disco", "Disko").strip())
        return normalized, "svw", detect_svw_sport(normalized)

    return value, "unknown", None


def to_minutes(value: str) -> Optional[int]:
    match = re.match(r"^(\d{1,2}):(\d{2})$", value or "")
    if not match:
        return None
    return int(match.group(1)) * 60 + int(match.group(2))


def detect_svw_sport(label: str) -> str:
    text = label.lower()

    if "bb" in text:
        return "Basketball"
    if "tt" in text:
        return "Tischtennis"
    if "vb" in text:
        return "Volleyball"
    if "badm" in text:
        return "Badminton"
    if "showdance" in text:
        return "Showdance"
    if "disko" in text:
        return "DiscoDance"
    if "tanzen" in text:
        return "Tanzen"
    if "gturnen" in text or "turnen" in text:
        return "Geräteturnen"
    if "gym" in text:
        return "Gymnastik / Workout"

    return "Fußball"


@dataclass
class SheetRef:
    name: str
    path: str


def parse_xlsx(input_path: Path) -> Tuple[List[dict], dict]:
    slots: List[dict] = []
    unknown_labels: Counter = Counter()

    with zipfile.ZipFile(input_path) as zf:
        shared_strings: List[str] = []
        if "xl/sharedStrings.xml" in zf.namelist():
            sst_root = ET.fromstring(zf.read("xl/sharedStrings.xml"))
            for si in sst_root.findall("a:si", NS):
                shared_strings.append("".join((t.text or "") for t in si.findall(".//a:t", NS)))

        workbook_root = ET.fromstring(zf.read("xl/workbook.xml"))
        rels_root = ET.fromstring(zf.read("xl/_rels/workbook.xml.rels"))
        rid_to_target = {
            rel.get("Id"): rel.get("Target")
            for rel in rels_root.findall("pr:Relationship", NS)
        }

        sheets: List[SheetRef] = []
        for sheet in workbook_root.findall(".//a:sheets/a:sheet", NS):
            rid = sheet.get("{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id")
            target = rid_to_target.get(rid, "")
            if not target.startswith("worksheets/"):
                continue
            sheets.append(SheetRef(sheet.get("name", ""), f"xl/{target}"))

        for sheet in sheets:
            sheet_root = ET.fromstring(zf.read(sheet.path))
            rows = sheet_root.findall(".//a:sheetData/a:row", NS)

            row_maps: List[Tuple[int, Dict[int, str]]] = []
            max_col = 1
            for row in rows:
                rnum = int(row.get("r", "0"))
                values: Dict[int, str] = {}
                for cell in row.findall("a:c", NS):
                    ref = cell.get("r", "")
                    col_ref = "".join(ch for ch in ref if ch.isalpha())
                    col_num = col_to_num(col_ref)
                    if col_num <= 0:
                        continue
                    value = parse_cell_value(cell, shared_strings).strip()
                    if value:
                        values[col_num] = value
                        max_col = max(max_col, col_num)
                row_maps.append((rnum, values))

            day_row: Optional[Dict[int, str]] = None
            field_row_index: Optional[int] = None

            for _, values in row_maps:
                if values.get(1) == "Zeit":
                    day_row = values
                if values.get(1) == "Feld":
                    field_row_index = _
                    break

            if day_row is None or field_row_index is None:
                continue

            day_for_col: Dict[int, str] = {}
            field_for_col: Dict[int, str] = {}

            current_day = None
            for col in range(2, max_col + 1):
                value = day_row.get(col)
                if value in WEEKDAY_TO_NUM:
                    current_day = value
                if current_day:
                    day_for_col[col] = current_day

            field_row = next((values for rnum, values in row_maps if rnum == field_row_index), {})
            current_field = "Feld 1"
            for col in range(2, max_col + 1):
                value = field_row.get(col)
                if value and value.lower().startswith("feld"):
                    current_field = value
                field_for_col[col] = current_field

            base_location = sheet.name.split(" ab ")[0].strip()
            mapped_venue = LOCATION_MAP.get(base_location)

            for rnum, values in row_maps:
                if rnum <= field_row_index:
                    continue

                time_value = values.get(1, "")
                m = TIME_RANGE_RE.match(time_value)
                if not m:
                    continue

                start = f"{int(m.group(1)):02d}:{m.group(2)}"
                end = f"{int(m.group(3)):02d}:{m.group(4)}"

                for col in range(2, max_col + 1):
                    raw_owner = values.get(col)
                    if not raw_owner:
                        continue

                    if raw_owner in {"h", "0.5", "1", "R"}:
                        continue
                    if TIME_RANGE_RE.match(raw_owner):
                        continue
                    if re.fullmatch(r"\d+(\.\d+)?", raw_owner):
                        continue

                    owner_norm, owner_type, svw_sport = normalize_owner(raw_owner)
                    if owner_norm is None:
                        continue
                    if owner_type == "unknown":
                        unknown_labels[owner_norm] += 1

                    day = day_for_col.get(col)
                    if day is None:
                        continue

                    slots.append(
                        {
                            "sheet": sheet.name,
                            "sourceLocation": base_location,
                            "venue": mapped_venue,
                            "day": day,
                            "dayOfWeek": WEEKDAY_TO_NUM[day],
                            "field": field_for_col.get(col, "Feld 1"),
                            "start": start,
                            "end": end,
                            "ownerRaw": raw_owner,
                            "owner": owner_norm,
                            "ownerType": owner_type,
                            "svwSport": svw_sport,
                        }
                    )

    # Exact dedupe only. Parallel double bookings stay intact via different owners/fields.
    deduped = list(
        {
            (
                s["sourceLocation"],
                s["dayOfWeek"],
                s["field"],
                s["start"],
                s["end"],
                s["owner"],
                s["ownerType"],
            ): s
            for s in slots
        }.values()
    )

    deduped.sort(
        key=lambda s: (
            s["sourceLocation"],
            s["dayOfWeek"],
            s["start"],
            s["field"],
            s["owner"],
        )
    )

    # Merge contiguous slots (e.g. FAW 08:00-08:30 + 08:30-09:00 => 08:00-09:00)
    merge_key_fields = (
        "sheet",
        "sourceLocation",
        "venue",
        "day",
        "dayOfWeek",
        "field",
        "ownerRaw",
        "owner",
        "ownerType",
        "svwSport",
    )

    grouped: Dict[Tuple, List[dict]] = {}
    for slot in deduped:
        key = tuple(slot.get(field) for field in merge_key_fields)
        grouped.setdefault(key, []).append(slot)

    merged_slots: List[dict] = []
    for key, group in grouped.items():
        group.sort(key=lambda s: (to_minutes(s["start"]) or -1, to_minutes(s["end"]) or -1))
        if not group:
            continue

        current = dict(group[0])
        for slot in group[1:]:
            current_end = to_minutes(current["end"])
            next_start = to_minutes(slot["start"])
            next_end = to_minutes(slot["end"])

            if (
                current_end is not None
                and next_start is not None
                and next_end is not None
                and current_end == next_start
            ):
                current["end"] = slot["end"]
            else:
                merged_slots.append(current)
                current = dict(slot)
        merged_slots.append(current)

    merged_slots.sort(
        key=lambda s: (
            s["sourceLocation"],
            s["dayOfWeek"],
            s["start"],
            s["field"],
            s["owner"],
        )
    )

    # Merge same owner/time across multiple fields into one slot.
    # Example: Feld 1 + Feld 2 both FAW 13:00-17:00 => one FAW 13:00-17:00 slot.
    cross_field_key_fields = (
        "sheet",
        "sourceLocation",
        "venue",
        "day",
        "dayOfWeek",
        "start",
        "end",
        "ownerRaw",
        "owner",
        "ownerType",
        "svwSport",
    )
    cross_field_grouped: Dict[Tuple, List[dict]] = {}
    for slot in merged_slots:
        key = tuple(slot.get(field) for field in cross_field_key_fields)
        cross_field_grouped.setdefault(key, []).append(slot)

    final_slots: List[dict] = []
    for _, group in cross_field_grouped.items():
        if len(group) == 1:
            final_slots.append(group[0])
            continue

        fields = sorted(
            {
                s.get("field")
                for s in group
                if s.get("field")
            }
        )
        merged = dict(group[0])
        merged["field"] = None
        merged["fields"] = fields
        merged["fieldCount"] = len(fields)
        final_slots.append(merged)

    final_slots.sort(
        key=lambda s: (
            s["sourceLocation"],
            s["dayOfWeek"],
            s["start"],
            s["owner"],
        )
    )

    summary = {
        "slotCount": len(final_slots),
        "ownerTypeCounts": dict(Counter(s["ownerType"] for s in final_slots)),
        "svwSportCounts": dict(Counter(s["svwSport"] for s in final_slots if s["ownerType"] == "svw")),
        "unknownLabels": dict(unknown_labels),
    }

    return final_slots, summary


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to operator XLSX file")
    parser.add_argument(
        "--output",
        default="public/data/shadow-slots.json",
        help="Output JSON for normalized slots",
    )
    parser.add_argument(
        "--summary-output",
        default="public/data/shadow-summary.json",
        help="Output JSON for extraction summary",
    )

    args = parser.parse_args()

    input_path = Path(args.input)
    output_path = Path(args.output)
    summary_path = Path(args.summary_output)

    slots, summary = parse_xlsx(input_path)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    summary_path.parent.mkdir(parents=True, exist_ok=True)

    output_path.write_text(json.dumps(slots, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    print(
        f"Shadow plan extracted: {len(slots)} slots (svw={summary['ownerTypeCounts'].get('svw',0)}, "
        f"schule={summary['ownerTypeCounts'].get('schule',0)}, extern={summary['ownerTypeCounts'].get('extern',0)})"
    )


if __name__ == "__main__":
    main()
