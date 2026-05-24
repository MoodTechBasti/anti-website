import json
from html.parser import HTMLParser

class SimpleHTMLSummary(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags_stack = []
        self.headings = []
        self.buttons = []
        self.links = []
        self.current_tag = None
        self.current_text = []

    def handle_starttag(self, tag, attrs):
        self.tags_stack.append(tag)
        self.current_tag = tag
        self.current_attrs = dict(attrs)
        self.current_text = []
        
        if tag == 'a':
            self.current_link = self.current_attrs.get('href', '')

    def handle_endtag(self, tag):
        if self.tags_stack:
            self.tags_stack.pop()
        text = "".join(self.current_text).strip()
        if text:
            if tag in ['h1', 'h2', 'h3', 'h4', 'h5', 'h6']:
                self.headings.append((tag, text))
            elif tag == 'button':
                self.buttons.append(text)
            elif tag == 'a' and hasattr(self, 'current_link'):
                self.links.append((self.current_link, text))
        self.current_tag = None
        self.current_text = []

    def handle_data(self, data):
        if self.current_tag:
            self.current_text.append(data)

def main():
    # Read the JSON containing the HTML string from the local workspace folder
    with open("antigravity_source.json", "r", encoding="utf-8") as f:
        html_content = json.load(f)
    
    parser = SimpleHTMLSummary()
    parser.feed(html_content)
    
    print("=== HEADINGS ===")
    for tag, text in parser.headings:
        print(f"{tag.upper()}: {text}")
        
    print("\n=== BUTTONS ===")
    for btn in set(parser.buttons):
        print(f"Button: {btn}")
        
    print("\n=== EXTERNAL LINKS ===")
    for href, text in set(parser.links):
        if href.startswith('http'):
            print(f"Link [{text}]: {href}")

if __name__ == "__main__":
    main()
