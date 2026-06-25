// ============================================================
// phase4.js (GAS上では phase4.gs) - Phase 4
//   03 英会話レビュー(processEikaiwa)
//   05 振り返りシート(processReflection) ＋ 月末リマインド
// 設計: docs/miesan-webapp-handoff.md セクション6.1 / 6.2
//
// 依存(既存・グローバル): getConfig() / replyToUser() / notifyMiesan() /
//   writeFeedbackToAdminSheet() / callGPT() / fetchLineContent() (コード.js),
//   getStudentMap() (コード.js), pushLineMessage_() (tracking.js)
// ============================================================

// Whisperのファイル上限25MB。安全マージンで24MBを上限とする
var EIKAIWA_MAX_BYTES = 24 * 1024 * 1024;

// 振り返りの6項目テンプレ(#振り返り の返信)は コード.js の TASK_TYPES.reflection.guide に定義。
// (TASK_TYPES初期化時のファイル読み込み順に依存しないよう、あちらに直書きしている)

// ★みえさんの実FB例(概要mdの「生徒例→みえさんFB例」)が手に入ったらここに貼る。
//   空でも動くが、few-shotを入れるとトーン再現度が大きく上がる。
var REFLECTION_FEWSHOT = '';

// ============================================================
// 03 英会話レビュー
//   doPostの音声分岐から呼ばれる。サイズ確認のため replyToken を受け取る
// ============================================================
function processEikaiwa(student, msgId, config, replyToken) {
  Logger.log('[' + student.name + '] 英会話処理開始');

  var audioBlob = fetchLineContent(config.LINE_TOKEN, msgId);
  if (!audioBlob) {
    replyToUser(config.LINE_TOKEN, replyToken, '⚠️ 音声の取得に失敗しました。もう一度送ってください。');
    return;
  }

  // Whisper 25MB制限 / GAS 6分制限への対策(設計書6.1)
  if (audioBlob.getBytes().length > EIKAIWA_MAX_BYTES) {
    replyToUser(config.LINE_TOKEN, replyToken,
      '🎙 録音が大きいようです。\n10分程度ずつに分けて送っていただけますか？\n（長すぎると処理できないことがあります）');
    return;
  }

  replyToUser(config.LINE_TOKEN, replyToken,
    '💬 英会話の録音を受け取りました!\n言えなかった表現を分析しています。FBまでお待ちください :)');

  // 英会話は日本語が混ざることがあるため言語自動判定で文字起こし
  var transcript = transcribeAuto_(config.OPENAI_KEY, audioBlob);
  if (!transcript) { notifyMiesan('⚠️ ' + student.name + 'さんの英会話文字起こしに失敗しました。'); return; }

  var analysis = analyzeEikaiwa(config.OPENAI_KEY, transcript);
  if (!analysis) { notifyMiesan('⚠️ ' + student.name + 'さんの英会話分析に失敗しました。'); return; }

  writeFeedbackToAdminSheet(student, '英会話', analysis);

  notifyMiesan(
    '✅ ' + student.name + 'さん(英会話)\n' +
    '言えなかった表現: ' + (analysis.phrase_count || 0) + '個抽出\n' +
    '📊 FB候補シートに記入済み'
  );
}

// 言語指定なし(自動判定)のWhisper文字起こし。英会話用
function transcribeAuto_(apiKey, audioBlob) {
  try {
    var res = UrlFetchApp.fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'post',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      payload: {
        'file': audioBlob.setName('audio.m4a'),
        'model': 'whisper-1',
        'response_format': 'json',
      },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) {
      Logger.log('transcribeAuto Whisper エラー: ' + res.getResponseCode() + ' ' + res.getContentText());
      return null;
    }
    return JSON.parse(res.getContentText()).text;
  } catch (err) {
    Logger.log('transcribeAuto エラー: ' + err.toString());
    return null;
  }
}

// GPT分析: 英会話(言いたかったのに言えなかった表現を抽出)
function analyzeEikaiwa(apiKey, transcript) {
  try {
    var prompt = 'あなたは英語コーチングの専門家です。生徒の英会話の録音を文字起こしした以下のテキストを分析してください。\n\n' +
      '文字起こし（英語に日本語が混ざることがあります）:\n"""\n' + transcript + '\n"""\n\n' +
      '【分析の目的】\n' +
      '会話の中で生徒が「言いたそうで言えなかった／言い直した／日本語で逃げた／簡単な言い回しで済ませた」箇所を見つけ、\n' +
      '本当はこう言いたかっただろうという【自然な英語表現】を最大8つ提案する。\n\n' +
      '【フィードバック方針 - みえさんのスタイル】\n' +
      '・まず会話を続けられたこと・伝えようとした姿勢をしっかり褒める\n' +
      '・文法の細かいミスは指摘しすぎない。「次に使える表現」を渡すことに集中\n' +
      '・抽出表現は「英語表現 → 日本語の意味」の形式で、よく使える順に\n' +
      '・ポジティブで、次の会話で1つ使ってみたくなるトーン\n\n' +
      '以下のJSON形式のみで回答してください。\n\n' +
      '{\n' +
      '  "transcript": "文字起こし(読みやすく整えたもの)",\n' +
      '  "phrase_count": "抽出した表現の数(数値)",\n' +
      '  "phrases": "言えなかった/言い換えたい表現リスト。各行『英語表現 → 日本語の意味』、最大8つを改行区切り",\n' +
      '  "feedback_1": "会話全体の良かった点を褒めた上で、特に使ってほしい表現を2-3個ピックアップして例文付きで。日本語で。",\n' +
      '  "feedback_2": "別の切り口の候補。言い換え・自然な相づち・つなぎ言葉など会話を続けるコツ多め。日本語で。",\n' +
      '  "feedback_3": "もう1つの候補。次回の会話で1つだけ意識するチャレンジ目標を提案。日本語で。"\n' +
      '}';

    var res = callGPT(apiKey, prompt);
    if (!res) return null;

    var result = JSON.parse(res);
    result.timestamp = new Date();
    result.phrase_count = Number(result.phrase_count) || 0;
    return result;
  } catch (err) {
    Logger.log('analyzeEikaiwa エラー: ' + err.toString());
    return null;
  }
}

// ============================================================
// 05 振り返りシート(テキスト1通で即処理。writingと同型)
// ============================================================
function processReflection(student, reflectionText) {
  Logger.log('[' + student.name + '] 振り返り処理開始');

  var analysis = analyzeReflection(getConfig().OPENAI_KEY, reflectionText);
  if (!analysis) { notifyMiesan('⚠️ ' + student.name + 'さんの振り返り分析に失敗しました。'); return; }

  writeFeedbackToAdminSheet(student, '振り返り', analysis);

  notifyMiesan(
    '✅ ' + student.name + 'さん(振り返り)\n' +
    '6項目の振り返りFB候補を作成しました\n' +
    '📊 FB候補シートに記入済み'
  );
}

// GPT分析: 振り返り(6項目に項目ごとに寄り添ったFB候補を3案)
function analyzeReflection(apiKey, reflectionText) {
  try {
    var fewshot = REFLECTION_FEWSHOT
      ? '\n【みえさんのFB例(文体を必ずこれに寄せる)】\n"""\n' + REFLECTION_FEWSHOT + '\n"""\n'
      : '';

    var prompt = 'あなたは英語コーチ「みえさん」です。生徒が月末に書いた振り返り(6項目)に対して、温かく寄り添うフィードバックを返します。\n\n' +
      '生徒の振り返り:\n"""\n' + reflectionText + '\n"""\n\n' +
      '【6項目】1.マインド 2.学習習慣 3.最大の変化 4.来月の意識 5.不安・サポート 6.英語面の変化\n\n' +
      '【フィードバック方針 - みえさんのスタイル】\n' +
      '・生徒が書いた言葉を「>」で引用しながら、項目ごとに具体的に拾って返す\n' +
      '・できている点・成長をまず認める。不安には安心できる言葉を添える\n' +
      '・来月の意識には、無理のない具体的な一歩を一緒に決める\n' +
      '・最後は前向きに励まして締める\n' +
      fewshot +
      '\n3つのFB候補(完成された返信文・それぞれ全6項目に触れる)を作ってください。' +
      'みえさんが1つ選んでそのままLINEで送れる文章にすること。\n\n' +
      '以下のJSON形式のみで回答してください。\n\n' +
      '{\n' +
      '  "transcript": "生徒の振り返り原文(そのまま)",\n' +
      '  "feedback_1": "候補1: 6項目に『>引用』しながら寄り添う完成返信。日本語で。",\n' +
      '  "feedback_2": "候補2: 別トーン(より励まし多め)の完成返信。日本語で。",\n' +
      '  "feedback_3": "候補3: 別トーン(来月の行動提案を具体的に)の完成返信。日本語で。"\n' +
      '}';

    var res = callGPT(apiKey, prompt);
    if (!res) return null;

    var result = JSON.parse(res);
    result.timestamp = new Date();
    return result;
  } catch (err) {
    Logger.log('analyzeReflection エラー: ' + err.toString());
    return null;
  }
}

// ============================================================
// 月末(25日)の振り返りリマインド
// ============================================================
function sendReflectionReminders() {
  var map = getStudentMap(); // {lineId: {name, sheetId}} active のみ
  var ids = Object.keys(map);
  var msg = '📝 もうすぐ月末ですね！今月の振り返りをお願いします😊\n' +
    'LINEで「#振り返り」と送ると、記入フォームをお届けします。';
  var sent = 0;
  for (var i = 0; i < ids.length; i++) {
    pushLineMessage_(ids[i], msg);
    sent++;
  }
  Logger.log('sendReflectionReminders: ' + sent + '名に送信');
  return sent;
}

function setupReflectionReminderTrigger() {
  removeReflectionReminderTrigger();
  ScriptApp.newTrigger('sendReflectionReminders')
    .timeBased()
    .onMonthDay(25)
    .atHour(10)
    .create();
  Logger.log('sendReflectionReminders の毎月25日トリガーを設定しました');
}

function removeReflectionReminderTrigger() {
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === 'sendReflectionReminders') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
}
