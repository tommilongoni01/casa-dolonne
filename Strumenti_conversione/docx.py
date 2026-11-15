"""Converte un docx in una sequenza di paragrafi formattati e segnaposto immagine.
Ignora il contenuto delle caselle di testo (le didascalie si leggono dal PDF) e i fallback VML."""
import sys, os, json, xml.etree.ElementTree as ET
W='{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
A='{http://schemas.openxmlformats.org/drawingml/2006/main}'
R='{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'
MC='{http://schemas.openxmlformats.org/markup-compatibility/2006}'
WPS='{http://schemas.microsoft.com/office/word/2010/wordprocessingShape}'
PIC='{http://schemas.openxmlformats.org/drawingml/2006/picture}'

def load(d):
    rels={r.get('Id'):r.get('Target') for r in ET.parse(os.path.join(d,'word/_rels/document.xml.rels')).getroot()}
    fmts={}
    np=os.path.join(d,'word/numbering.xml')
    if os.path.exists(np):
        nr=ET.parse(np).getroot(); absf={}
        for an in nr.findall(f'{W}abstractNum'):
            lv=an.find(f'{W}lvl'); f=lv.find(f'{W}numFmt') if lv is not None else None
            absf[an.get(f'{W}abstractNumId')]=f.get(f'{W}val') if f is not None else 'bullet'
        for n in nr.findall(f'{W}num'):
            fmts[n.get(f'{W}numId')]=absf.get(n.find(f'{W}abstractNumId').get(f'{W}val'),'bullet')
    return rels,fmts

def flag(rp,tag):
    e=rp.find(f'{W}{tag}') if rp is not None else None
    return e is not None and e.get(f'{W}val') not in ('0','false','none')

def runs_of(node,rels,out,imgs,link=None):
    for c in node:
        t=c.tag
        if t==f'{MC}AlternateContent':
            ch=c.find(f'{MC}Choice')
            if ch is not None: runs_of(ch,rels,out,imgs,link)
        elif t==f'{W}hyperlink':
            runs_of(c,rels,out,imgs,rels.get(c.get(f'{R}id')))
        elif t in (f'{W}r',):
            rp=c.find(f'{W}rPr'); sz=rp.find(f'{W}sz') if rp is not None else None
            fmt=dict(b=flag(rp,'b'),i=flag(rp,'i'),u=flag(rp,'u'),sz=int(sz.get(f'{W}val'))/2 if sz is not None else None,link=link)
            for e in c:
                if e.tag==f'{W}t': out.append(dict(t=e.text or '',**fmt))
                elif e.tag==f'{W}tab': out.append(dict(t='\t',**fmt))
                elif e.tag in (f'{W}br',f'{W}cr'): out.append(dict(t='\n',**fmt))
                elif e.tag==f'{MC}AlternateContent':
                    ch=e.find(f'{MC}Choice')
                    if ch is not None: collect_images(ch,rels,imgs)
                elif e.tag==f'{W}drawing': collect_images(e,rels,imgs)
        elif t in (f'{W}smartTag',f'{W}ins',f'{W}fldSimple',f'{W}sdt',f'{W}sdtContent'):
            runs_of(c,rels,out,imgs,link)

def collect_images(node,rels,imgs):
    # solo immagini vere (pic:pic), non dentro caselle di testo
    for pic in node.iter(f'{PIC}pic'):
        b=pic.find(f'.//{A}blip')
        if b is not None: imgs.append(rels.get(b.get(f'{R}embed')))

def paragraphs(body,rels,fmts,seq):
    for el in body:
        if el.tag==f'{W}p':
            ppr=el.find(f'{W}pPr')
            st=ppr.find(f'{W}pStyle') if ppr is not None else None
            jc=ppr.find(f'{W}jc') if ppr is not None else None
            num=ppr.find(f'{W}numPr') if ppr is not None else None
            out=[];imgs=[]
            runs_of(el,rels,out,imgs)
            numfmt=None
            if num is not None:
                nid=num.find(f'{W}numId'); numfmt=fmts.get(nid.get(f'{W}val') if nid is not None else '', 'bullet')
            seq.append(dict(kind='p',style=st.get(f'{W}val') if st is not None else '',
                            align=jc.get(f'{W}val') if jc is not None else '',list=numfmt,runs=out))
            for im in imgs: seq.append(dict(kind='img',src=im))
        elif el.tag==f'{W}tbl':
            for tr in el.iter(f'{W}tr'):
                cells=[]
                for tc in tr.findall(f'{W}tc'):
                    sub=[]; paragraphs(tc,rels,fmts,sub)
                    cells.append(sub)
                seq.append(dict(kind='row',cells=cells))
        elif el.tag==f'{W}sdt':
            c=el.find(f'{W}sdtContent')
            if c is not None: paragraphs(c,rels,fmts,seq)

d=sys.argv[1]
rels,fmts=load(d)
root=ET.parse(os.path.join(d,'word/document.xml')).getroot()
seq=[]; paragraphs(root.find(f'{W}body'),rels,fmts,seq)
print(json.dumps(seq,ensure_ascii=False))
