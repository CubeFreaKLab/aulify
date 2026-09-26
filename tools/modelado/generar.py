"""Valida el modelo lógico y genera diccionario, DBML y diagramas con Graphviz.

Uso: python tools/modelado/generar.py [--check]
No conecta servicios ni ejecuta SQL. Python estándar; Graphviz para exportaciones.
"""
from pathlib import Path
import argparse
import hashlib
import html
import json
import re
import shutil
import subprocess

ROOT = Path(__file__).resolve().parents[2]
BASE = ROOT / 'docs/modelado'
MODEL = BASE / 'modelo.json'

def q(value):
    return json.dumps(value, ensure_ascii=False)

def dbname(name):
    return name if '.' in name else 'app.' + name

def endpoint(name, columns):
    cols = columns[0] if len(columns)==1 else '(' + ', '.join(columns) + ')'
    return dbname(name) + '.' + cols

def validate(model):
    tables = model['tables']
    by_name = {t['name']: t for t in tables}
    assert len(by_name) == len(tables), 'Nombre de relación repetido'
    rule_ids = set(re.findall(r'^\*\*([A-Z]{2}-\d+)\.\*\*', (ROOT/'specification.md').read_text(encoding='utf-8'), re.M))
    for t in tables:
        cols = {c['name']: c for c in t['columns']}
        assert len(cols) == len(t['columns']), f'Campo repetido en {t["name"]}'
        assert t['group'] in model['groups']
        assert set(t['rules']) <= rule_ids, f'Regla inexistente: {t["name"]}'
        for key in [t['pk']] + t['unique']:
            assert key and set(key) <= cols.keys(), (t['name'], key)
        assert all(not cols[c]['nullable'] for c in t['pk']), f'PK nullable: {t["name"]}'
        for f in t['foreign_keys']:
            target = by_name[f['target']]
            tc = {c['name']: c for c in target['columns']}
            assert set(f['columns']) <= cols.keys()
            assert f['target_columns'] in [target['pk']] + target['unique'], f'FK a clave no candidata: {t["name"]} {f}'
            assert len(f['columns']) == len(f['target_columns'])
            for a,b in zip(f['columns'],f['target_columns']):
                assert cols[a]['type'] == tc[b]['type'], f'Tipos FK incompatibles {t["name"]}.{a}'
                if f['on_delete']=='set null':
                    assert cols[a]['nullable'], f'SET NULL imposible: {t["name"]}.{a}'
    assert len(by_name['powerup_uses']['pk'])==2
    assert 'attempt_id' not in by_name['powerup_uses']['pk'], 'Consumo incorrectamente limitado por intento'
    assert by_name['responses']['pk']==['attempt_question_id']
    assert ['subject_id','student_id'] in by_name['memberships']['unique']
    return by_name

def dbml(model):
    out = ['// Generado desde modelo.json. Modelo lógico; no es una migración segura.',
           '// CHECK, índices parciales, transacciones y permisos: restricciones.md y permisos.md.',
           'Project aulify {', "  database_type: 'PostgreSQL'", "  Note: 'Modelo lógico 1.0; app es un espacio previsto no expuesto. Auth es externo.'", '}', '']
    for t in model['tables']:
        out += [f'Table {dbname(t["name"])} {{', '  Note: ' + q(t['purpose'])]
        for c in t['columns']:
            flags = ['null' if c['nullable'] else 'not null', 'note: '+q(c['description'])]
            out.append(f'  {c["name"]} {c["type"]} [{", ".join(flags)}]')
        out += ['  indexes {']
        for cols, flag in [(t['pk'],'pk')] + [(u,'unique') for u in t['unique']]:
            key = cols[0] if len(cols)==1 else '(' + ', '.join(cols) + ')'
            out.append(f'    {key} [{flag}]')
        out += ['  }', '}', '']
    for t in model['tables']:
        for f in t['foreign_keys']:
            out.append(f'Ref: {endpoint(t["name"],f["columns"])} > {endpoint(f["target"],f["target_columns"])} [delete: {f["on_delete"]}]')
    return '\n'.join(out)+'\n'

def dictionary(model):
    out=['# Diccionario del modelo lógico', '', 'Generado desde [modelo.json](modelo.json). Tipos PostgreSQL previstos; no existe todavía una migración aplicada. PK = clave primaria; UK = unicidad; FK = clave foránea. Las reglas que necesitan transacciones o índices parciales están en [restricciones](restricciones.md).', '']
    for group,title in model['groups'].items():
        out += [f'## {title}', '']
        for t in model['tables']:
            if t['group'] != group: continue
            out += [f'### {t["name"]}', '', t['purpose'], '', f'PK: `{", ".join(t["pk"])}`.']
            if t['unique']: out += ['UK: '+ '; '.join('`'+', '.join(u)+'`' for u in t['unique'])+'.']
            out += ['Acceso: '+t['access']+'.', 'Reglas: '+(', '.join(t['rules']) or 'administración del proveedor')+'.', '', '| Campo | Tipo previsto | Admite nulo | Descripción |', '|---|---|---|---|']
            for c in t['columns']:
                out.append(f'| `{c["name"]}` | `{c["type"]}` | {"Sí" if c["nullable"] else "No"} | {c["description"]} |')
            out += ['']
            for f in t['foreign_keys']:
                out.append(f'- FK `{", ".join(f["columns"])}` → `{f["target"]}({", ".join(f["target_columns"])})`; eliminación prevista: `{f["on_delete"]}`.')
            if t['foreign_keys']: out += ['']
    return '\n'.join(out).rstrip()+'\n'

def diagram(model, group):
    all_tables = {t['name']:t for t in model['tables']}
    local = {n:t for n,t in all_tables.items() if t['group']==group}
    external = {f['target'] for t in local.values() for f in t['foreign_keys'] if f['target'] not in local}
    title = model['groups'][group]
    out=['digraph modelo {', 'graph [rankdir=LR, bgcolor="#ffffff", pad=0.4, nodesep=0.4, ranksep=1.1, splines=polyline, fontname="Arial", fontsize=20, labelloc=t, label='+q(title+' · modelo lógico 1.0')+'];', 'node [shape=plain, fontname="Arial"];', 'edge [fontname="Arial", fontsize=10, color="#668076", arrowsize=0.6];']
    for name in sorted(set(local)|external):
        t=all_tables[name]; is_local=name in local
        color='#087F5B' if is_local else '#63716B'
        pk = ', '.join(t['pk'])
        foreign = {c for f in t['foreign_keys'] for c in f['columns']}
        chosen=[c for c in t['columns'] if c['name'] in set(t['pk'])|foreign][:7] if is_local else []
        rows=[f'<TR><TD BGCOLOR="{color}"><FONT COLOR="white"><B>{html.escape(name)}</B></FONT></TD></TR>', f'<TR><TD ALIGN="LEFT">PK: {html.escape(pk)}</TD></TR>']
        for c in chosen:
            if c['name'] in t['pk']: continue
            rows.append(f'<TR><TD ALIGN="LEFT">FK {html.escape(c["name"])}{" ?" if c["nullable"] else ""}</TD></TR>')
        if is_local: rows.append(f'<TR><TD ALIGN="LEFT"><FONT COLOR="#63716B">{len(t["columns"])} campos · ver diccionario</FONT></TD></TR>')
        else: rows.append('<TR><TD><FONT COLOR="#63716B">referencia a otro módulo</FONT></TD></TR>')
        out.append(q(name)+' [label=<<TABLE BORDER="0" CELLBORDER="1" CELLSPACING="0" CELLPADDING="8" COLOR="#CDDAD4">'+''.join(rows)+'</TABLE>>];')
    seen=set()
    for t in local.values():
        for f in t['foreign_keys']:
            signature=(t['name'],f['target'],tuple(f['columns']))
            if signature in seen: continue
            seen.add(signature)
            optional=any(next(c['nullable'] for c in t['columns'] if c['name']==n) for n in f['columns'])
            single=any(set(key)<=set(f['columns']) for key in [t['pk']]+t['unique'])
            target='0..1' if optional else '1'
            child='0..1' if single else '0..N'
            out.append(f'{q(f["target"])} -> {q(t["name"])} [dir=none, taillabel={q(target)}, headlabel={q(child)}, labeldistance=1.6];')
    out += ['}']
    return '\n'.join(out)+'\n'

def main():
    parser=argparse.ArgumentParser(); parser.add_argument('--check',action='store_true'); args=parser.parse_args()
    model=json.loads(MODEL.read_text(encoding='utf-8')); validate(model)
    generated={BASE/'aulify.dbml':dbml(model),BASE/'diccionario.md':dictionary(model)}
    for g in model['groups']:
        if g!='externo': generated[BASE/'diagramas'/f'{g}.dot']=diagram(model,g)
    for path,data in generated.items():
        if args.check:
            assert path.exists() and path.read_text(encoding='utf-8')==data, f'Regenerar {path.relative_to(ROOT)}'
        else:
            path.parent.mkdir(parents=True,exist_ok=True); path.write_text(data,encoding='utf-8')
    if not args.check:
        assert shutil.which('dot'), 'Instalar Graphviz para exportar diagramas'
        for path in sorted((BASE/'diagramas').glob('*.dot')):
            for ext in ['svg','png']:
                subprocess.run(['dot','-T'+ext, str(path), '-o', str(path.with_suffix('.'+ext))],check=True,capture_output=True)
        manifest = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((BASE/'diagramas').iterdir()) if p.suffix in {'.dot','.svg','.png'}}
        (BASE/'diagramas/manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    else:
        manifest=json.loads((BASE/'diagramas/manifest.json').read_text(encoding='utf-8'))
        actual={p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted((BASE/'diagramas').iterdir()) if p.suffix in {'.dot','.svg','.png'}}
        assert manifest==actual, 'Fuentes o exportaciones cambiaron: regenerar diagramas'
    report={'modelo_sha256':hashlib.sha256(MODEL.read_bytes()).hexdigest(),'relaciones_propias':sum(t['group']!='externo' for t in model['tables']),'externas':1,'campos':sum(len(t['columns']) for t in model['tables']),'claves_foraneas':sum(len(t['foreign_keys']) for t in model['tables']),'validacion':'estructura, claves candidatas, tipos, reglas y derivados coherentes','base_de_datos_ejecutada':False}
    report_text=json.dumps(report,ensure_ascii=False,indent=2)+'\n'
    if args.check:
        assert (BASE/'verificacion-estructural.json').read_text(encoding='utf-8')==report_text, 'Informe estructural desactualizado'
    else:
        (BASE/'verificacion-estructural.json').write_text(report_text,encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))

if __name__=='__main__': main()
