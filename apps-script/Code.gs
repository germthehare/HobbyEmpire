// ============================================================
// HOBBY EMPIRE — Google Apps Script Web App
// Déployer comme Web App: Execute as "Me", Access "Anyone"
// ============================================================

const SPREADSHEET_ID = '1kkDvIyN7Be8nppQlwhjxWkGto3FZr4lLzKrMfIpy9Uk';
const SHEET_NAME = 'SAISIE_BREAKS';
const DATA_START_ROW = 4; // Les données commencent à la ligne 4 (après titre + en-têtes)

// Colonnes dans SAISIE_BREAKS (ordre exact)
// A: Stream ID | B: Date | C: Vendeur | D: Helper | E: Catégorie
// F: Sport/Licence | G: Type break | H: Nom break | I: Durée (min)
// J: Rev/heure ($) | K: Semaine | L: Mois | M: Année | N: Jour
// O: Ventes brutes ($) | P: % WN | Q: Revenu réel ($) | R: Bénéfice net ($)
// S: Bonus vendeur ($) | T: Bonus helper ($) | U: Bonus total ($) | V: Marge réelle (%)
// W: Coût des produits ($) | X: Heure de début

function doGet(e) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    const lastRow = sheet.getLastRow();

    if (lastRow < DATA_START_ROW) {
      return jsonResponse([]);
    }

    const numRows = lastRow - DATA_START_ROW + 1;
    const range = sheet.getRange(DATA_START_ROW, 1, numRows, 24);
    const values = range.getValues();

    const breaks = values
      .filter(row => row[0] !== '' && row[1] !== '') // Filtre lignes vides
      .map(row => ({
        streamId:      row[0],
        date:          formatDate(row[1]),
        vendeur:       row[2],
        helper:        row[3],
        categorie:     row[4],
        sport:         row[5],
        typeBreak:     row[6],
        nomBreak:      row[7],
        duree:         row[8],
        revHeure:      row[9],
        semaine:       row[10],
        mois:          row[11],
        annee:         row[12],
        jour:          row[13],
        ventesBrutes:  row[14],
        pctWN:         row[15],
        revenuReel:    row[16],
        beneficeNet:   row[17],
        bonusVendeur:  row[18],
        bonusHelper:   row[19],
        bonusTotal:    row[20],
        marge:         row[21],
        coutProduits:  row[22] || 0,
        heureDebut:    row[23] || ''
      }));

    return jsonResponse(breaks);
  } catch(err) {
    return jsonResponse({ error: err.toString() }, 500);
  }
}

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);

    // Générer le Stream ID (format: YYYY-MM-DD-A, YYYY-MM-DD-B, ...)
    const streamId = generateStreamId(sheet, data.date);

    // Calculs
    const duree = parseFloat(data.duree) || 0;
    const revHeure = parseFloat(data.revHeure) || 0;
    const pctWN = parseFloat(data.pctWN) || 0;
    const coutProduits = parseFloat(data.coutProduits) || 0;
    const ventesBrutes = (duree / 60) * revHeure;
    const revenuReel = ventesBrutes * (1 - pctWN / 100);
    const beneficeNet = revenuReel - coutProduits;
    const marge = revenuReel > 0 ? (beneficeNet / revenuReel * 100) : 0;

    // Date parsing
    const dateObj = new Date(data.date + 'T12:00:00');
    const semaine = getWeekNumber(dateObj);
    const mois = dateObj.getMonth() + 1;
    const annee = dateObj.getFullYear();
    const jours = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const jour = jours[dateObj.getDay()];

    // Nouvelle ligne
    const newRow = [
      streamId,                  // A: Stream ID
      data.date,                 // B: Date
      data.vendeur,              // C: Vendeur
      data.helper || '',         // D: Helper
      data.categorie,            // E: Catégorie
      data.sport,                // F: Sport/Licence
      data.typeBreak,            // G: Type break
      data.nomBreak,             // H: Nom break
      duree,                     // I: Durée (min)
      revHeure,                  // J: Rev/heure ($)
      semaine,                   // K: Semaine
      mois,                      // L: Mois
      annee,                     // M: Année
      jour,                      // N: Jour
      ventesBrutes,              // O: Ventes brutes ($)
      pctWN / 100,               // P: % WN (en décimal)
      revenuReel,                // Q: Revenu réel ($)
      beneficeNet,               // R: Bénéfice net ($)
      0,                         // S: Bonus vendeur
      0,                         // T: Bonus helper
      0,                         // U: Bonus total
      marge / 100,               // V: Marge réelle (en décimal)
      coutProduits,              // W: Coût des produits ($)
      data.heureDebut || ''      // X: Heure de début
    ];

    sheet.appendRow(newRow);

    return jsonResponse({ success: true, streamId: streamId });
  } catch(err) {
    return jsonResponse({ error: err.toString() }, 500);
  }
}

// ── Helpers ──────────────────────────────────────────────────

function generateStreamId(sheet, date) {
  const lastRow = sheet.getLastRow();
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let count = 0;

  if (lastRow >= DATA_START_ROW) {
    const ids = sheet.getRange(DATA_START_ROW, 1, lastRow - DATA_START_ROW + 1, 1).getValues();
    ids.forEach(row => {
      if (String(row[0]).startsWith(date + '-')) count++;
    });
  }

  return date + '-' + (letters[count] || String(count + 1));
}

function formatDate(val) {
  if (!val) return '';
  if (val instanceof Date) {
    const y = val.getFullYear();
    const m = String(val.getMonth() + 1).padStart(2, '0');
    const d = String(val.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + d;
  }
  return String(val);
}

function getWeekNumber(d) {
  const onejan = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((((d - onejan) / 86400000) + onejan.getDay() + 1) / 7);
}

function jsonResponse(data, status) {
  const output = ContentService.createTextOutput(JSON.stringify(data));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}
