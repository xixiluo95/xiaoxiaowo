import os, sys, json, base64, urllib.request

env = {}
with open('/home/xixil/xiaoxiaowo/.env') as f:
    for line in f:
        line = line.strip()
        if line and not line.startswith('#') and '=' in line:
            k, v = line.split('=', 1)
            env[k.strip()] = v.strip().strip('"').strip("'")

key = env.get('MINIMAX_API_KEY')
base = env.get('MINIMAX_BASE_URL', 'https://api.minimaxi.com/v1').rstrip('/')
if not key:
    sys.exit('no MINIMAX_API_KEY')

prompt = sys.argv[1]
out = sys.argv[2]
body = {
    "model": "image-01",
    "prompt": prompt,
    "aspect_ratio": "9:16",
    "response_format": "base64",
    "n": 1,
}
req = urllib.request.Request(
    base + '/v1/image_generation',
    data=json.dumps(body).encode(),
    headers={'Authorization': 'Bearer ' + key, 'Content-Type': 'application/json'},
)
with urllib.request.urlopen(req, timeout=180) as r:
    resp = json.load(r)
if resp.get('base_resp', {}).get('status_code') not in (0, None):
    print(json.dumps(resp.get('base_resp'), ensure_ascii=False)); sys.exit(1)
imgs = resp.get('data', {}).get('image_base64') or []
if not imgs:
    print(json.dumps(resp, ensure_ascii=False)[:2000]); sys.exit(1)
with open(out, 'wb') as f:
    f.write(base64.b64decode(imgs[0]))
print('saved', out, os.path.getsize(out))
