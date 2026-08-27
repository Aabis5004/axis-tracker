import http.server, socketserver, urllib.request, urllib.error, ssl, json, threading, time, os

ssl_ctx = ssl.create_default_context()
API = 'https://hub.axisrobotics.ai/api/stats/leaderboard'

def load_or_fetch():
    # If data.json exists and is less than 30 min old, use it
    if os.path.exists('data.json'):
        age = time.time() - os.path.getmtime('data.json')
        if age < 300:
            print(f"Using cached data.json ({int(age)}s old)")
            return
        print(f"data.json is {int(age)}s old, refreshing...")
    fetch_and_save()

def fetch_and_save():
    data = {'trajectories':[],'points':[],'traj_total':0,'pts_total':0,'updated':'','loading':False}
    for board in ['trajectories','points']:
        entries = []
        total = 0
        for page in range(1, 51):
            for attempt in range(3):
                try:
                    url = f"{API}?board={board}&window=all&sort={board}&page={page}&per_page=50"
                    req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0','Accept':'application/json'})
                    with urllib.request.urlopen(req, timeout=30, context=ssl_ctx) as r:
                        d = json.loads(r.read())
                        if page==1: total=d.get('total',0)
                        items=d.get('entries',[])
                        if items: entries.extend(items)
                        print(f"  {board}: {page}/50 ({len(entries)})")
                        break
                except Exception as e:
                    print(f"  {board} p{page} try{attempt+1}: {e}")
                    time.sleep(2*(attempt+1))
            time.sleep(0.5)
        if board=='trajectories': data['trajectories']=entries; data['traj_total']=total
        else: data['points']=entries; data['pts_total']=total
    data['updated']=time.strftime('%I:%M:%S %p')
    with open('data.json','w') as f: json.dump(data,f)
    print(f"Saved! T:{len(data['trajectories'])} P:{len(data['points'])}")

def bg_refresh():
    while True:
        time.sleep(1800)
        try: fetch_and_save()
        except: pass

class H(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path=='/api/refresh':
            threading.Thread(target=fetch_and_save, daemon=True).start()
            self.send_response(200)
            self.send_header('Content-Type','application/json')
            self.end_headers()
            self.wfile.write(b'{"status":"refreshing"}')
        elif self.path=='/api/data':
            try:
                with open('data.json','r') as f: body=f.read().encode()
                self.send_response(200)
                self.send_header('Content-Type','application/json')
                self.send_header('Content-Length',str(len(body)))
                self.end_headers()
                self.wfile.write(body)
            except:
                self.send_response(200)
                self.end_headers()
                self.wfile.write(b'{"trajectories":[],"points":[],"traj_total":0,"pts_total":0,"updated":"","loading":true}')
        else: super().do_GET()
    def log_message(self,*a): pass

PORT=8081
class S(socketserver.TCPServer):
    allow_reuse_address=True

# Start server immediately, fetch in background
threading.Thread(target=load_or_fetch, daemon=True).start()
threading.Thread(target=bg_refresh, daemon=True).start()
print(f"http://localhost:{PORT}/index.html - Server ready!")
print("Data fetching in background. Saves to data.json.")
print("Next time you start, it loads instantly from cache!\n")
with S(("",PORT),H) as h:
    h.serve_forever()
