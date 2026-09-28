"""Reproduce la estructura SQL del modelo; no aplica cambios a ninguna base."""
import json
from pathlib import Path

root = Path(__file__).resolve().parents[2]
model = json.loads((root/'docs/modelado/modelo.json').read_text(encoding='utf-8'))
target = next((root/'supabase/migrations').glob('*_aulify_relational_core.sql'))
sql = ['-- Modelo relacional 1.0: tablas privadas y restricciones estructurales.',
       'create schema if not exists app;',
       'revoke all on schema app from public, anon, authenticated;',
       'grant usage on schema app to authenticated, service_role;']
for table in model['tables']:
    name = table['name']
    if name == 'auth.users' or table.get('introduced_in'): continue
    columns=[]
    for c in table['columns']:
        if c.get('introduced_in'): continue
        default=''
        if c['name']=='id' and c['type']=='uuid' and name!='profiles': default=' default gen_random_uuid()'
        if c['name'] in ('created_at','updated_at','occurred_at','received_at','requested_at','consumed_at','started_at','published_at') and not c['nullable']: default=' default now()'
        columns.append(f"  {c['name']} {c['type']}{'' if c['nullable'] else ' not null'}{default}")
    columns.append('  primary key ('+', '.join(table['pk'])+')')
    for u in table['unique']: columns.append('  unique ('+', '.join(u)+')')
    sql.append(f"create table app.{name} (\n"+',\n'.join(columns)+'\n);')
    sql.append(f'alter table app.{name} enable row level security;')
for table in model['tables']:
    if table['name']=='auth.users' or table.get('introduced_in'): continue
    name=table['name']
    for i,fk in enumerate(table.get('foreign_keys',[])):
        if fk.get('introduced_in'): continue
        target_name=fk['target'] if fk['target'].startswith('auth.') else 'app.'+fk['target']
        sql.append(f"alter table app.{name} add constraint {name}_fk_{i} foreign key ({', '.join(fk['columns'])}) references {target_name} ({', '.join(fk['target_columns'])}) on delete {fk['on_delete']};")
        keys=[table['pk']]+table['unique']
        if not any(k[:len(fk['columns'])]==fk['columns'] for k in keys):
            sql.append(f"create index {name}_fk_{i}_idx on app.{name} ({', '.join(fk['columns'])});")
sql.extend(['revoke all on all tables in schema app from public, anon, authenticated;',
            'grant all on all tables in schema app to service_role;'])
target.write_text('\n\n'.join(sql)+'\n',encoding='utf-8')
count=sum(t['name']!='auth.users' and not t.get('introduced_in') for t in model['tables'])
print(f'{count} relaciones de la migración inicial generadas: {target.name}')
