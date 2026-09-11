"""Render the reviewed Reading Edition; never modifies the Research Edition."""
from pathlib import Path
from html import escape
import re
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont

root = Path(__file__).resolve().parents[1]
source = root / 'docs/qriptopian/thresholds/006-reading-edition.md'
out = root / 'output/pdf/from-constitutional-ai-to-trusted-intelligence-reading-edition.pdf'
out.parent.mkdir(parents=True, exist_ok=True)
for name, filename in [('Serif', 'DejaVuSerif.ttf'), ('SerifItalic', 'DejaVuSerif-Italic.ttf'), ('Sans', 'DejaVuSans.ttf'), ('SansBold', 'DejaVuSans-Bold.ttf')]:
    font_path = Path('/usr/share/fonts/truetype/dejavu') / filename
    if not font_path.exists() and name == 'SerifItalic':
        font_path = font_path.with_name('DejaVuSerif.ttf')
    pdfmetrics.registerFont(TTFont(name, str(font_path)))
pdfmetrics.registerFontFamily('Serif', normal='Serif', italic='SerifItalic', bold='SansBold', boldItalic='SansBold')
styles = {
    'body': ParagraphStyle('body', fontName='Serif', fontSize=10.8, leading=16.5, spaceAfter=10, textColor=HexColor('#20272b'), allowWidows=0, allowOrphans=0),
    'h1': ParagraphStyle('h1', fontName='SansBold', fontSize=25, leading=31, spaceAfter=16, textColor=HexColor('#173d43'), keepWithNext=True),
    'h2': ParagraphStyle('h2', fontName='SansBold', fontSize=14, leading=19, spaceBefore=15, spaceAfter=10, textColor=HexColor('#173d43'), keepWithNext=True),
    'meta': ParagraphStyle('meta', fontName='Sans', fontSize=9, leading=14, spaceAfter=9, textColor=HexColor('#52666b'), keepWithNext=True),
}
def markup(text):
    text = text.replace('—', '-').replace('–', '-')
    return re.sub(r'\*([^*]+)\*', r'<i>\1</i>', escape(text))
story=[]
for block in source.read_text().strip().split('\n\n'):
    if block.startswith('# '):
        style, text='h1',block[2:]
    elif block.startswith('## '):
        style, text='h2',block[3:]
    elif block.startswith('*') and block.endswith('*'):
        style, text='meta',block.strip('*')
    else:
        style, text='body',block
    story.append(Paragraph(markup(text.replace('\n',' ')),styles[style]))
research_url='https://dev-beta.aigentz.me/api/content/media/630aa292-cf67-47b9-969d-688b7e4387e5'
story.append(Spacer(1,8))
story.append(Paragraph(f'<link href="{research_url}" color="#173d43"><u>Open the unchanged Research Edition PDF</u></link>',styles['meta']))
def page(canvas,doc):
    canvas.saveState()
    w,h=doc.pagesize
    canvas.setStrokeColor(HexColor('#b7c4c5'))
    canvas.line(52,h-36,w-52,h-36)
    canvas.setFont('Sans',8)
    canvas.setFillColor(HexColor('#52666b'))
    canvas.drawString(52,h-28,'QRIPTOPIAN  /  THRESHOLDS 006')
    canvas.drawString(52,29,'Reading Edition - 2 September 2026')
    canvas.drawRightString(w-52,29,str(doc.page))
    canvas.restoreState()
doc=SimpleDocTemplate(str(out),pagesize=(432,648),rightMargin=52,leftMargin=52,topMargin=53,bottomMargin=49,title='From Constitutional AI to Trusted Intelligence - Reading Edition')
doc.build(story,onFirstPage=page,onLaterPages=page)
print(out)
