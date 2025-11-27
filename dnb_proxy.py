"""
Small local proxy to fetch DNB HTML and return it to the browser.

Usage (PowerShell):
  pip install flask requests flask-cors
  python dnb_proxy.py

Then the page can access DNB at http://localhost:5000/dnb (no CORS restrictions)

Security notes:
- This proxy is intentionally small and only fetches a fixed DNB URL to reduce risk.
- Do not expose this process to the public internet — run it locally on your machine only.
"""
from flask import Flask, Response
import requests
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # allow browser requests from file:// or http://localhost

DNB_URL = (
    "https://www.dnb.no/bedrift/markets/valuta-renter/valutakurser-og-renter/"
    "HistoriskeValutakurser/Hovedvalutaer-innevarende/hovedvalutaerdaglig-innevaerende.html"
)

@app.route('/dnb')
def fetch_dnb():
    """Fetch the DNB page and return raw HTML"""
    try:
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT; rv:115.0) Gecko/20100101 Firefox/115.0'
        }
        r = requests.get(DNB_URL, headers=headers, timeout=15)
        r.raise_for_status()
        return Response(r.text, content_type='text/html; charset=utf-8')
    except Exception as e:
        return Response(str(e), status=502, content_type='text/plain')

if __name__ == '__main__':
    print('\nStarting local DNB proxy server on http://127.0.0.1:5000/dnb')
    print('Note: run this locally; do not expose to public networks')
    app.run(host='127.0.0.1', port=5000)
