"""Run the downloaded Daily Symbol website locally using Python's standard library."""
from pathlib import Path
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from threading import Timer
import webbrowser

root = Path(__file__).resolve().parent / 'web'
if not (root / 'index.html').is_file():
    raise SystemExit('Please extract the complete ZIP before starting the website.')
class FreshHandler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, max-age=0')
        super().end_headers()
handler = partial(FreshHandler, directory=str(root))
server = None
for port in range(8150, 8161):
    try:
        server = ThreadingHTTPServer(('127.0.0.1', port), handler)
        break
    except OSError:
        continue
if server is None:
    raise SystemExit('Local ports 8150-8160 are busy. Close an earlier preview and try again.')
url = f'http://127.0.0.1:{server.server_port}/?v=20261013-six-languages#home'
print(f'Version: 20261013-six-languages\nDaily Symbol is ready: {url}\nKeep this window open. Press Ctrl+C to stop.')
opener = Timer(0.5, lambda: webbrowser.open(url))
opener.daemon = True
opener.start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
finally:
    server.server_close()
