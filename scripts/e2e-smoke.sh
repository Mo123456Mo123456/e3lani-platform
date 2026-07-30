#!/usr/bin/env bash
set -euo pipefail
API="${API_URL:-http://localhost:4000}"

curl -sf "$API/health" >/dev/null
curl -s -X POST "$API/auth/login" -H 'content-type: application/json' \
  -d "{\"email\":\"${SANDBOX_USER_EMAIL:-explorer@planet-born.local}\",\"password\":\"${SANDBOX_USER_PASSWORD:-Explorer!2026}\"}" \
  >/tmp/pb-login.json
TOKEN=$(python3 -c "import json; print(json.load(open('/tmp/pb-login.json'))['accessToken'])")
curl -s "$API/planets/default" -H "authorization: Bearer $TOKEN" >/tmp/pb-planet.json
python3 - <<'PY'
import json
p=json.load(open('/tmp/pb-planet.json'))
assert p.get('id'), p
land=[r for r in p['regions'] if r['biome']!='ocean']
assert land
open('/tmp/pb-planet-id.txt','w').write(p['id'])
open('/tmp/pb-region-id.txt','w').write(land[0]['id'])
print('planet', p['id'], 'civs', p['stats']['civilizationCount'])
PY

curl -s -X POST "$API/contributions/analyze" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"text":"نبات يمتص التلوث ويضيء ليلا","categoryHint":"plant","locale":"ar"}' >/tmp/pb-analyze.json

python3 - <<'PY'
import json
a=json.load(open('/tmp/pb-analyze.json'))
el=a.get('element') or a.get('balanced')
assert el and el.get('category')
el.setdefault('benefits', ['clean_air'])
el.setdefault('risks', ['water'])
el.setdefault('possibleBiomes', ['rainforest'])
el.setdefault('balanceScore', 0.7)
el.setdefault('wasBalanced', False)
el.setdefault('description', el.get('description') or 'plant')
el.setdefault('traits', {"size":0.7,"growthRate":0.3,"waterNeed":0.6,"heatResistance":0.5,"coldResistance":0.4})
body={"planetId":open('/tmp/pb-planet-id.txt').read(),"regionId":open('/tmp/pb-region-id.txt').read(),"element":el}
json.dump(body, open('/tmp/pb-create.json','w'), ensure_ascii=False)
print('analyze', el['category'], 'sandbox', a.get('sandbox'))
PY

curl -s -X POST "$API/contributions" -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  --data-binary @/tmp/pb-create.json >/tmp/pb-result.json
python3 - <<'PY'
import json
c=json.load(open('/tmp/pb-result.json'))
assert 'contribution' in c, c
assert c['contribution']['status']=='applied', c['contribution']
assert c.get('events'), c
print('e2e ok', c['contribution']['id'], 'events', len(c['events']))
PY
