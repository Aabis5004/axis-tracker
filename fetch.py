import urllib.request, urllib.error, ssl, json, time

ssl_ctx = ssl.create_default_context()
API = 'https://hub.axisrobotics.ai/api/stats/leaderboard'

def fetch_and_save():
    print("Starting fetch...")
    data = {'trajectories':[],'points':[],'traj_total':0,'pts_total':0,'updated':'','loading':False}
    
    for board in ['trajectories','points']:
        entries = []
        total = 0
        for page in range(1, 51):
            for attempt in range(3):
                try:
                    url = f"{API}?board={board}&window=all&sort={board}&page={page}&per_page=50"
                    req = urllib.request.Request(url, headers={'User-Agent':'Mozilla/5.0'})
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
            
        if board=='trajectories': 
            data['trajectories']=entries
            data['traj_total']=total
        else: 
            data['points']=entries
            data['pts_total']=total
            
    data['updated']=time.strftime('%I:%M:%S %p')
    with open('data.json','w') as f: json.dump(data,f)
    print(f"Saved! Trajectories: {len(data['trajectories'])} | Points: {len(data['points'])}")

if __name__ == '__main__':
    fetch_and_save()
