// ============================================================
// api.gs - Web管理画面用 API (Phase 1)
// 設計: docs/miesan-webapp-handoff.md セクション2〜3
//
// GET  ?action=bootstrap&key=...          初回ロード(生徒一覧+FB承認キュー)
// GET  ?action=student&id=<sheetId>&key=... 生徒詳細(遅延取得)
// POST ?action=approve                    FB承認 body(text/plain JSON): {uuid, finalText, key}
//
// doPost本体はコード.js側。?action= 付きPOSTのみ handleApiPost に分岐する。
// ============================================================

var TRACKING_SHEET_NAME = 'トラッキング';
var STUDY_LOG_SHEET_NAME = '勉強時間ログ';
var STUDENT_ADMIN_TAB_NAME = '生徒管理';

// ============================================================
// エントリポイント
// ============================================================
function doGet(e) {
  try {
    var params = (e && e.parameter) || {};
    if (!isApiAuthorized(params.key)) {
      return jsonOutput({ error: 'unauthorized' });
    }
    if (params.action === 'bootstrap') {
      return jsonOutput(apiBootstrap());
    }
    if (params.action === 'student') {
      return jsonOutput(apiStudent(params.id));
    }
    return jsonOutput({ error: 'unknown_action' });
  } catch (err) {
    Logger.log('doGet エラー: ' + err.toString());
    return jsonOutput({ error: 'internal', message: err.toString() });
  }
}

// doPost(コード.js)から ?action= 付きPOSTのみ呼ばれる
function handleApiPost(e) {
  try {
    var body = {};
    try {
      body = JSON.parse((e.postData && e.postData.contents) || '{}');
    } catch (ignore) {
      // text/plain以外や壊れたJSONは空bodyとして扱う
    }
    var key = body.key || (e.parameter && e.parameter.key);
    if (!isApiAuthorized(key)) {
      return jsonOutput({ error: 'unauthorized' });
    }
    var action = (e.parameter && e.parameter.action) || body.action;
    if (action === 'approve') {
      return jsonOutput(apiApprove(body.uuid, body.finalText));
    }
    return jsonOutput({ error: 'unknown_action' });
  } catch (err) {
    Logger.log('handleApiPost エラー: ' + err.toString());
    return jsonOutput({ error: 'internal', message: err.toString() });
  }
}

// ============================================================
// 認証・共通
// ============================================================
function isApiAuthorized(key) {
  var expected = PropertiesService.getScriptProperties().getProperty('WEBAPP_API_KEY');
  return !!expected && key === expected;
}

function jsonOutput(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function openAdminSpreadsheet() {
  var adminId = PropertiesService.getScriptProperties().getProperty('ADMIN_SHEET_ID');
  return SpreadsheetApp.openById(adminId);
}

// ============================================================
// GET ?action=bootstrap
// ============================================================
function apiBootstrap() {
  return {
    students: getStudentList(),
    queue: getFeedbackQueue(),
    generatedAt: new Date().toISOString(),
  };
}

// 生徒管理タブ A〜I列 → 生徒一覧(activeのみ)
// F〜I列が空欄の生徒はデフォルト値(コース="-", 目標WPM=90, 月間目標時間=60)
function getStudentList() {
  var sheet = openAdminSpreadsheet().getSheetByName(STUDENT_ADMIN_TAB_NAME);
  if (!sheet) return [];
  var rows = sheet.getDataRange().getValues();
  var students = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    var status = (r[3] || '').toString().toLowerCase().trim();
    if (status !== 'active') continue;
    students.push({
      id: (r[2] || '').toString().trim(),
      name: (r[1] || '').toString().trim(),
      course: r[5] ? r[5].toString().trim() : '-',
      startMonth: formatMonthValue(r[6]),
      goalWpm: Number(r[7]) || 90,
      monthlyTargetH: Number(r[8]) || 60,
      status: 'active',
    });
  }
  return students;
}

// FB候補タブ → 承認キュー(K列が「送信済み」以外の行)
// K〜M空欄の既存行は「待ち」扱い。UUID未付与の行はこの時点でM列に補完する
// (フロントがapproveでUUID指定できるようにするため)
function getFeedbackQueue() {
  var sheet = openAdminSpreadsheet().getSheetByName(FEEDBACK_SHEET_NAME);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  var rows = sheet.getRange(2, 1, lastRow - 1, 13).getValues();
  var queue = [];
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    var status = (r[10] || '').toString().trim();
    if (status === '送信済み') continue;

    var uuid = (r[12] || '').toString().trim();
    if (!uuid) {
      uuid = Utilities.getUuid();
      sheet.getRange(i + 2, 13).setValue(uuid);
    }

    queue.push({
      uuid: uuid,
      datetime: formatDateTimeValue(r[0]),
      type: (r[1] || '').toString(),
      student: (r[2] || '').toString(),
      score1: (r[3] || '').toString(),
      score2: (r[4] || '').toString(),
      transcript: (r[5] || '').toString(),
      fbs: [
        (r[6] || '').toString(),
        (r[7] || '').toString(),
        (r[8] || '').toString(),
      ],
      note: (r[9] || '').toString(),
    });
  }
  return queue;
}

// ============================================================
// GET ?action=student&id=<sheetId>
// ============================================================
function apiStudent(sheetId) {
  if (!sheetId) return { error: 'missing_id' };

  var students = getStudentList();
  var student = null;
  for (var i = 0; i < students.length; i++) {
    if (students[i].id === sheetId) { student = students[i]; break; }
  }
  if (!student) return { error: 'not_found' };

  var ss;
  try {
    ss = SpreadsheetApp.openById(sheetId);
  } catch (err) {
    Logger.log('apiStudent: シートを開けません ' + sheetId + ' ' + err.toString());
    return { error: 'sheet_unavailable' };
  }

  var speeches = readSpeechHistory(ss);
  return {
    student: student,
    speeches: speeches,
    monthly: aggregateSpeechesByMonth(speeches),
    materials: readTracking(ss),
    study: readStudyLog(student.name),
    generatedAt: new Date().toISOString(),
  };
}

// 1分スピーチタブ: B列=日付, D列=WPM, E列=文字起こし(3行目から)
// タブがなければ空配列(エラーにしない)
function readSpeechHistory(ss) {
  var sheet = ss.getSheetByName(ONE_MIN_SHEET_NAME);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 3) return [];

  var rows = sheet.getRange(3, 2, lastRow - 2, 4).getValues(); // B〜E
  var speeches = [];
  for (var i = 0; i < rows.length; i++) {
    var date = rows[i][0];
    var wpm = Number(rows[i][2]);
    if (!date || !wpm) continue;
    speeches.push({ date: formatDateValue(date), wpm: wpm });
  }
  return speeches;
}

// 月次集計: [{month:'2026-06', avgWpm, count}]
function aggregateSpeechesByMonth(speeches) {
  var byMonth = {};
  var order = [];
  for (var i = 0; i < speeches.length; i++) {
    var month = (speeches[i].date || '').substring(0, 7).replace('/', '-');
    if (!month) continue;
    if (!byMonth[month]) { byMonth[month] = { sum: 0, count: 0 }; order.push(month); }
    byMonth[month].sum += speeches[i].wpm;
    byMonth[month].count++;
  }
  var monthly = [];
  for (var j = 0; j < order.length; j++) {
    var m = order[j];
    monthly.push({
      month: m,
      avgWpm: Math.round(byMonth[m].sum / byMonth[m].count),
      count: byMonth[m].count,
    });
  }
  return monthly;
}

// トラッキングタブ: A列=教材名, B列=完了範囲数, C列=総範囲数
// ヘッダー行の有無に依存しないよう、B/Cが数値の行のみ採用する
function readTracking(ss) {
  var sheet = ss.getSheetByName(TRACKING_SHEET_NAME);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];

  var rows = sheet.getRange(1, 1, lastRow, 3).getValues();
  var materials = [];
  for (var i = 0; i < rows.length; i++) {
    var name = (rows[i][0] || '').toString().trim();
    if (!name) continue;
    var done = Number(rows[i][1]);
    var total = Number(rows[i][2]);
    if (isNaN(done) || isNaN(total) || rows[i][2] === '') continue;
    materials.push({ name: name, done: done, total: total });
  }
  return materials;
}

// 管理シート 勉強時間ログ: A列=日付, B列=生徒名, C列=時間(h)
function readStudyLog(studentName) {
  var sheet = openAdminSpreadsheet().getSheetByName(STUDY_LOG_SHEET_NAME);
  if (!sheet) return [];
  var lastRow = sheet.getLastRow();
  if (lastRow < 1) return [];

  var rows = sheet.getRange(1, 1, lastRow, 3).getValues();
  var entries = [];
  for (var i = 0; i < rows.length; i++) {
    var date = rows[i][0];
    var name = (rows[i][1] || '').toString().trim();
    var hours = Number(rows[i][2]);
    if (!date || name !== studentName || !hours) continue;
    entries.push({ date: formatDateValue(date), hours: hours });
  }
  return entries;
}

// ============================================================
// POST ?action=approve  {uuid, finalText}
// FB候補タブの該当行を K=送信済み, L=最終FB文面 に更新
// ============================================================
function apiApprove(uuid, finalText) {
  if (!uuid) return { error: 'missing_uuid' };

  var sheet = openAdminSpreadsheet().getSheetByName(FEEDBACK_SHEET_NAME);
  if (!sheet) return { error: 'sheet_not_found' };
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return { error: 'not_found' };

  var uuidCol = sheet.getRange(2, 13, lastRow - 1, 1).getValues();
  for (var i = 0; i < uuidCol.length; i++) {
    if ((uuidCol[i][0] || '').toString().trim() === uuid) {
      var row = i + 2;
      sheet.getRange(row, 11).setValue('送信済み');     // K
      sheet.getRange(row, 12).setValue(finalText || ''); // L
      return { ok: true };
    }
  }
  return { error: 'not_found' };
}

// ============================================================
// 値フォーマット(セルがDate型でも文字列でも吸収する)
// ============================================================
function formatDateValue(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy/MM/dd');
  }
  return (v || '').toString();
}

function formatDateTimeValue(v) {
  if (v instanceof Date) {
    return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm');
  }
  return (v || '').toString();
}

function formatMonthValue(v) {
  if (!v) return '-';
  if (v instanceof Date) {
    return Utilities.formatDate(v, 'Asia/Tokyo', 'yyyy-MM');
  }
  return v.toString();
}

// ============================================================
// 生徒オンボーディング自動化 (設計書2.4)
// ============================================================

// テンプレ複製 → リネーム → 生徒管理に行追加 → 新シートURLを返す
function createStudentSheet(name, userId) {
  var templateId = PropertiesService.getScriptProperties().getProperty('TEMPLATE_SHEET_ID');
  if (!templateId) {
    throw new Error('スクリプトプロパティ TEMPLATE_SHEET_ID が未設定です');
  }
  var copy = DriveApp.getFileById(templateId).makeCopy('【生徒】' + name);
  var newSheetId = copy.getId();

  var adminTab = openAdminSpreadsheet().getSheetByName(STUDENT_ADMIN_TAB_NAME);
  adminTab.appendRow([userId, name, newSheetId, 'active']);

  Logger.log('生徒シート作成: ' + name + ' / ' + newSheetId);
  return 'https://docs.google.com/spreadsheets/d/' + newSheetId + '/edit';
}

// 管理シートのカスタムメニュー
function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('🎓 生徒管理')
    .addItem('新しい生徒を追加', 'menuAddStudent')
    .addItem('シート規約チェックを実行', 'validateStudentSheets')
    .addSeparator()
    .addItem('ビハインド通知トリガーを設定(毎日21時)', 'setupDailyBehindTrigger')
    .addItem('今すぐビハインド判定を実行(テスト)', 'runDailyBehindCheck')
    .addSeparator()
    .addItem('振り返りリマインダーを設定(毎月25日)', 'setupReflectionReminderTrigger')
    .addItem('今月の振り返りリマインドを送信(テスト)', 'sendReflectionReminders')
    .addToUi();
}

function menuAddStudent() {
  var ui = SpreadsheetApp.getUi();

  var nameRes = ui.prompt('🎓 新しい生徒を追加',
    '生徒の名前を入力してください', ui.ButtonSet.OK_CANCEL);
  if (nameRes.getSelectedButton() !== ui.Button.OK) return;
  var name = nameRes.getResponseText().trim();
  if (!name) { ui.alert('名前が空です。やり直してください。'); return; }

  var idRes = ui.prompt('🎓 新しい生徒を追加',
    name + 'さんのLINE ID を入力してください\n(生徒がLINEで「#登録」と送ると届くIDです)',
    ui.ButtonSet.OK_CANCEL);
  if (idRes.getSelectedButton() !== ui.Button.OK) return;
  var userId = idRes.getResponseText().trim();
  if (!userId) { ui.alert('LINE IDが空です。やり直してください。'); return; }

  try {
    var url = createStudentSheet(name, userId);
    ui.alert('✅ ' + name + 'さんを登録しました!\n\n生徒シート:\n' + url);
  } catch (err) {
    ui.alert('⚠️ 登録に失敗しました:\n' + err);
  }
}

// ============================================================
// 規約破壊の自動検知 (設計書2.4)
// 週1の時間主導トリガーで実行(setupWeeklyValidationTriggerで設定)
// ============================================================
function validateStudentSheets() {
  var REQUIRED_TABS = [ONE_MIN_SHEET_NAME, TRACKING_SHEET_NAME];
  var students = getStudentList();
  var problems = [];

  for (var i = 0; i < students.length; i++) {
    var s = students[i];
    if (!s.id) {
      problems.push(s.name + ': sheet_idが空です');
      continue;
    }
    var ss;
    try {
      ss = SpreadsheetApp.openById(s.id);
    } catch (err) {
      problems.push(s.name + ': シートを開けません(' + s.id + ')');
      continue;
    }
    for (var t = 0; t < REQUIRED_TABS.length; t++) {
      if (!ss.getSheetByName(REQUIRED_TABS[t])) {
        problems.push(s.name + ': 「' + REQUIRED_TABS[t] + '」タブがありません');
      }
    }
  }

  if (problems.length > 0) {
    notifyMiesan('⚠️ 生徒シートの規約チェックで問題が見つかりました:\n\n' + problems.join('\n'));
    Logger.log('validateStudentSheets: ' + problems.length + '件の問題\n' + problems.join('\n'));
  } else {
    Logger.log('validateStudentSheets: 全生徒OK (' + students.length + '名)');
  }
  return problems;
}

// 週1(月曜9時)のトリガーを設定する。一度手動実行すればOK
function setupWeeklyValidationTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'validateStudentSheets') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('validateStudentSheets')
    .timeBased()
    .everyWeeks(1)
    .onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(9)
    .create();
  Logger.log('validateStudentSheets の週次トリガー(月曜9時)を設定しました');
}
