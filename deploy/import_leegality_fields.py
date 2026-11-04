"""Copy Leegality field ids into backend/leegality_template_map.json.

Leegality has no API that lists a template's fields; the ids come from the dashboard:
Templates > "RA Terms and Conditions - UTFS" (kFWn7uC) > three dots > Download Form Fields.

Usage:  python deploy/import_leegality_fields.py <downloaded form fields .json> [--dry-run]

Matching: Date 1 by name; the signature boxes (type "files") in the order they appear, since both are
named "Image 1"; the Checkbox 1 options by option name ("Option 1".."Option 13", as name or value).
Nothing is written unless every field in the map gets an id.
"""
import json
import os
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MAP_PATH = os.path.join(ROOT, "backend", "leegality_template_map.json")


def _entries(data):
    """Flatten the download into field dicts, whatever wrapper it comes in."""
    if isinstance(data, dict):
        for key in ("fields", "file", "data", "formFields", "templateFields"):
            if key in data:
                return _entries(data[key])
        return [data] if "name" in data or "id" in data else []
    if isinstance(data, list):
        out = []
        for item in data:
            if isinstance(item, dict):
                out.append(item)
                # Checkbox groups may list their options as children
                for key in ("options", "values", "fields"):
                    if isinstance(item.get(key), list):
                        out += [{**o, "_group": item.get("name")} for o in item[key] if isinstance(o, dict)]
        return out
    return []


def _norm(value):
    return str(value or "").strip().lower()


def apply_ids(tmap, entries):
    """Fill ids into tmap in place; returns the map entries that found no id."""
    missing = []
    with_id = [e for e in entries if e.get("id")]

    date = next((e for e in with_id if _norm(e.get("name")) == _norm(tmap["dateField"]["name"])), None)
    if date:
        tmap["dateField"]["id"] = date["id"]
        if date.get("type"):
            tmap["dateField"]["type"] = date["type"]
    else:
        missing.append(tmap["dateField"]["name"])

    images = [e for e in with_id if _norm(e.get("type")) in ("files", "file", "image")]
    sig_cfgs = tmap["signatureImageFields"]
    if len(images) == len(sig_cfgs):
        # Only the ids: the download says type "file" sized "auto", but Leegality's API ignores that and only
        # fills an image sent as type "files" with px width/height (verified live), which the map keeps
        for cfg, entry in zip(sig_cfgs, images):
            cfg["id"] = entry["id"]
    else:
        missing.append(f"{len(sig_cfgs)} signature image fields (found {len(images)} of type files)")

    for opt in tmap["tenureCheckbox"]["options"]:
        target = _norm(opt["name"])
        match = next((e for e in with_id if _norm(e.get("type")) in ("checkbox", "")
                      and target in (_norm(e.get("name")), _norm(e.get("value")), _norm(e.get("label")))), None)
        if match:
            opt["id"] = match["id"]
        else:
            missing.append(f"{tmap['tenureCheckbox']['name']} / {opt['name']}")
    return missing


def main(argv):
    if not argv or argv[0] in ("-h", "--help"):
        print(__doc__)
        return 2
    with open(argv[0], encoding="utf-8") as f:
        entries = _entries(json.load(f))
    with open(MAP_PATH, encoding="utf-8") as f:
        tmap = json.load(f)

    missing = apply_ids(tmap, entries)
    print(f"Fields in the download: {len(entries)}")
    for e in entries:
        print(f"  {e.get('type', '?'):<9} {e.get('name', '')!s:<14} value={e.get('value', '')!s:<10} id={e.get('id')}")
    if missing:
        print("\nNo id found for:\n  " + "\n  ".join(missing))
        print("Nothing written. Check the download is for template", tmap["templateId"])
        return 1
    if "--dry-run" in argv:
        print("\nAll fields matched (dry run, nothing written).")
        return 0
    with open(MAP_PATH, "w", encoding="utf-8") as f:
        json.dump(tmap, f, indent=2)
        f.write("\n")
    print(f"\nAll fields matched; ids written to {os.path.relpath(MAP_PATH, ROOT)}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
