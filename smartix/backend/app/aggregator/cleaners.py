import re
from bs4 import BeautifulSoup

def strip_html(text: str):
    if not text:
        return text
    soup = BeautifulSoup(text, "html.parser")
    return soup.get_text(separator=" ", strip=True)

def normalize_whitespace(text: str):
    if not text:
        return text
    return re.sub(r"\s+", " ", text).strip()

def clean_summary(text: str):
    if not text:
        return text
    t = strip_html(text)
    t = normalize_whitespace(t)
    if len(t) > 800:
        t = t[:800] + "..."
    return t
