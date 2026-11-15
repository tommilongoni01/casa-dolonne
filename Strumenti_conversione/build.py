"""Unisce testo (docx) e figure (pdf) in contenuti_manuale.json per l'app."""
import json, re, sys, os
DOCX='/tmp/dolonne_docx'; PDF='/tmp/dolonne_pdf'
TITOLI={'00':'0 · Legenda','01':'1 · Istruzioni generali','02':'2 · ETA–PdC: gestione priorità funzionamento',
        '03':'3 · Deposito pellet','04':'4 · ACS: fasce orarie, circolazione e temperatura max','05':'5 · Gestione etichette pannello'}
def norm_tokens(s): return [t for t in re.split(r'[^\wàèéìòù°÷]+', s.lower()) if t]
def testo_runs(runs): return ''.join(r['t'] for r in runs)
def sistema_tab(runs):
    out=[]; 
    for idx,r in enumerate(runs):
        if r['t']=='\t':
            prev=''.join(x['t'] for x in out).rstrip()
            sep=' ' if prev.endswith(':') or not prev else ' – '
            out.append(dict(r,t=sep))
        else: out.append(dict(r))
    # unisce run consecutivi con stessa formattazione
    merged=[]
    for r in out:
        if merged and all(merged[-1].get(k)==r.get(k) for k in ('b','i','link')): merged[-1]['t']+=r['t']
        else: merged.append(dict(t=r['t'],b=r['b'],i=r['i'],link=r.get('link')))
    return merged
def guida(n):
    d=[x for x in os.listdir(DOCX) if x.startswith(n)][0]
    seq=json.load(open(f'{DOCX}/{d}/seq.json'))
    figs=json.load(open(f'{PDF}/g{n}.fig.json')) if os.path.exists(f'{PDF}/g{n}.fig.json') else []
    # posizione delle figure nella sequenza
    k=0; items=[]
    for x in seq:
        if x['kind']=='img': items.append(('img',figs[k])); k+=1
        elif x['kind']=='p': items.append(('p',x))
    assert k==len(figs), (n,k,len(figs))
    # rimuove logo iniziale e intestazione centrata
    logo_tolto=False
    while items:
        kind,x=items[0]
        if kind=='img' and not logo_tolto: logo_tolto=True; items=items[1:]; continue
        if kind=='p' and (not testo_runs(x['runs']).strip() or
           (x['align']=='center' and any((r['sz'] or 0)>=16 for r in x['runs']))): items=items[1:]; continue
        break
    blocchi=[]; corrente=[]; contatori={}
    def chiudi():
        nonlocal corrente
        while corrente and not corrente[-1]['runs']: corrente.pop()
        if corrente: blocchi.append({'testo':corrente})
        corrente=[]
    for i,(kind,x) in enumerate(items):
        if kind=='img':
            chiudi(); blocchi.append({'immagine':x['file'],'didascalia':'\n'.join(x['captions'])}); continue
        t=testo_runs(x['runs'])
        if not t.strip():
            if corrente and corrente[-1]['runs']: corrente.append({'stile':'normale','runs':[]})
            continue
        # salta i paragrafi già presenti come etichette nell'immagine vicina
        tok=norm_tokens(t)
        prima=[items[j][1] for j in range(i-1,-1,-1) if items[j][0]=='img'][:1]
        dopo=[items[j][1] for j in range(i+1,len(items)) if items[j][0]=='img'][:1]
        vicine=prima+dopo
        # il paragrafo (intero, in sequenza) compare come testo dentro un'immagine vicina
        if tok and any(' '.join(tok) in ' '.join(norm_tokens(' '.join(f['labels']))) for f in vicine): continue
        runs=sistema_tab(x['runs'])
        testi=[r for r in runs if r['t'].strip()]
        tutto_grassetto=testi and all(r['b'] for r in testi)
        grande=any((r['sz'] or 0)>=16 for r in x['runs'])
        stile='titoletto' if (tutto_grassetto or grande) else 'normale'
        if grande and x['align']!='center':
            # indice iniziale (es. guida ACS): elenco puntato invece di titoli grandi
            stile='normale'; x=dict(x,list='bullet')
            runs=[dict(r,t=r['t'].capitalize() if r['t'].isupper() else r['t']) for r in runs]
        if x['list']:
            c=contatori.get(x['list'],0)+1; contatori[x['list']]=c
            pref=f'{c}. ' if x['list']=='decimal' else '• '
            runs=[{'t':pref,'b':False,'i':False,'link':None}]+runs
        for r in runs:
            if stile=='titoletto': r['b']=False
        corrente.append({'stile':stile,'runs':runs})
    chiudi()
    return {'titolo':TITOLI[n],'blocchi':blocchi}
out={'versione':1,'sezioni':[{'sezione':'Caldaia',
    'documenti':[{'titolo':'ETA PelletsCompact 33–50 kW – Dati tecnici','file':'caldaia_doc_pc33-50_dati_tecnici.pdf'}],
    'guide':[guida(n) for n in ['00','01','02','03','04','05']]}]}
json.dump(out,open(sys.argv[1],'w'),ensure_ascii=False,indent=1)
# anteprima leggibile
for g in out['sezioni'][0]['guide']:
    print('\n=================', g['titolo'])
    for b in g['blocchi']:
        if 'immagine' in b: print(f"   [FOTO {b['immagine']}]" + (f"  didascalia: {b['didascalia']!r}" if b['didascalia'] else ''))
        else:
            for p in b['testo']:
                s=''.join(('**'+r['t']+'**' if r['b'] else r['t']) for r in p['runs'])
                print(('## ' if p['stile']=='titoletto' else '   ')+s if s else '')
