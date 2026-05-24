import json

def extract(json_path, raw_path):
    print(f"Extracting {json_path} to {raw_path}...")
    with open(json_path, "r", encoding="utf-8") as f:
        content = json.load(f)
    with open(raw_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("Done!")

if __name__ == "__main__":
    extract("styles-7KLEMMT6.json", "styles-7KLEMMT6.css")
    extract("main-SUIVHLSS.json", "main-SUIVHLSS.js")
