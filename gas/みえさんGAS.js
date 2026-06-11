// ============================================================
// みえさん英語コーチング - 自動化パイプライン v5.1
// リッチメニュー → モード設定 → 提出 → AI分析
// 通常チャットに干渉しない設計
// 対応: 1分スピーチ(AI) / シャドーイング(AI) / 速読(受領のみ)
// v5.1: Web管理画面API対応（api.gs）
//   - doPost冒頭にAPI分岐を追加（?action= 付きPOSTのみAPIへ。LINE Webhookは無影響）
//   - FB候補タブをK〜M列（ステータス/最終FB/行UUID）に拡張
// ============================================================

function getConfig() {
  var props = PropertiesService.getScriptProperties();
  return {
    LINE_TOKEN: props.getProperty('LINE_TOKEN'),
    OPENAI_KEY: props.getProperty('OPENAI_KEY'),
  };
}

var MIESAN_USER_ID = '';

// ============================================================
// 課題の種類定義
// accept: そのモードで受け付ける入力タイプ
// ============================================================
var TASK_TYPES = {
  'one_min':   { label: '1分スピーチ',   accept: ['audio'],          guide: '🎤 1分スピーチですね!\n音声を送ってください。' },
  'shadowing': { label: 'シャドーイング', accept: ['audio'],          guide: '🎧 シャドーイングですね!\n音声を送ってください。' },
  'sokudoku':  { label: '速読',          accept: ['image', 'text'],  guide: '📖 速読ですね!\n画像とテキストを送ってください。' },
  'eikaiwa':   { label: '英会話',        accept: [],                 guide: '💬 英会話の機能は準備中です!\nもう少しお待ちください。' },
  'writing':   { label: 'ライティング',   accept: ['text'],           guide: '✍️ ライティングですね!\nライティングのテキストを送ってください。\n(直近の1分スピーチと自動で比較します)' }
};

// リッチメニューのテキスト → 内部キー
var RICH_MENU_MAP = {
  '#1分スピーチ':   'one_min',
  '#シャドーイング': 'shadowing',
  '#速読':          'sokudoku',
  '#英会話':        'eikaiwa',
  '#ライティング':  'writing',
  '#進捗確認':      'progress',
  '#登録':          'register'
};

// AI自動処理対象
var AUTO_PROCESS_TYPES = ['one_min', 'shadowing', 'writing', 'sokudoku'];

// シート名
var ONE_MIN_SHEET_NAME = '1分スピーチ';
var FEEDBACK_SHEET_NAME = 'FB候補';

// モード・キャッシュ有効時間(秒)
var MODE_TTL = 1800;

// ============================================================
// LINE Webhook
// ============================================================
function doPost(e) {
  // ── Web管理画面API分岐（api.gs）──
  // LINE PlatformのWebhookにはクエリパラメータが付かないため、
  // ?action= が付いたPOSTのみAPIとして処理する。既存のLINE処理には影響しない。
  // ロールバック: このifブロックを削除するだけで v5.0 と同一挙動に戻る。
  if (e && e.parameter && e.parameter.action) {
    return handleApiPost(e);
  }

  try {
    var config = getConfig();
    var STUDENT_MAP = getStudentMap();
    var body = JSON.parse(e.postData.contents);

    for (var ei = 0; ei < body.events.length; ei++) {
      var event = body.events[ei];

      // ── 友だち追加 ──
      // 【After】
      if (event.type === 'follow') {
        // みえさんのマネージャー設定のあいさつメッセージに任せる
        Logger.log('友だち追加: ' + event.source.userId);
        continue;
      }

      // ── Quick Reply(フォールバック) ──
      if (event.type === 'postback') {
        handlePostback(event, STUDENT_MAP, config);
        continue;
      }

      if (event.type !== 'message') continue;

      var userId = event.source.userId;
      var msgType = event.message.type;

      // 未登録ユーザー
      if (!STUDENT_MAP[userId]) {
      // #登録 コマンドの場合のみIDを返す。それ以外はサイレントスキップ
      if (msgType === 'text') {
        var txtRaw = (event.message.text || '').trim();
        if (txtRaw === '#登録') {
          replyToUser(config.LINE_TOKEN, event.replyToken,
            '📋 登録用IDはこちらです!\n\n' + userId + '\n\nこのIDをみえさんにお伝えください😊');
          continue;
        }
      }
      Logger.log('未登録ユーザー: ' + userId + ' → スキップ');
      continue;
    }

      var student = STUDENT_MAP[userId];
      var activeMode = getActiveMode(userId);
      var modeConf = activeMode ? TASK_TYPES[activeMode] : null;

      // ═══════════════════════════════════
      // テキストメッセージ
      // ═══════════════════════════════════
      if (msgType === 'text') {
        var txt = (event.message.text || '').trim();

        // ── リッチメニュー #コマンド → モード切替(常に優先) ──
        var taskKey = RICH_MENU_MAP[txt];
        if (taskKey) {
          if (taskKey === 'progress') {
            replyToUser(config.LINE_TOKEN, event.replyToken,
              '📊 進捗確認機能は準備中です!');
            continue;
          }

          if (taskKey === 'register') {
            replyToUser(config.LINE_TOKEN, event.replyToken,
              '✅ すでに登録済みです!\n課題を提出するときは、画面下のメニューから選んでくださいね😊');
            continue;
          }
          var taskConf = TASK_TYPES[taskKey];
          if (taskConf) {
            setActiveMode(userId, taskKey);
            replyToUser(config.LINE_TOKEN, event.replyToken, taskConf.guide);
          }
          continue;
        }

        // ── モード中のテキスト ──
        if (activeMode && modeConf) {
          // このモードがテキストを受け付けるか?
          if (modeConf.accept.indexOf('text') !== -1) {
            // テキスト受付モード
            if (activeMode === 'writing') {
              // ライティング → 即処理(テキスト1つで完結)
              clearActiveMode(userId);
              replyToUser(config.LINE_TOKEN, event.replyToken,
                '✍️ ライティングを受け取りました!\n1分スピーチと比較分析中です。FBまでお待ちください :)');
              processWriting(student, txt);
            } else {
              // 速読等 → キャッシュして待機
              cachePendingText(userId, txt);
              replyToUser(config.LINE_TOKEN, event.replyToken,
                '📝 テキストを受け取りました!');
              if (activeMode === 'sokudoku') {
                tryProcessSokudoku(student, userId, config);
              }
            }
            continue;
          } else {
            // 音声系モード中にテキスト → モード解除(通常チャットの意図)
            clearActiveMode(userId);
            Logger.log('[' + student.name + '] モード解除(テキスト受信)');
            // そのまま流す(何もしない → みえさんとのチャットとして表示)
            continue;
          }
        }

        // ── モードなし & #コマンドでもない → 通常テキスト ──
        // 何もしない(みえさんとの通常チャット)
        continue;
      }

      // ═══════════════════════════════════
      // 音声メッセージ
      // ═══════════════════════════════════
      var isAudio = false;
      if (msgType === 'audio') {
        isAudio = true;
      } else if (msgType === 'file') {
        var fileName = event.message.fileName || '';
        if (/\.(m4a|mp3|wav|aac|ogg|mp4|caf)$/i.test(fileName)) {
          isAudio = true;
        }
      }

      if (isAudio) {
        if (activeMode && modeConf && modeConf.accept.indexOf('audio') !== -1) {
          // ── 音声受付モード中 ──
          clearActiveMode(userId);

          if (AUTO_PROCESS_TYPES.indexOf(activeMode) !== -1) {
            replyToUser(config.LINE_TOKEN, event.replyToken,
              modeConf.label + 'の音声を受け取りました!\nFBまでお待ちください :)');

            if (activeMode === 'one_min') {
              processOneMinSpeech(student, event.message.id);
            } else if (activeMode === 'shadowing') {
              processShadowing(student, event.message.id);
            }
          } else {
            replyToUser(config.LINE_TOKEN, event.replyToken,
              modeConf.label + 'の音声を受け取りました!\nみえさんからFBをお送りしますね :)');
          }

        } else if (activeMode) {
          // モード中だが音声を受け付けないモード → 無視して流す
          continue;

        } else {
          // ── モードなし → フォールバック ──
          cachePendingAudio(userId, event.message.id);
          sendFallbackQuickReply(config.LINE_TOKEN, event.replyToken);
        }
        continue;
      }

      // ═══════════════════════════════════
      // 画像メッセージ
      // ═══════════════════════════════════
      if (msgType === 'image') {
        if (activeMode && modeConf && modeConf.accept.indexOf('image') !== -1) {
          // 画像受付モード(速読) → messageIdをキャッシュ
          cachePendingImage(userId, event.message.id);

          // 要約テキストが既にあるかチェックして案内を変える
          var pendingTxt = getPendingText(userId);
          if (pendingTxt) {
            replyToUser(config.LINE_TOKEN, event.replyToken,
              '🖼 画像を受け取りました!\n分析を開始します。FBまでお待ちください :)');
          } else {
            replyToUser(config.LINE_TOKEN, event.replyToken,
              '🖼 画像を受け取りました!\n続けて要約テキストを送ってください。');
          }

          if (activeMode === 'sokudoku') {
            tryProcessSokudoku(student, userId, config);
          }
          continue;
        }
        // モードなし or 画像を受け付けないモード → 何もしない
        continue;
      }

      // スタンプ・動画等は何もしない
    }
  } catch (err) {
    Logger.log('doPost エラー: ' + err.toString());
  }
  return ContentService.createTextOutput('OK');
}

// ============================================================
// ライティング処理
// ============================================================
function processWriting(student, writingText) {
  var config = getConfig();
  Logger.log('[' + student.name + '] ライティング処理開始');

  // 生徒シートから直近の1分スピーチ文字起こしを取得
  var speechTranscript = getLatestTranscript(student);
  if (!speechTranscript) {
    notifyMiesan(
      '⚠️ ' + student.name + 'さんのライティング分析に失敗しました。\n' +
      '理由: 1分スピーチの文字起こしが見つかりません。'
    );
    return;
  }

  var analysis = analyzeWriting(config.OPENAI_KEY, speechTranscript, writingText);
  if (!analysis) {
    notifyMiesan('⚠️ ' + student.name + 'さんのライティング分析に失敗しました。');
    return;
  }

  writeFeedbackToAdminSheet(student, 'ライティング', analysis);

  notifyMiesan(
    '✅ ' + student.name + 'さん(ライティング)\n' +
    'ライティング語数: ' + (analysis.writing_word_count || '-') + '\n' +
    'スピーチ語数: ' + (analysis.speech_word_count || '-') + '\n' +
    '未活用表現: ' + (analysis.gap_count || '-') + '個抽出\n' +
    '📊 FB候補シートに記入済み'
  );
}

// ============================================================
// 生徒シートから直近の1分スピーチ文字起こしを取得
// E列(5列目)の最後に入力されている行を探す
// ============================================================
function getLatestTranscript(student) {
  try {
    var ss = SpreadsheetApp.openById(student.sheetId);
    var sheet = ss.getSheetByName(ONE_MIN_SHEET_NAME);
    if (!sheet) {
      Logger.log('[' + student.name + '] 1分スピーチタブが見つかりません');
      return null;
    }

    var eCol = sheet.getRange('E3:E').getValues();
    var lastTranscript = null;
    for (var i = 0; i < eCol.length; i++) {
      if (eCol[i][0] && eCol[i][0] !== '') {
        lastTranscript = eCol[i][0].toString();
      }
    }

    if (!lastTranscript) {
      Logger.log('[' + student.name + '] 1分スピーチの文字起こしが見つかりません');
    }
    return lastTranscript;
  } catch (err) {
    Logger.log('getLatestTranscript エラー: ' + err.toString());
    return null;
  }
}

// ============================================================
// GPT分析: ライティング(スピーチとの比較)
// ============================================================
function analyzeWriting(apiKey, speechTranscript, writingText) {
  try {
    var prompt = 'あなたは英語コーチングの専門家です。生徒の「1分スピーチ(即興)」と「時間をかけて書いたライティング」を比較分析してください。\n\n' +
      '【1分スピーチの文字起こし(即興・瞬発)】\n"""\n' + speechTranscript + '\n"""\n\n' +
      '【ライティング(時間をかけて書いたもの)】\n"""\n' + writingText + '\n"""\n\n' +
      '【分析の目的】\n' +
      '「ライティングでは使えているけど、スピーキングではまだ瞬発的に出てきていない表現」を抽出する。\n' +
      'これにより、生徒が「知ってはいるが口から出てこない」表現を特定し、スピーキングの練習ポイントを明確にする。\n\n' +
      '【フィードバック方針】\n' +
      '・ライティングで使えている良い表現をまず褒める\n' +
      '・「この表現、スピーキングでも使えるようになったら最強です！」というポジティブなトーン\n' +
      '・抽出した表現は、スピーキングで使うための具体的な練習方法も提案\n' +
      '・文法ミスの指摘より、表現力の橋渡しに集中\n\n' +
      '以下のJSON形式のみで回答してください。\n\n' +
      '{\n' +
      '  "speech_word_count": "スピーチの語数(数値)",\n' +
      '  "writing_word_count": "ライティングの語数(数値)",\n' +
      '  "gap_count": "ライティングにあってスピーチにない主要表現の数(数値)",\n' +
      '  "gap_expressions": "ライティングで使えているがスピーチで出てこなかった表現リスト。各表現を改行区切りで。英語の表現 → 日本語の意味 の形式で最大8つ",\n' +
      '  "transcript": "ライティングのテキスト(そのまま)",\n' +
      '  "feedback_1": "分析結果のサマリー。ライティングの良い点を褒めた上で、スピーキングとのギャップを具体的に指摘。日本語で。",\n' +
      '  "feedback_2": "抽出した表現を使ってスピーキング力を伸ばすための具体的な練習メニュー提案。日本語で。",\n' +
      '  "feedback_3": "次回の1分スピーチで意識的に使ってほしい表現を2-3個ピックアップし、例文付きで提示。日本語で。"\n' +
      '}';

    var res = callGPT(apiKey, prompt);
    if (!res) return null;

    var result = JSON.parse(res);
    result.timestamp = new Date();
    result.speech_word_count = Number(result.speech_word_count) || 0;
    result.writing_word_count = Number(result.writing_word_count) || 0;
    result.gap_count = Number(result.gap_count) || 0;
    return result;
  } catch (err) {
    Logger.log('analyzeWriting エラー: ' + err.toString());
    return null;
  }
}

// ============================================================
// 速読: 画像+テキスト両方揃ったら処理
// ============================================================
function tryProcessSokudoku(student, userId, config) {
  var imageId = getPendingImage(userId);
  var text = getPendingText(userId);

  if (imageId && text) {
    // 両方揃った → AI処理開始
    clearPendingImage(userId);
    clearPendingText(userId);
    clearActiveMode(userId);

    processSokudoku(student, imageId, text);
  }
  // 片方だけなら待機(モード継続)
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// 速読の処理関数 + GPT-4o Vision呼び出し
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// ============================================================
// 速読処理
// ============================================================
function processSokudoku(student, imageMessageId, summaryText) {
  var config = getConfig();
  Logger.log('[' + student.name + '] 速読処理開始');

  // Step 1: LINEから画像取得
  var imageBlob = fetchLineContent(config.LINE_TOKEN, imageMessageId);
  if (!imageBlob) {
    notifyMiesan('⚠️ ' + student.name + 'さんの速読画像の取得に失敗しました。');
    return;
  }

  // Step 2: 画像をbase64エンコード
  var base64Image = Utilities.base64Encode(imageBlob.getBytes());

  // Step 3: GPT-4o Visionで分析
  var analysis = analyzeSokudoku(config.OPENAI_KEY, base64Image, summaryText);
  if (!analysis) {
    notifyMiesan('⚠️ ' + student.name + 'さんの速読分析に失敗しました。');
    return;
  }

  // Step 4: FB候補シートに書き込み
  writeFeedbackToAdminSheet(student, '速読', analysis);

  // Step 5: みえさんに通知
  notifyMiesan(
    '✅ ' + student.name + 'さん(速読)\n' +
    'チャンキング精度: ' + (analysis.chunking_score || '-') + '/10\n' +
    '要約スコア: ' + (analysis.summary_score || '-') + '/10\n' +
    'スラッシュ修正: ' + (analysis.correction_count || '0') + '箇所\n' +
    '📊 FB候補シートに記入済み'
  );
}

// ============================================================
// GPT-4o Vision: 速読分析
// 画像からスラッシュ付きテキスト読み取り+判定+要約評価+FB生成
// ============================================================
function analyzeSokudoku(apiKey, base64Image, summaryText) {
  try {
    var prompt = '以下は英語のスラッシュリーディング(チャンキング)の課題画像です。\n\n' +
      '【あなたのタスク】\n' +
      '1. 画像から英文とスラッシュの位置を正確に読み取る\n' +
      '2. スラッシュの位置が意味のまとまり(チャンク)として適切かを判定する\n' +
      '3. 生徒が書いた要約テキストの質を評価する\n' +
      '4. フィードバック候補を3つ生成する\n\n' +
      '【生徒の要約テキスト】\n"""\n' + summaryText + '\n"""\n\n' +
      '【スラッシュ位置の判定基準】\n' +
      '・主語と動詞の間にはスラッシュを入れない(同じチャンク)\n' +
      '・前置詞句、関係詞節、接続詞の前は適切なスラッシュ位置\n' +
      '・意味のまとまりが不自然に分断されていないか\n' +
      '・スラッシュが多すぎ/少なすぎないか\n\n' +
      '【フィードバック方針】\n' +
      '・正しくスラッシュが入っている箇所をまず褒める\n' +
      '・修正が必要な箇所は、なぜその位置が不適切かを説明\n' +
      '・「ここで区切ると、読むスピードが上がりますよ！」というポジティブなトーン\n' +
      '・要約については、要点を押さえているかを評価\n\n' +
      '以下のJSON形式のみで回答してください。\n\n' +
      '{\n' +
      '  "original_text": "画像から読み取った元の英文(スラッシュなし)",\n' +
      '  "student_chunking": "画像から読み取った生徒のスラッシュ位置をそのまま再現(/ で区切り)",\n' +
      '  "correct_chunking": "模範的なスラッシュ位置(/ で区切り)",\n' +
      '  "chunking_score": "チャンキングの適切さスコア 1-10(数値)",\n' +
      '  "summary_score": "要約の質スコア 1-10(数値)",\n' +
      '  "correction_count": "スラッシュ位置の修正が必要な箇所の数(数値)",\n' +
      '  "transcript": "画像から読み取ったテキスト全文",\n' +
      '  "feedback_1": "チャンキングの評価。正しい箇所を褒め、修正箇所を具体的に指摘。修正前→修正後を示す。日本語で。",\n' +
      '  "feedback_2": "要約の評価。要点を押さえているか、抜けている情報はないか。日本語で。",\n' +
      '  "feedback_3": "総合的なFB候補。チャンキングと要約の両方を踏まえたアドバイス。次回意識するポイント1つ。日本語で。"\n' +
      '}';

    var res = callGPTWithImage(apiKey, prompt, base64Image);
    if (!res) return null;

    var result = JSON.parse(res);
    result.timestamp = new Date();
    result.chunking_score = Number(result.chunking_score) || 5;
    result.summary_score = Number(result.summary_score) || 5;
    result.correction_count = Number(result.correction_count) || 0;
    return result;
  } catch (err) {
    Logger.log('analyzeSokudoku エラー: ' + err.toString());
    return null;
  }
}

// ============================================================
// GPT-4o Vision API呼び出し(画像対応)
// ============================================================
function callGPTWithImage(apiKey, prompt, base64Image) {
  try {
    var res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      payload: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: 'JSONのみで回答してください。マークダウンのバッククォートは使わないでください。'
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: 'data:image/jpeg;base64,' + base64Image,
                  detail: 'high'
                }
              },
              {
                type: 'text',
                text: prompt
              }
            ]
          }
        ],
        temperature: 0.3,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      }),
      muteHttpExceptions: true,
    });

    if (res.getResponseCode() !== 200) {
      Logger.log('GPT-4o Vision API エラー: ' + res.getResponseCode() + ' ' + res.getContentText());
      return null;
    }

    var data = JSON.parse(res.getContentText());
    return data.choices[0].message.content;
  } catch (err) {
    Logger.log('callGPTWithImage エラー: ' + err.toString());
    return null;
  }
}

// ============================================================
// Quick Reply: 音声先送りフォールバック
// ============================================================
function sendFallbackQuickReply(token, replyToken) {
  var items = [];
  var keys = ['one_min', 'shadowing', 'sokudoku'];
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i];
    var conf = TASK_TYPES[key];
    if (conf.accept.indexOf('audio') !== -1) {
      items.push({
        type: 'action',
        action: {
          type: 'postback',
          label: conf.label,
          data: 'action=classify_audio&type=' + key,
          displayText: conf.label,
        }
      });
    }
  }

  replyWithQuickReply(token, replyToken,
    '🎤 音声を受け取りました!\nどの課題ですか?\n\n💡 画面下のメニューから\n課題を選ぶとスムーズです!', items);
}

// ============================================================
// Quick Reply共通送信
// ============================================================
function replyWithQuickReply(token, replyToken, text, items) {
  try {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + token },
      payload: JSON.stringify({
        replyToken: replyToken,
        messages: [{ type: 'text', text: text, quickReply: { items: items } }]
      }),
      muteHttpExceptions: true,
    });
  } catch (err) {
    Logger.log('replyWithQuickReply エラー: ' + err.toString());
  }
}

// ============================================================
// Postback(フォールバック: 音声先送り→Quick Reply)
// ============================================================
function handlePostback(event, STUDENT_MAP, config) {
  var userId = event.source.userId;
  var student = STUDENT_MAP[userId];

  if (!student) {
    replyToUser(config.LINE_TOKEN, event.replyToken, 'まだ登録されていません。');
    return;
  }

  var params = parsePostback(event.postback.data);
  var action = params.action || '';
  var typeKey = params.type;
  var typeConfig = TASK_TYPES[typeKey];

  if (!typeConfig) {
    replyToUser(config.LINE_TOKEN, event.replyToken, '不明な種類です。もう一度やり直してください。');
    return;
  }

  if (action === 'classify_audio') {
    var msgId = getPendingAudio(userId);
    if (!msgId) {
      replyToUser(config.LINE_TOKEN, event.replyToken,
        '⚠️ 音声の期限が切れました(30分以上経過)。\nもう一度送ってください。');
      return;
    }
    clearPendingAudio(userId);

    if (AUTO_PROCESS_TYPES.indexOf(typeKey) !== -1) {
      replyToUser(config.LINE_TOKEN, event.replyToken,
        typeConfig.label + 'として受け取りました!\nFBまでお待ちください :)');
      if (typeKey === 'one_min') {
        processOneMinSpeech(student, msgId);
      } else if (typeKey === 'shadowing') {
        processShadowing(student, msgId);
      }
    } else {
      replyToUser(config.LINE_TOKEN, event.replyToken,
        typeConfig.label + 'として受け取りました!\nみえさんからFBをお送りしますね :)');
    }
  }
}

// ============================================================
// キャッシュ管理
// ============================================================
// モード
function setActiveMode(userId, mode) {
  CacheService.getScriptCache().put('mode_' + userId, mode, MODE_TTL);
}
function getActiveMode(userId) {
  return CacheService.getScriptCache().get('mode_' + userId);
}
function clearActiveMode(userId) {
  CacheService.getScriptCache().remove('mode_' + userId);
}

// 音声(フォールバック用)
function cachePendingAudio(userId, msgId) {
  CacheService.getScriptCache().put('pending_audio_' + userId, msgId, MODE_TTL);
}
function getPendingAudio(userId) {
  return CacheService.getScriptCache().get('pending_audio_' + userId);
}
function clearPendingAudio(userId) {
  CacheService.getScriptCache().remove('pending_audio_' + userId);
}

// テキスト(速読・ライティング用)
function cachePendingText(userId, text) {
  var trimmed = text.length > 3000 ? text.substring(0, 3000) : text;
  CacheService.getScriptCache().put('pending_text_' + userId, trimmed, MODE_TTL);
}
function getPendingText(userId) {
  return CacheService.getScriptCache().get('pending_text_' + userId);
}
function clearPendingText(userId) {
  CacheService.getScriptCache().remove('pending_text_' + userId);
}

// 画像(速読用)
function cachePendingImage(userId, msgId) {
  CacheService.getScriptCache().put('pending_image_' + userId, msgId, MODE_TTL);
}
function getPendingImage(userId) {
  return CacheService.getScriptCache().get('pending_image_' + userId);
}
function clearPendingImage(userId) {
  CacheService.getScriptCache().remove('pending_image_' + userId);
}

// ============================================================
// postbackパース
// ============================================================
function parsePostback(data) {
  var result = {};
  if (!data) return result;
  var pairs = data.split('&');
  for (var i = 0; i < pairs.length; i++) {
    var parts = pairs[i].split('=');
    if (parts[0]) result[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || '');
  }
  return result;
}

// ============================================================
// 1分スピーチ処理
// ============================================================
function processOneMinSpeech(student, msgId) {
  var config = getConfig();
  Logger.log('[' + student.name + '] 1分スピーチ処理開始');

  var audioBlob = fetchLineContent(config.LINE_TOKEN, msgId);
  if (!audioBlob) { notifyMiesan('⚠️ ' + student.name + 'さんの音声取得に失敗しました。'); return; }

  var transcription = transcribeWithWhisper(config.OPENAI_KEY, audioBlob);
  if (!transcription) { notifyMiesan('⚠️ ' + student.name + 'さんの文字起こしに失敗しました。'); return; }

  var durationSec = transcription.duration ? Math.round(transcription.duration) : null;
  var analysis = analyzeOneMinSpeech(config.OPENAI_KEY, transcription.text, durationSec);
  if (!analysis) { notifyMiesan('⚠️ ' + student.name + 'さんの分析に失敗しました。'); return; }

  writeToStudentSheet(student, analysis);
  writeFeedbackToAdminSheet(student, '1分スピーチ', analysis);

  notifyMiesan(
    '✅ ' + student.name + 'さん(1分スピーチ)\n' +
    'WPM: ' + analysis.wpm + ' / 単語数: ' + analysis.word_count + '\n' +
    'フィラー: ' + analysis.filler_count + '回 / 流暢さ: ' + analysis.fluency_score + '/10\n' +
    '📊 スプレッドシートに記入済み'
  );
}

// ============================================================
// シャドーイング処理
// ============================================================
function processShadowing(student, msgId) {
  var config = getConfig();
  Logger.log('[' + student.name + '] シャドーイング処理開始');

  var audioBlob = fetchLineContent(config.LINE_TOKEN, msgId);
  if (!audioBlob) { notifyMiesan('⚠️ ' + student.name + 'さんのシャドーイング音声取得に失敗しました。'); return; }

  var transcription = transcribeWithWhisper(config.OPENAI_KEY, audioBlob);
  if (!transcription) { notifyMiesan('⚠️ ' + student.name + 'さんのシャドーイング文字起こしに失敗しました。'); return; }

  var analysis = analyzeShadowing(config.OPENAI_KEY, transcription.text);
  if (!analysis) { notifyMiesan('⚠️ ' + student.name + 'さんのシャドーイング分析に失敗しました。'); return; }

  writeFeedbackToAdminSheet(student, 'シャドーイング', analysis);

  notifyMiesan(
    '✅ ' + student.name + 'さん(シャドーイング)\n' +
    '発音スコア: ' + (analysis.pronunciation_score || '-') + '/10\n' +
    '流暢さ: ' + (analysis.fluency_score || '-') + '/10\n' +
    '指摘数: ' + (analysis.correction_count || '-') + '点\n' +
    '📊 FB候補シートに記入済み'
  );
}

// ============================================================
// GPT分析: 1分スピーチ
// ============================================================
function analyzeOneMinSpeech(apiKey, transcript, durationSec) {
  try {
    var durationInstruction = durationSec
      ? '音声の長さは' + durationSec + '秒です。'
      : '文字起こしの単語数とスピーチの一般的なペースから、おおよその音声長を推定してください。';

    var prompt = 'あなたは英語コーチングの専門家です。以下の英語スピーチの文字起こしを分析してください。\n\n' +
      '文字起こし:\n"""\n' + transcript + '\n"""\n\n' +
      durationInstruction + '\n\n' +
      '【フィードバック方針】\n' +
      '・文法ミスはそんなに指摘しない\n' +
      '・頻繁に使いそうな表現をインプットする（例：こういう言い方もあるよ！よく使える順で2-3つ）\n' +
      '・ポジティブなトーンで、生徒のモチベーションを上げる\n\n' +
      '以下のJSON形式のみで回答してください。\n\n' +
      '{\n' +
      '  "transcript": "フィラー(um, uh, like, you know等)を除去したクリーンな文字起こし",\n' +
      '  "word_count": "クリーン版の単語数(数値)",\n' +
      '  "duration_sec": "音声の長さ(秒・数値)",\n' +
      '  "wpm": "word_count / duration_sec * 60 の計算結果(数値)",\n' +
      '  "filler_count": "除去したフィラーの数(数値)",\n' +
      '  "fluency_score": "1-10の流暢さスコア(数値)",\n' +
      '  "feedback_1": "良かった点を具体的に。日本語で",\n' +
      '  "feedback_2": "改善点と具体的なアドバイス。日本語で",\n' +
      '  "feedback_3": "次回のチャレンジ目標を1つ。日本語で"\n' +
      '}';

    var res = callGPT(apiKey, prompt);
    if (!res) return null;

    var result = JSON.parse(res);
    result.timestamp = new Date();
    result.word_count = Number(result.word_count) || 0;
    result.duration_sec = Number(result.duration_sec) || durationSec || 60;
    result.wpm = Number(result.wpm) || Math.round(result.word_count / result.duration_sec * 60);
    result.filler_count = Number(result.filler_count) || 0;
    result.fluency_score = Number(result.fluency_score) || 5;
    return result;
  } catch (err) {
    Logger.log('analyzeOneMinSpeech エラー: ' + err.toString());
    return null;
  }
}

// ============================================================
// GPT分析: シャドーイング(発音指導ベース)
// ============================================================
function analyzeShadowing(apiKey, transcript) {
  try {
    var prompt = 'あなたは英語の発音指導の専門家です。シャドーイング音声を文字起こしした以下のテキストを分析し、発音フィードバック候補を生成してください。\n\n' +
      '生徒のシャドーイング文字起こし:\n"""\n' + transcript + '\n"""\n\n' +
      '【フィードバック方針 - みえさんのスタイル】\n' +
      '・具体的なフレーズを引用して、その発音のポイントを指摘する\n' +
      '・以下の観点を重視:\n' +
      '  - リンキング(単語の繋がり。例: "it is" → itのtがフラップTになる)\n' +
      '  - 母音挿入(日本語話者がやりがちな余計な母音。例: "every"のブに母音が入る)\n' +
      '  - 母音の音質(例: "hand"の母音はhændでアとエの中間音æ)\n' +
      '  - 子音の脱落や弱化(例: "from"のmが抜けてforに聞こえる)\n' +
      '  - リズムとイントネーション\n' +
      '・1つのフィードバックにつき3〜5点の指摘が理想\n' +
      '・各指摘は「フレーズ → ◆ 発音ポイントの説明」の形式\n' +
      '・ポジティブなトーンで開始し、「次回完璧に修正していきましょう」で締める\n\n' +
      '以下のJSON形式のみで回答してください。\n\n' +
      '{\n' +
      '  "transcript": "文字起こし(クリーン版)",\n' +
      '  "pronunciation_score": "発音の総合スコア 1-10(数値)",\n' +
      '  "fluency_score": "流暢さスコア 1-10(数値)",\n' +
      '  "correction_count": "指摘した発音ポイントの数(数値)",\n' +
      '  "feedback_1": "全体評価+具体的な発音指摘3〜5点。各指摘は改行区切り、フレーズ引用→◆解説の形式。日本語で。",\n' +
      '  "feedback_2": "別の切り口のFB候補。リズム・イントネーション観点多め。日本語で。",\n' +
      '  "feedback_3": "もう1つの候補。良かった点を多めに褒めつつ1-2点だけ改善点。日本語で。"\n' +
      '}';

    var res = callGPT(apiKey, prompt);
    if (!res) return null;

    var result = JSON.parse(res);
    result.timestamp = new Date();
    result.pronunciation_score = Number(result.pronunciation_score) || 5;
    result.fluency_score = Number(result.fluency_score) || 5;
    result.correction_count = Number(result.correction_count) || 0;
    return result;
  } catch (err) {
    Logger.log('analyzeShadowing エラー: ' + err.toString());
    return null;
  }
}

// ============================================================
// GPT共通呼び出し
// ============================================================
function callGPT(apiKey, prompt) {
  try {
    var res = UrlFetchApp.fetch('https://api.openai.com/v1/chat/completions', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      payload: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: 'JSONのみで回答してください。マークダウンのバッククォートは使わないでください。' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        response_format: { type: 'json_object' },
      }),
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) {
      Logger.log('GPT API エラー: ' + res.getResponseCode() + ' ' + res.getContentText());
      return null;
    }
    var data = JSON.parse(res.getContentText());
    return data.choices[0].message.content;
  } catch (err) {
    Logger.log('callGPT エラー: ' + err.toString());
    return null;
  }
}

// ============================================================
// LINE Content API
// ============================================================
function fetchLineContent(token, messageId) {
  try {
    var res = UrlFetchApp.fetch('https://api-data.line.me/v2/bot/message/' + messageId + '/content', {
      headers: { 'Authorization': 'Bearer ' + token },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) {
      Logger.log('LINE Content API エラー: ' + res.getResponseCode());
      return null;
    }
    return res.getBlob();
  } catch (err) {
    Logger.log('fetchLineContent エラー: ' + err.toString());
    return null;
  }
}

// ============================================================
// Whisper文字起こし
// ============================================================
function transcribeWithWhisper(apiKey, audioBlob) {
  try {
    var res = UrlFetchApp.fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'post',
      headers: { 'Authorization': 'Bearer ' + apiKey },
      payload: {
        'file': audioBlob.setName('audio.m4a'),
        'model': 'whisper-1',
        'language': 'en',
        'response_format': 'verbose_json',
      },
      muteHttpExceptions: true,
    });
    if (res.getResponseCode() !== 200) {
      Logger.log('Whisper API エラー: ' + res.getResponseCode() + ' ' + res.getContentText());
      return null;
    }
    var data = JSON.parse(res.getContentText());
    return { text: data.text, duration: data.duration || null };
  } catch (err) {
    Logger.log('transcribeWithWhisper エラー: ' + err.toString());
    return null;
  }
}

// ============================================================
// 生徒シート書き込み(1分スピーチ)
// ============================================================
function writeToStudentSheet(student, analysis) {
  try {
    var ss = SpreadsheetApp.openById(student.sheetId);
    var sheet = ss.getSheetByName(ONE_MIN_SHEET_NAME);
    if (!sheet) {
      notifyMiesan('⚠️ ' + student.name + 'さんのシートに「' + ONE_MIN_SHEET_NAME + '」タブがありません。');
      return;
    }

    var dCol = sheet.getRange('D3:D').getValues();
    var targetRow = -1;
    for (var i = 0; i < dCol.length; i++) {
      if (!dCol[i][0] || dCol[i][0] === '') { targetRow = i + 3; break; }
    }
    if (targetRow === -1) {
      notifyMiesan('⚠️ ' + student.name + 'さんのシートに空き行がありません。');
      return;
    }

    sheet.getRange(targetRow, 2).setValue(Utilities.formatDate(analysis.timestamp, 'Asia/Tokyo', 'yyyy/MM/dd'));
    sheet.getRange(targetRow, 4).setValue(analysis.wpm);
    sheet.getRange(targetRow, 5).setValue(analysis.transcript);
    Logger.log('[' + student.name + '] Row ' + targetRow + ' に書き込み完了');
  } catch (err) {
    Logger.log('writeToStudentSheet エラー: ' + err.toString());
    notifyMiesan('⚠️ ' + student.name + 'さんのスプレッドシート書き込みに失敗: ' + err.toString());
  }
}

// ============================================================
// 管理シートFB候補(種別対応)
// v5.1: K=ステータス(待ち/送信済み), L=最終FB文面, M=行UUID を追加(13列)
// ============================================================
function writeFeedbackToAdminSheet(student, taskType, analysis) {
  try {
    var adminId = PropertiesService.getScriptProperties().getProperty('ADMIN_SHEET_ID');
    var ss = SpreadsheetApp.openById(adminId);
    var sheet = ss.getSheetByName(FEEDBACK_SHEET_NAME);

    if (!sheet) {
      sheet = ss.insertSheet(FEEDBACK_SHEET_NAME);
      sheet.getRange(1, 1, 1, 13).setValues([[
        '日時', '種別', '生徒名', 'スコア1', 'スコア2',
        '文字起こし', 'FB候補①', 'FB候補②', 'FB候補③', '備考',
        'ステータス', '最終FB文面', '行UUID'
      ]]);
      sheet.setFrozenRows(1);
    }

    var score1, score2, note;
    if (taskType === '1分スピーチ') {
      score1 = 'WPM: ' + (analysis.wpm || '-');
      score2 = 'フィラー: ' + (analysis.filler_count || 0) + ' / 流暢さ: ' + (analysis.fluency_score || '-');
      note = '';
    } else if (taskType === 'シャドーイング') {
      score1 = '発音: ' + (analysis.pronunciation_score || '-') + '/10';
      score2 = '流暢さ: ' + (analysis.fluency_score || '-') + '/10';
      note = '指摘数: ' + (analysis.correction_count || 0);
    } else if (taskType === 'ライティング') {
       score1 = 'ライティング語数: ' + (analysis.writing_word_count || '-');
       score2 = 'スピーチ語数: ' + (analysis.speech_word_count || '-');
       note = '未活用表現: ' + (analysis.gap_count || 0) + '個 | ' + (analysis.gap_expressions || '');
     } else if (taskType === '速読') {
       score1 = 'チャンキング: ' + (analysis.chunking_score || '-') + '/10';
       score2 = '要約: ' + (analysis.summary_score || '-') + '/10';
       note = '修正箇所: ' + (analysis.correction_count || 0) + ' | 生徒: ' + (analysis.student_chunking || '').substring(0, 100);
     } else {
       score1 = '-'; score2 = '-'; note = '';
     }

    sheet.appendRow([
      Utilities.formatDate(analysis.timestamp, 'Asia/Tokyo', 'yyyy/MM/dd HH:mm'),
      taskType,
      student.name,
      score1, score2,
      analysis.transcript || '',
      analysis.feedback_1 || '',
      analysis.feedback_2 || '',
      analysis.feedback_3 || '',
      note,
      '待ち',                // K: ステータス
      '',                    // L: 最終FB文面(approve時に記入)
      Utilities.getUuid(),   // M: 行UUID
    ]);
  } catch (err) {
    Logger.log('writeFeedbackToAdminSheet エラー: ' + err.toString());
    notifyMiesan('⚠️ ' + student.name + 'さんのFB候補書き込みに失敗: ' + err.toString());
  }
}

// ============================================================
// LINE Reply / Push
// ============================================================
function replyToUser(token, replyToken, message) {
  try {
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/reply', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + token },
      payload: JSON.stringify({
        replyToken: replyToken,
        messages: [{ type: 'text', text: message }]
      }),
      muteHttpExceptions: true,
    });
  } catch (err) {
    Logger.log('replyToUser エラー: ' + err.toString());
  }
}

function notifyMiesan(message) {
  if (!MIESAN_USER_ID) {
    Logger.log('みえさんへの通知(未設定): ' + message);
    return;
  }
  try {
    var config = getConfig();
    UrlFetchApp.fetch('https://api.line.me/v2/bot/message/push', {
      method: 'post',
      contentType: 'application/json',
      headers: { 'Authorization': 'Bearer ' + config.LINE_TOKEN },
      payload: JSON.stringify({
        to: MIESAN_USER_ID,
        messages: [{ type: 'text', text: message }]
      }),
      muteHttpExceptions: true,
    });
  } catch (err) {
    Logger.log('notifyMiesan エラー: ' + err.toString());
  }
}

// ============================================================
// 生徒管理
// ============================================================
function getStudentMap() {
  var sheetId = PropertiesService.getScriptProperties().getProperty('ADMIN_SHEET_ID');
  var sheet = SpreadsheetApp.openById(sheetId).getSheetByName('生徒管理');
  var rows = sheet.getDataRange().getValues();
  var map = {};
  for (var i = 1; i < rows.length; i++) {
    var lineId = rows[i][0];
    if (!lineId) continue;
    var status = (rows[i][3] || '').toString().toLowerCase().trim();
    if (status !== 'active') continue;  // inactive はスキップ
    map[lineId] = { name: rows[i][1], sheetId: rows[i][2] };
  }
  return map;
}

// ============================================================
// 設定確認
// ============================================================
function checkSetup() {
  var config = getConfig();
  var props = PropertiesService.getScriptProperties();
  Logger.log('=== 設定確認 (v5.1) ===');
  Logger.log('LINE_TOKEN      : ' + (config.LINE_TOKEN ? '✅' : '❌'));
  Logger.log('OPENAI_KEY      : ' + (config.OPENAI_KEY ? '✅' : '❌'));
  Logger.log('ADMIN_SHEET_ID  : ' + (props.getProperty('ADMIN_SHEET_ID') ? '✅' : '❌'));
  Logger.log('WEBAPP_API_KEY  : ' + (props.getProperty('WEBAPP_API_KEY') ? '✅' : '❌ Webアプリ利用に必須'));
  Logger.log('TEMPLATE_SHEET_ID: ' + (props.getProperty('TEMPLATE_SHEET_ID') ? '✅' : '⏭️ 未設定(生徒追加メニューに必要)'));
  Logger.log('MIESAN_ID       : ' + (MIESAN_USER_ID ? '✅' : '⏭️ 未設定'));
  Logger.log('AI処理対象      : ' + AUTO_PROCESS_TYPES.join(', '));
  var STUDENT_MAP = getStudentMap();
  Logger.log('生徒数          : ' + Object.keys(STUDENT_MAP).length + '名');
  for (var uid in STUDENT_MAP) {
    var s = STUDENT_MAP[uid];
    try {
      var ss = SpreadsheetApp.openById(s.sheetId);
      Logger.log('  ' + s.name + ' : ✅ (' + ss.getName() + ')');
    } catch (err) {
      Logger.log('  ' + s.name + ' : ❌ アクセス不可');
    }
  }
}
