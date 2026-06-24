// ============================================================
// tracking.js (GAS上では tracking.gs) - Phase 5 Step 1
// 勉強時間ベースのビハインド通知
// 設計: docs/phase5-tracking-requirements.md
//
// 構成:
//  - #時間 コマンド(handleTimeReport) … コード.js の doPost から呼ばれる
//  - 毎日21時の判定(runDailyBehindCheck) … setupDailyBehindTrigger で登録
//  - 通知ログタブ(NOTIFY_LOG_SHEET_NAME) … クールダウン判定＋送信履歴
//
// 依存(既存・グローバル): getConfig() / replyToUser() (コード.js),
//   STUDENT_ADMIN_TAB_NAME / STUDY_LOG_SHEET_NAME (api.js)
// ============================================================

var NOTIFY_LOG_SHEET_NAME = '通知ログ';

// 判定パラメータ(要件メモの決定値。ここを変えれば挙動を調整できる)
var BEHIND_RATE_THRESHOLD = 0.8;   // 累積達成率がこれ未満で通知
var BEHIND_COOLDOWN_DAYS = 3;      // 前回通知からこの日数未満なら送らない(中3日)
var BEHIND_PERDAY_CAP_H = 2;       // 1日あたり補填がこれを超えたら数値を出さず「ペース相談」に

// ============================================================
// #時間 1.5 → 勉強時間ログに記録(コード.js doPost から呼ばれる)
// ============================================================
function handleTimeReport(student, txt, config, replyToken) {
  var m = /#時間\s*([0-9]+(?:\.[0-9]+)?)/.exec(txt);
  if (!m) {
    replyToUser(config.LINE_TOKEN, replyToken,
      '⏱ 勉強時間の記録は「#時間 1.5」のように数字をつけて送ってください😊');
    return;
  }
  var hours = Number(m[1]);
  if (!(hours > 0) || hours > 24) {
    replyToUser(config.LINE_TOKEN, replyToken,
      '⏱ 時間は0より大きく24以下で入力してください（例：#時間 1.5）');
    return;
  }
  try {
    var ss = openAdminSpreadsheet_();
    var sh = getOrCreateSheet_(ss, STUDY_LOG_SHEET_NAME, ['日付', '生徒名', '時間(h)']);
    sh.appendRow([Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd'), student.name, hours]);

    var now = new Date();
    var total = sumStudyHoursInMonth_(student.name, now.getFullYear(), now.getMonth() + 1);
    replyToUser(config.LINE_TOKEN, replyToken,
      '⏱ ' + round1_(hours) + '時間 を記録しました！\n今月の合計は ' + round1_(total) + '時間です。よく頑張っていますね😊');
  } catch (err) {
    Logger.log('handleTimeReport エラー: ' + err.toString());
    replyToUser(config.LINE_TOKEN, replyToken, '⏱ 記録中にエラーが発生しました。もう一度お試しください。');
  }
}

// ============================================================
// 毎日21時: 全active生徒のビハインドを判定し、対象にのみ通知
// ============================================================
function runDailyBehindCheck() {
  var now = new Date();
  var y = now.getFullYear();
  var mo = now.getMonth() + 1;
  var day = now.getDate();
  var daysInMonth = new Date(y, mo, 0).getDate();

  var students = readActiveStudentsWithTargets_();
  var sent = 0;

  for (var i = 0; i < students.length; i++) {
    var s = students[i];
    if (!s.userId) continue;

    var actual = sumStudyHoursInMonth_(s.name, y, mo);
    var proratedTarget = s.targetH * day / daysInMonth; // 日割り目標(設計書6.3)
    if (proratedTarget <= 0) continue;

    var rate = actual / proratedTarget;
    if (rate >= BEHIND_RATE_THRESHOLD) continue; // 順調なら送らない

    // クールダウン: 前回の時間ビハインド通知から中3日空ける
    var last = getLastBehindNotifyDate_(s.name);
    if (last && dayDiff_(last, now) < BEHIND_COOLDOWN_DAYS) continue;

    var ratePct = Math.round(rate * 100);
    var daysRemaining = Math.max(1, daysInMonth - day);
    var shortfall = Math.max(0, s.targetH - actual); // 月末まで満たすのに必要な残り時間
    var perDay = shortfall / daysRemaining;

    var msg = buildBehindMessage_(s.name, actual, ratePct, perDay, daysRemaining);
    pushLineMessage_(s.userId, msg);
    appendNotifyLog_(s.name, '時間', ratePct, msg);
    sent++;
  }

  Logger.log('runDailyBehindCheck: ' + sent + '件のビハインド通知を送信(' + students.length + '名中)');
  return sent;
}

// 案A(励まし寄り)の文面。トーン変更はこの関数だけ直せばよい
function buildBehindMessage_(name, actualH, ratePct, perDay, daysRemaining) {
  var head = name + 'さん、お疲れさまです🌿 今月はここまで' + round1_(actualH) + '時間、よく続けられていますね。';
  var body;
  if (perDay <= BEHIND_PERDAY_CAP_H) {
    body = '目標まではあと少し。残り' + daysRemaining + '日で1日あたり' + formatPerDay_(perDay) + 'プラスできれば届くペースです。';
  } else {
    body = '目標まで少し距離がありますが、焦らなくて大丈夫。ペースの組み直しを、みえさんと一緒に考えてみましょう。';
  }
  var tail = '無理なく、できる範囲で一緒に進めましょう😊';
  return head + '\n' + body + '\n' + tail;
}

// ============================================================
// トリガー管理(一度手動実行すればOK)
// ============================================================
function setupDailyBehindTrigger() {
  removeDailyBehindTrigger();
  ScriptApp.newTrigger('runDailyBehindCheck')
    .timeBased()
    .everyDays(1)
    .atHour(21)
    .create();
  Logger.log('runDailyBehindCheck の毎日21時トリガーを設定しました');
}

function removeDailyBehindTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'runDailyBehindCheck') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}

// ============================================================
// 内部ヘルパー
// ============================================================
function openAdminSpreadsheet_() {
  var id = PropertiesService.getScriptProperties().getProperty('ADMIN_SHEET_ID');
  return SpreadsheetApp.openById(id);
}

function getOrCreateSheet_(ss, name, header) {
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    if (header) sh.appendRow(header);
  }
  return sh;
}

// 生徒管理タブ: A=userId, B=name, D=status, I=月間目標時間(h)
function readActiveStudentsWithTargets_() {
  var sheet = openAdminSpreadsheet_().getSheetByName(STUDENT_ADMIN_TAB_NAME);
  var rows = sheet.getDataRange().getValues();
  var out = [];
  for (var i = 1; i < rows.length; i++) {
    var r = rows[i];
    if (!r[0]) continue;
    if ((r[3] || '').toString().toLowerCase().trim() !== 'active') continue;
    out.push({
      userId: (r[0] || '').toString().trim(),
      name: (r[1] || '').toString().trim(),
      targetH: Number(r[8]) || 60,
    });
  }
  return out;
}

function sumStudyHoursInMonth_(name, year, month) {
  var sheet = openAdminSpreadsheet_().getSheetByName(STUDY_LOG_SHEET_NAME);
  if (!sheet) return 0;
  var last = sheet.getLastRow();
  if (last < 1) return 0;
  var rows = sheet.getRange(1, 1, last, 3).getValues();
  var sum = 0;
  for (var i = 0; i < rows.length; i++) {
    var nm = (rows[i][1] || '').toString().trim();
    var h = Number(rows[i][2]);
    if (nm !== name || !h) continue;
    var dt = parseDateLoose_(rows[i][0]);
    if (!dt) continue;
    if (dt.getFullYear() === year && (dt.getMonth() + 1) === month) sum += h;
  }
  return sum;
}

// 通知ログから、その生徒の最後の「時間」ビハインド通知日時を返す
function getLastBehindNotifyDate_(name) {
  var sheet = openAdminSpreadsheet_().getSheetByName(NOTIFY_LOG_SHEET_NAME);
  if (!sheet) return null;
  var last = sheet.getLastRow();
  if (last < 2) return null;
  var rows = sheet.getRange(2, 1, last - 1, 3).getValues(); // A=日時, B=名前, C=種別
  var latest = null;
  for (var i = 0; i < rows.length; i++) {
    if ((rows[i][1] || '').toString().trim() !== name) continue;
    if ((rows[i][2] || '').toString().trim() !== '時間') continue;
    var dt = parseDateTimeLoose_(rows[i][0]);
    if (dt && (!latest || dt > latest)) latest = dt;
  }
  return latest;
}

function appendNotifyLog_(name, type, ratePct, message) {
  var ss = openAdminSpreadsheet_();
  var sh = getOrCreateSheet_(ss, NOTIFY_LOG_SHEET_NAME, ['送信日時', '生徒名', '種別', '達成率', '送信文面']);
  sh.appendRow([
    Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'),
    name, type, ratePct + '%', message,
  ]);
}

function pushLineMessage_(userId, message) {
  var config = getConfig();
  try {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + config.LINE_TOKEN },
      payload: JSON.stringify({ to: userId, messages: [{ type: 'text', text: message }] }),
      muteHttpExceptions: true,
    });
  } catch (err) {
    Logger.log('pushLineMessage エラー: ' + err.toString());
  }
}

// '2026/06/10' / '2026-06-10' / Date を吸収
function parseDateLoose_(v) {
  if (v instanceof Date) return v;
  var s = (v || '').toString().trim();
  var m = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}

function parseDateTimeLoose_(v) {
  if (v instanceof Date) return v;
  var s = (v || '').toString().trim();
  var m = /^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})[ T]?(\d{1,2})?:?(\d{1,2})?/.exec(s);
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4] || 0), Number(m[5] || 0));
}

// 日付のみの差(日数)
function dayDiff_(a, b) {
  var ms = 24 * 60 * 60 * 1000;
  var da = new Date(a.getFullYear(), a.getMonth(), a.getDate());
  var db = new Date(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((db - da) / ms);
}

function round1_(x) {
  return Math.round(x * 10) / 10;
}

// 1日あたりの補填量を「30分」「1時間15分」のように表現
function formatPerDay_(perDayH) {
  var mins = Math.round(perDayH * 60);
  if (mins < 60) return mins + '分';
  var h = Math.floor(mins / 60);
  var m = mins % 60;
  return m === 0 ? (h + '時間') : (h + '時間' + m + '分');
}
