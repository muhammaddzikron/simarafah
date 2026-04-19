/**
 * Apps Script code to handle requests from the React app.
 * Paste this in App Script editor.
 */

const SPREADSHEET_ID = '14W48hU9eYzxZ5EkjGGSTs1WCTzITV02QooOoo7lYix0';

function doGet(e) {
  const action = e.parameter.action;
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[0];
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);

  const jemaahList = rows.map(row => {
    let obj = {};
    headers.forEach((header, i) => {
      obj[header.toLowerCase().replace(/\s/g, '_')] = row[i];
    });
    return obj;
  });

  if (action === 'getJemaah') {
    return ContentService.createTextOutput(JSON.stringify(jemaahList))
      .setMimeType(ContentService.MimeType.JSON);
  }

  return ContentService.createTextOutput(JSON.stringify({ status: 'ok' }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const postData = JSON.parse(e.postData.contents);
  const action = postData.action;

  if (action === 'register') {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheets()[1]; // Assuming sheet 2 for registrations
    sheet.appendRow([
      postData.nomorPorsi,
      postData.namaLengkap,
      postData.alamat,
      postData.tempatTanggalLahir,
      postData.jenisKelamin,
      postData.statusPernikahan,
      postData.namaIbuKandung,
      postData.wa,
      postData.statusKesehatan,
      postData.uploadLinks.ktp,
      postData.uploadLinks.porsi,
      postData.uploadLinks.kk,
      postData.uploadLinks.pasFoto,
      new Date()
    ]);
    return ContentService.createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
