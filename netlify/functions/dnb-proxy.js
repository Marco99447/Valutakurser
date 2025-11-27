const cheerio = require('cheerio');

const DNB_URL = 'https://www.dnb.no/bedrift/markets/valuta-renter/valutakurser-og-renter/HistoriskeValutakurser/Hovedvalutaer-innevarende/hovedvalutaerdaglig-innevaerende.html';

function parseNumberString(s){
  if(!s) return NaN;
  s = s.replace(/\s/g,'');
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let decimalSep = -1;
  if(lastDot > lastComma) decimalSep = '.'; else if(lastComma > lastDot) decimalSep = ',';
  if(decimalSep === -1){
    return parseFloat(s.replace(/[^0-9-]/g,''));
  }
  if(decimalSep === ','){
    s = s.replace(/\./g,'');
    s = s.replace(',', '.');
  } else {
    s = s.replace(/,/g,'');
  }
  return parseFloat(s.replace(/[^0-9.\-]/g,''));
}

exports.handler = async function(event, context){
  try{
    const resp = await fetch(DNB_URL, { headers: { 'User-Agent': 'netlify-dnb-proxy/1.0 (+https://github.com/Marco99447/Valutakurser)' } });
    if(!resp.ok){
      return { statusCode: resp.status, body: `DNB returned HTTP ${resp.status} ${resp.statusText}` };
    }
    const text = await resp.text();
    const $ = cheerio.load(text);

    // Try to find tables that look like currency tables
    const tables = $('table');
    const rates = {};
    let foundDate = null;

    // Try to detect a date string in the page text (YYYY-MM-DD or DD.MM.YYYY)
    const dateMatchIso = text.match(/(\d{4}-\d{2}-\d{2})/);
    if(dateMatchIso) foundDate = dateMatchIso[1];
    const dateMatchDot = text.match(/(\d{2}\.\d{2}\.\d{4})/);
    if(!foundDate && dateMatchDot) foundDate = dateMatchDot[1];

    tables.each((i, table) => {
      const headerText = $(table).find('th').map((i,el)=>$(el).text().toLowerCase()).get().join(' ');
      if(!/valuta|kurs|valutakode|valutae|kursen/i.test(headerText)) return; // skip non-currency tables

      $(table).find('tr').each((ri, tr) => {
        const cellTexts = $(tr).find('td,th').map((i,el)=>$(el).text().trim()).get();
        if(cellTexts.length < 2) return;
        const rowText = cellTexts.join(' | ');
        const codeMatch = rowText.match(/\b([A-Z]{3})\b/);
        if(!codeMatch) return;
        const code = codeMatch[1];
        // find the last numeric-looking token in the row
        const numMatches = rowText.match(/-?\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d+)?/g);
        if(!numMatches || numMatches.length === 0) return;
        const raw = numMatches[numMatches.length - 1];
        const val = parseNumberString(raw);
        if(Number.isFinite(val)){
          rates[code] = val;
        }
      });
    });

    if(Object.keys(rates).length === 0){
      // Fallback: attempt to scan whole page for any currency-like rows
      const textRows = text.split(/\n|\r/).map(r=>r.trim()).filter(Boolean);
      for(const row of textRows){
        const codeMatch = row.match(/\b([A-Z]{3})\b/);
        if(!codeMatch) continue;
        const code = codeMatch[1];
        const numMatches = row.match(/-?\d{1,3}(?:[.,\s]\d{3})*(?:[.,]\d+)?/g);
        if(!numMatches || numMatches.length === 0) continue;
        const raw = numMatches[numMatches.length - 1];
        const val = parseNumberString(raw);
        if(Number.isFinite(val)) rates[code] = val;
      }
    }

    // If we still found no rates, return a 502
    if(Object.keys(rates).length === 0){
      return { statusCode: 502, body: JSON.stringify({ error: 'No rates parsed from DNB page' }) };
    }

    const out = { base: 'NOK', date: foundDate, rates };
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(out)
    };
  }catch(err){
    console.error('dnb proxy error', err && err.stack ? err.stack : err);
    return { statusCode: 500, body: JSON.stringify({ error: String(err) }) };
  }
};
