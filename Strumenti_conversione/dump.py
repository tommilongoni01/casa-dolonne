import sys, os, re, xml.etree.ElementTree as ET
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
A='{http://schemas.openxmlformats.org/drawingml/2006/main}'
R='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
V='{urn:schemas-microsoft-com:vml}'
def rels(d):
    t=ET.parse(os.path.join(d,'word/_rels/document.xml.rels')).getroot()
    return {r.get('Id'):r.get('Target') for r in t}
def para(p,rl):
    style=p.find(f'{W}pPr/{W}pStyle'); style=style.get(f'{W}val') if style is not None else ''
    num=p.find(f'{W}pPr/{W}numPr')
    jc=p.find(f'{W}pPr/{W}jc'); jc=jc.get(f'{W}val') if jc is not None else ''
    parts=[]
    for r in p.iter(f'{W}r'):
        rp=r.find(f'{W}rPr'); b=i=False; sz=''
        if rp is not None:
            b=rp.find(f'{W}b') is not None and rp.find(f'{W}b').get(f'{W}val') not in ('0','false')
            i=rp.find(f'{W}i') is not None
            s=rp.find(f'{W}sz'); sz=s.get(f'{W}val') if s is not None else ''
        for c in r:
            if c.tag==f'{W}t':
                txt=c.text or ''
                parts.append(('**'+txt+'**' if b and txt.strip() else txt)+(f'[{sz}]' if sz and txt.strip() else ''))
            elif c.tag==f'{W}tab': parts.append('\t')
            elif c.tag==f'{W}br': parts.append('⏎')
        for bl in r.iter(f'{A}blip'):
            parts.append(f'<IMG {rl.get(bl.get(R+"embed"))}>')
        for im in r.iter(f'{V}imagedata'):
            parts.append(f'<VIMG {rl.get(im.get(R+"id"))}>')
    return f"[{style}{' LIST' if num is not None else ''}{' '+jc if jc else ''}] "+''.join(parts)
def walk(body,rl,ind=''):
    for el in body:
        if el.tag==f'{W}p': print(ind+para(el,rl))
        elif el.tag==f'{W}tbl':
            print(ind+'<TABLE>')
            for tr in el.findall(f'{W}tr'):
                cells=[]
                for tc in tr.findall(f'{W}tc'):
                    cells.append(' / '.join(para(p,rl) for p in tc.iter(f'{W}p')))
                print(ind+'  | '+' || '.join(cells))
            print(ind+'</TABLE>')
        elif el.tag==f'{W}sdt':
            c=el.find(f'{W}sdtContent')
            if c is not None: walk(c,rl,ind)
d=sys.argv[1]
root=ET.parse(os.path.join(d,'word/document.xml')).getroot()
walk(root.find(f'{W}body'),rels(d))
