"""Render Threshold 007 (Invariant Intelligence) Reading + Research Edition PDFs.

Mirrors the existing render-threshold-reading-edition.py pattern (same fonts,
same page geometry, same footer style) but extended to handle the Research
Edition's headings, blockquotes, bullet/numbered lists, tables and $$ math
blocks -- none of which the Reading Edition renderer needs. Never modifies
either source markdown file.
"""
from pathlib import Path
from html import escape
import re
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether,
)
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

root = Path(__file__).resolve().parents[1]

for name, filename in [
    ('Serif', 'DejaVuSerif.ttf'), ('SerifBold', 'DejaVuSerif-Bold.ttf'),
    ('Sans', 'DejaVuSans.ttf'), ('SansBold', 'DejaVuSans-Bold.ttf'),
    ('Mono', 'DejaVuSansMono.ttf'),
]:
    font_path = Path('/usr/share/fonts/truetype/dejavu') / filename
    pdfmetrics.registerFont(TTFont(name, str(font_path)))
pdfmetrics.registerFontFamily('Serif', normal='Serif', bold='SerifBold', italic='Serif', boldItalic='SerifBold')

STYLES = {
    'body': ParagraphStyle('body', fontName='Serif', fontSize=10.3, leading=15.5, spaceAfter=9,
                            textColor=HexColor('#20272b'), allowWidows=0, allowOrphans=0),
    'h1': ParagraphStyle('h1', fontName='SansBold', fontSize=22, leading=27, spaceBefore=6, spaceAfter=14,
                          textColor=HexColor('#173d43'), keepWithNext=True),
    'h2': ParagraphStyle('h2', fontName='SansBold', fontSize=14, leading=18, spaceBefore=14, spaceAfter=9,
                          textColor=HexColor('#173d43'), keepWithNext=True),
    'h3': ParagraphStyle('h3', fontName='SansBold', fontSize=11.5, leading=15, spaceBefore=11, spaceAfter=7,
                          textColor=HexColor('#2d5a61'), keepWithNext=True),
    'meta': ParagraphStyle('meta', fontName='Sans', fontSize=9, leading=13.5, spaceAfter=8,
                            textColor=HexColor('#52666b'), keepWithNext=True),
    'quote': ParagraphStyle('quote', fontName='Serif', fontSize=10.3, leading=15, spaceAfter=9,
                             leftIndent=18, textColor=HexColor('#173d43')),
    'bullet': ParagraphStyle('bullet', fontName='Serif', fontSize=10.3, leading=14.5, spaceAfter=4,
                              leftIndent=16, bulletIndent=4, textColor=HexColor('#20272b')),
    'math': ParagraphStyle('math', fontName='Mono', fontSize=9.3, leading=13, spaceAfter=9,
                            alignment=1, textColor=HexColor('#2d5a61')),
    'cell': ParagraphStyle('cell', fontName='Serif', fontSize=8.2, leading=10.8,
                            textColor=HexColor('#20272b')),
    'cellhead': ParagraphStyle('cellhead', fontName='SansBold', fontSize=8.4, leading=11,
                                textColor=HexColor('#ffffff')),
}


def inline_markup(text: str) -> str:
    text = text.replace('—', '-').replace('–', '-').replace('×', 'x')
    text = escape(text)
    # Links [label](url)
    text = re.sub(r'\[([^\]]+)\]\((https?://[^\s)]+)\)', r'<link href="\2" color="#173d43"><u>\1</u></link>', text)
    # Inline code `x`
    text = re.sub(r'`([^`]+)`', r'<font face="Mono">\1</font>', text)
    # Bold then italic (avoid clobbering already-inserted tags)
    text = re.sub(r'\*\*([^*]+)\*\*', r'<b>\1</b>', text)
    text = re.sub(r'(?<!\*)\*([^*]+)\*(?!\*)', r'<i>\1</i>', text)
    return text


def render_table(lines):
    rows = [l for l in lines if not re.match(r'^\|[\s:|-]+\|$', l.strip())]
    data = []
    for i, line in enumerate(rows):
        cells = [c.strip() for c in line.strip().strip('|').split('|')]
        style = STYLES['cellhead'] if i == 0 else STYLES['cell']
        data.append([Paragraph(inline_markup(c), style) for c in cells])
    ncols = max(len(r) for r in data)
    for r in data:
        while len(r) < ncols:
            r.append(Paragraph('', STYLES['cell']))
    tbl = Table(data, repeatRows=1)
    tbl.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#173d43')),
        ('GRID', (0, 0), (-1, -1), 0.4, HexColor('#b7c4c5')),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, HexColor('#f2f6f6')]),
        ('LEFTPADDING', (0, 0), (-1, -1), 4),
        ('RIGHTPADDING', (0, 0), (-1, -1), 4),
        ('TOPPADDING', (0, 0), (-1, -1), 3),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 3),
    ]))
    return tbl


def build_story(source_text: str, footer_left: str, footer_right_prefix: str,
                research_or_reading_link: str | None):
    story = []
    blocks = source_text.strip().split('\n\n')
    i = 0
    while i < len(blocks):
        block = blocks[i]
        stripped = block.strip()
        if not stripped or stripped == '---':
            i += 1
            continue
        lines = block.split('\n')
        first = lines[0].strip()

        if first.startswith('| '):
            # A markdown table spans consecutive '| ...' lines within this block.
            story.append(render_table(lines))
            story.append(Spacer(1, 8))
        elif stripped.startswith('$$') and stripped.endswith('$$'):
            inner = stripped.strip('$').strip()
            story.append(Paragraph(escape(inner).replace('\n', '<br/>'), STYLES['math']))
        elif first.startswith('#### '):
            story.append(Paragraph(inline_markup(first[5:]), STYLES['h3']))
        elif first.startswith('### '):
            story.append(Paragraph(inline_markup(first[4:]), STYLES['h3']))
        elif first.startswith('## '):
            story.append(Paragraph(inline_markup(first[3:]), STYLES['h2']))
        elif first.startswith('# '):
            story.append(Paragraph(inline_markup(first[2:]), STYLES['h1']))
        elif first.startswith('**') and first.endswith('**') and len(lines) == 1 and len(first) < 90:
            story.append(Paragraph(inline_markup(first), STYLES['meta']))
        elif first.startswith('> '):
            text = ' '.join(l.lstrip('> ').strip() for l in lines)
            story.append(Paragraph(inline_markup(text), STYLES['quote']))
        elif re.match(r'^[*\-]\s+', first):
            for l in lines:
                m = re.match(r'^[*\-]\s+(.*)$', l.strip())
                if m:
                    story.append(Paragraph(inline_markup(m.group(1)), STYLES['bullet'], bulletText='•'))
        elif re.match(r'^\d+[.)]\s+', first):
            for l in lines:
                m = re.match(r'^(\d+)[.)]\s+(.*)$', l.strip())
                if m:
                    story.append(Paragraph(inline_markup(m.group(2)), STYLES['bullet'], bulletText=f'{m.group(1)}.'))
        else:
            text = ' '.join(l.strip() for l in lines if l.strip())
            if text:
                story.append(Paragraph(inline_markup(text), STYLES['body']))
        i += 1

    if research_or_reading_link:
        story.append(Spacer(1, 8))
        story.append(Paragraph(research_or_reading_link, STYLES['meta']))

    def page(canvas, doc):
        canvas.saveState()
        w, h = doc.pagesize
        canvas.setStrokeColor(HexColor('#b7c4c5'))
        canvas.line(52, h - 36, w - 52, h - 36)
        canvas.setFont('Sans', 8)
        canvas.setFillColor(HexColor('#52666b'))
        canvas.drawString(52, h - 28, footer_left)
        canvas.drawString(52, 29, footer_right_prefix)
        canvas.drawRightString(w - 52, 29, str(doc.page))
        canvas.restoreState()

    return story, page


def render(source_path: Path, out_path: Path, title: str, footer_left: str, footer_right: str,
           cross_link: str | None):
    out_path.parent.mkdir(parents=True, exist_ok=True)
    text = source_path.read_text()
    story, page_fn = build_story(text, footer_left, footer_right, cross_link)
    doc = SimpleDocTemplate(
        str(out_path), pagesize=(432, 648),
        rightMargin=52, leftMargin=52, topMargin=53, bottomMargin=49,
        title=title,
    )
    doc.build(story, onFirstPage=page_fn, onLaterPages=page_fn)
    print(out_path)


if __name__ == '__main__':
    reading_source = root / 'docs/qriptopian/thresholds/007-reading-edition.md'
    research_source = root / 'docs/qriptopian/thresholds/007-research-edition.md'

    render(
        reading_source,
        root / 'output/pdf/invariant-intelligence-reading-edition.pdf',
        'Invariant Intelligence - Reading Edition',
        'QRIPTOPIAN  /  THRESHOLDS 007',
        'Reading Edition - 11 September 2026',
        None,
    )
    render(
        research_source,
        root / 'output/pdf/invariant-intelligence-research-edition.pdf',
        'Invariant Intelligence - Research Edition',
        'QRIPTOPIAN  /  THRESHOLDS 007',
        'Research Edition - 12 September 2026',
        None,
    )
