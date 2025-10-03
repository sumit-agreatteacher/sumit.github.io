/**
 * characters.js (CSV-driven, unified list)
 * Loads ALL characters from characters_unified.csv into global `window.characters`.
 * Keeps the same shape the rest of the game expects: a single array of character objects.
 * Uses synchronous XHR for simplicity & compatibility (no race conditions with game.js).
 */
(function(){
  var CSV_URL = 'characters_unified.csv';

  var NUM_FIELDS = [
    'energy',
    'energyGainatDorm','energyLossatOffice','energyLossatLab','energyLossatLecture',
    'energyGainatBar','energyGainatBarProbability','energyLossatBar','energyLossatBarProbability',
    'fundingGainatOffice','fundingGainatOfficeProbability',
    'fundingLossatLab','fundingLossatLabProbability',
    'progressGainatLab','progressGainatLabProbability','progressLossatLab','progressLossatLabProbability',
    'respectGainatLecture','respectGainatLectureProbability',
    'respectGainatBar','respectGainatBarProbability','respectLossatBar','respectLossatBarProbability',
    'gotobarProbability','level'
  ];
  var BOOL_FIELDS = ['hired'];

  function parseCSV(text) {
    var rows = [];
    var i = 0, len = text.length;
    var field = '', row = [], inQuotes = false;

    function endField(){ row.push(field); field=''; }
    function endRow(){ rows.push(row); row=[]; }

    while (i < len) {
      var ch = text[i++];
      if (inQuotes) {
        if (ch === '"') {
          if (i < len && text[i] === '"') { field += '"'; i++; }
          else { inQuotes = false; }
        } else { field += ch; }
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') endField();
        else if (ch === '\n') { endField(); endRow(); }
        else if (ch === '\r') { /* ignore CR */ }
        else field += ch;
      }
    }
    if (field.length > 0 || row.length > 0) { endField(); endRow(); }
    return rows;
  }

  function coerceTypes(obj) {
    NUM_FIELDS.forEach(function(k){
      if (obj.hasOwnProperty(k) && obj[k] !== '') {
        var v = Number(obj[k]);
        if (!isNaN(v)) obj[k] = v;
      }
    });
    BOOL_FIELDS.forEach(function(k){
      if (obj.hasOwnProperty(k)) {
        var v = (''+obj[k]).trim().toLowerCase();
        obj[k] = (v === 'true' || v === '1' || v === 'yes');
      }
    });
    if (obj.location === '') obj.location = null;
    return obj;
  }

  function loadCSVSync(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    try {
      xhr.send(null);
      if ((xhr.status >= 200 && xhr.status < 300) || xhr.status === 0) {
        return xhr.responseText;
      }
    } catch(e) { console.error('Failed to load CSV:', e); }
    return '';
  }

  var csvText = loadCSVSync(CSV_URL);
  if (!csvText) { console.warn('characters_unified.csv missing/empty'); window.characters = []; return; }

  var rows = parseCSV(csvText);
  if (!rows.length) { window.characters = []; return; }

  var header = rows[0];
  var data = rows.slice(1).filter(function(r){ return r.some(function(c){return (c||'').trim()!=='';}); });

  var out = data.map(function(r){
    var obj = {};
    for (var i=0;i<header.length;i++){
      var key = header[i];
      var val = (i < r.length) ? r[i] : '';
      obj[key] = val;
    }
    return coerceTypes(obj);
  });

  window.characters = out;
  try { document.dispatchEvent(new CustomEvent('characters-ready', { detail: out })); } catch(e){}
})();