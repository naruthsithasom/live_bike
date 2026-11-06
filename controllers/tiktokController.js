// Controller: เชื่อม TikTok LIVE แล้วแปลงเหตุการณ์ (ของขวัญ แชท ไลก์ ติดตาม ฯลฯ) เป็นคำสั่งให้เกม
const { config } = require('../config/index');
const { broadcast } = require('../lib/hub');
const { avatarOf, viewerOf } = require('../lib/tiktokUser');
const live = require('../models/live');
const raceModel = require('../models/race');
const catalog = require('../models/giftCatalog');
const viewer = require('../models/viewer');
const evlog = require('../models/eventlog');
const { handleGift } = require('./giftController');

// การเชื่อมปัจจุบัน (เชื่อมใหม่/ตัดได้จากปุ่มในแผงผู้ดูแล) · gen เปลี่ยน = ยกเลิกการลองใหม่ของรอบเก่า
const tk = { gen: 0, conn: null, giftTimer: null, retryTimer: null, giftWarned: false };

function stop(quiet) {
  tk.gen++;
  clearTimeout(tk.retryTimer); clearInterval(tk.giftTimer);
  if (tk.conn) { try { tk.conn.disconnect(); } catch (e) { /* ignore */ } }
  tk.conn = null;
  live.status = 'off'; live.username = ''; live.error = '';
  if (!quiet) { console.log('⛔ ตัดการเชื่อม TikTok แล้ว'); broadcast({ type: 'status', live }); }
}

async function start(uniqueId) {
  stop(true);
  const gen = tk.gen;
  let lib;
  try { lib = await import('tiktok-live-connector'); }
  catch (e) { console.error('❌ ไม่พบ tiktok-live-connector — รัน "npm install" ก่อน'); return; }
  if (gen !== tk.gen) return;
  const { TikTokLiveConnection, WebcastEvent, ControlEvent } = lib;
  live.username = uniqueId;
  console.log(`🔗 กำลังเชื่อม TikTok Live @${uniqueId}`);
  let likeBucket = 0;
  let retry = 5000, waitLogged = false;
  const later = (fn, ms) => { clearTimeout(tk.retryTimer); tk.retryTimer = setTimeout(() => { if (gen === tk.gen) fn(); }, ms); };

  // tiktok-live-connector v2 ต้องส่ง options (อย่างน้อย {}) ไม่งั้นเซิร์ฟเวอร์พัง
  const newConn = () => new TikTokLiveConnection(uniqueId, {});
  // v2: ดึงรายการของขวัญได้หลังเชื่อมห้องไลฟ์แล้วเท่านั้น (ต้องมี roomId)
  const loadGifts = () => {
    const c = tk.conn;
    if (!c || live.status !== 'connected' || gen !== tk.gen) return;
    c.fetchAvailableGifts().then(list => {
      const arr = (Array.isArray(list) ? list : (list && list.gifts) || []).map(g => ({
        name: g.name, diamonds: g.diamond_count || g.diamondCount || 1,
        image: (g.image && (g.image.url_list || g.image.urlList || [])[0]) || (g.icon && (g.icon.url_list || [])[0]) || '',
      })).filter(g => g.name).sort((a, b) => a.diamonds - b.diamonds);
      if (arr.length) { catalog.setFromTikTok(arr); console.log(`🎁 โหลดรายการของขวัญ TikTok ${arr.length} ชิ้น`); }
    }).catch(err => {
      // TikTok/EulerStream ล็อกการดึงรายการของขวัญไว้ให้แพ็กเกจเสียเงิน → ใช้รายการสำรอง + จำรูปจากของขวัญที่ผู้ชมส่งจริง
      if (tk.giftWarned) return;
      tk.giftWarned = true;
      const msg = String(err && err.message ? err.message : err);
      console.warn(/Business plan|eulerstream/i.test(msg)
        ? 'ℹ️  ดึงรายการของขวัญทั้งหมดจาก TikTok ไม่ได้ (ต้องใช้แพ็กเกจเสียเงินของ EulerStream) — ใช้รายการสำรอง และจะจำรูปของขวัญจากที่ผู้ชมส่งจริงแทน (ของขวัญยังทำงานปกติ)'
        : `⚠️  ดึงรายการของขวัญไม่ได้ ใช้รายการสำรอง: ${msg.slice(0, 160)}`);
    });
  };
  tk.giftTimer = setInterval(loadGifts, 30 * 60 * 1000);

  const connect = () => {
    if (gen !== tk.gen) return;
    let conn;
    try { conn = newConn(); }
    catch (e) {
      live.status = 'offline'; live.error = String(e.message || e).slice(0, 160);
      console.warn(`⚠️  เชื่อม @${uniqueId} ไม่ได้ (${live.error})`);
      broadcast({ type: 'status', live });
      return later(connect, 30000);
    }
    tk.conn = conn;
    live.status = 'connecting';
    broadcast({ type: 'status', live });
    // 📜 ดักทุกเหตุการณ์ที่ไลบรารีรู้จัก (70+ ชนิด) ลง log — แยกจากระบบเกม ไม่กระทบการทำงานเดิม
    for (const ev of new Set(Object.values(WebcastEvent || {}))) {
      conn.on(ev, data => { if (gen === tk.gen) evlog.add(ev, data); });
    }
    for (const ev of new Set(Object.values(ControlEvent || {}))) {
      if (ev === 'rawData' || ev === 'decodedData' || ev === 'websocketData') continue;   // ข้อมูลระดับล่าง เยอะเกินไป
      conn.on(ev, data => { if (gen === tk.gen) evlog.add(ev, data && typeof data === 'object' ? data : { info: data }); });
    }
    conn.connect().then(st => {
      if (gen !== tk.gen) { try { conn.disconnect(); } catch (e) { /* ignore */ } return; }
      retry = 5000; waitLogged = false;
      live.status = 'connected'; live.error = '';
      // รูปโปรไฟล์/ชื่อของเจ้าของไลฟ์ (คนสร้าง) ใช้กับนักปั่นของคนสร้างในโหมดแข่ง
      try {
        const ri = st && (st.roomInfo || {});
        const ow = ri.owner || (ri.data && ri.data.owner) || (ri.room && ri.room.owner) || null;
        if (ow) { live.ownerAvatar = avatarOf(ow) || live.ownerAvatar || ''; live.ownerNick = ow.nickname || live.ownerNick || ''; }
      } catch (e) { /* ignore */ }
      console.log(`✅ เชื่อม TikTok Live @${uniqueId} แล้ว (room ${st.roomId})`);
      broadcast({ type: 'status', live });
      broadcast({ type: 'social', ev: 'connected', text: `✅ เชื่อมไลฟ์ @${uniqueId} สำเร็จ!` });
      loadGifts();
    }).catch(err => {
      if (gen !== tk.gen) return;
      live.status = 'offline';
      live.error = err && err.message ? String(err.message).slice(0, 160) : String(err);
      broadcast({ type: 'status', live });
      // ยังไม่ได้ไลฟ์: เช็กทุก 10 วินาทีตลอด (กด Go LIVE แล้วติดเร็ว) และไม่พิมพ์ซ้ำทุกรอบ
      if (/isn't online|not online|offline/i.test(live.error)) {
        if (!waitLogged) { console.log(`⏳ รอ @${uniqueId} เริ่มไลฟ์ — เช็กทุก 10 วินาที กด Go LIVE ใน TikTok ได้เลย`); waitLogged = true; }
        return later(connect, 10000);
      }
      console.warn(`⚠️  เชื่อม @${uniqueId} ไม่ได้ (${live.error}) — ลองใหม่ใน ${retry / 1000}s`);
      later(connect, retry);
      retry = Math.min(retry * 2, 60000);
    });

    conn.on(WebcastEvent.GIFT, data => {
      const g = data.giftDetails || {};
      // ของขวัญแบบส่งต่อเนื่อง (giftType 1) ให้รอจนจบ streak
      if (g.giftType === 1 && !data.repeatEnd) return;
      const u = data.user || {};
      const target = raceModel.teams.has(u.uniqueId) ? raceModel.teams.get(u.uniqueId) : 0;
      raceModel.joinIfFollower(data);
      catalog.learn(g.giftName, g.diamondCount, (g.giftImage && (g.giftImage.url || g.giftImage.urlList || [])[0]) || data.giftPictureUrl || '');
      handleGift({ user: u.nickname || u.uniqueId || 'ผู้ชม', uniqueId: u.uniqueId || '', avatar: avatarOf(u), giftName: g.giftName || `Gift#${data.giftId}`, count: data.repeatCount || 1, diamonds: g.diamondCount || 1, target });
    });
    conn.on(WebcastEvent.CHAT, data => {
      const u = data.user || {};
      const fol = raceModel.joinIfFollower(data);
      const textMsg = String(data.comment || '').slice(0, 120);
      // แชท: ส่งให้หน้าเกม (หน้าเกมแสดงเฉพาะคนที่ส่งของขวัญแล้ว)
      if (u.uniqueId && textMsg) {
        broadcast({ type: 'chat', ...viewerOf(u), text: textMsg, donor: raceModel.donors.has(u.uniqueId), follower: fol || raceModel.race.roster.has(u.uniqueId) });
        console.log(`💬 ${u.nickname || u.uniqueId}: ${textMsg}`);
      }
      const c = raceModel.parseTeam(data.comment);
      if (c < 0 || !u.uniqueId) return;
      raceModel.teams.set(u.uniqueId, c);
      viewer.setTeam({ uniqueId: u.uniqueId, nickname: u.nickname, avatar: avatarOf(u), team: c });
      broadcast({ type: 'team', user: u.nickname || u.uniqueId, char: c });
      console.log(`📣 ${u.nickname || u.uniqueId} เชียร์ ${raceModel.CHARS[c]}`);
    });
    conn.on(WebcastEvent.LIKE, data => {
      const n = data.likeCount || 1;
      live.likes = data.totalLikeCount || live.likes + n;
      // เคาะจอรายคน → นักปั่นของคนนั้นลุ้นขึ้นนำ (โหมด survival / ทีมชาติ)
      const lu = data.user || {};
      if (lu.uniqueId) {
        raceModel.joinIfFollower(data);
        broadcast({ type: 'like', ...viewerOf(lu), count: n });
      }
      likeBucket += n;
      const per = config.likesPerJump || 100;
      while (likeBucket >= per) {
        likeBucket -= per;
        broadcast({ type: 'gift', kind: 'like', user: '❤️ ไลก์รวม', giftName: `${per} ไลก์`, count: 1, diamonds: 0, action: 'jump', repeat: 1 });
      }
      broadcast({ type: 'likes', likes: live.likes });
    });
    // ดักคนกดติดตาม → เพิ่มนักปั่นของคนนั้นในโหมดแข่ง (ชื่อขึ้นบนนักปั่น + ประกาศชื่อ)
    const onFollow = data => {
      const u = data.user || {};
      if (!u.uniqueId) return;
      if (raceModel.race.roster.has(u.uniqueId)) return;   // กดติดตามซ้ำ/เหตุการณ์ซ้ำ → ไม่ประกาศซ้ำ
      raceModel.addFollower({ uniqueId: u.uniqueId, nickname: u.nickname || u.uniqueId, avatar: avatarOf(u) });
      console.log(`💖 ${u.nickname || u.uniqueId} กดติดตาม`);
    };
    conn.on(WebcastEvent.FOLLOW, onFollow);
    // สำรอง: TikTok บางครั้งส่งการติดตาม/แชร์มาเป็น social ที่ชื่อ key ต่างไป (ตัวพิมพ์ใหญ่ ฯลฯ) → ดักซ้ำอีกชั้น
    conn.on(WebcastEvent.SOCIAL, data => {
      const dt = data && data.common && data.common.displayText;
      const key = String((dt && (dt.key || dt.defaultPattern)) || '').toLowerCase();
      if (key.includes('follow')) onFollow(data);
      else if (key.includes('share')) { const v = viewerOf(data.user); if (v.uniqueId) broadcast({ type: 'social', ev: 'share', ...v, text: `📣 ${v.nickname} แชร์ไลฟ์!` }); }
    });
    // เหตุการณ์อื่นที่นิยมประกาศในไลฟ์: สมัครสมาชิก / ซูเปอร์แฟน / กล่องสมบัติ / คำถาม / PK / จำนวนคนดู
    const social = (ev, data, text) => { const v = viewerOf(data && data.user); broadcast({ type: 'social', ev, ...v, text: text(v.nickname || 'ผู้ชม') }); };
    conn.on('subNotify', d => social('sub', d, n => `⭐ ${n} สมัครสมาชิก!`));
    conn.on('superFanJoin', d => social('superfan', d, n => `🌟 ${n} เป็นซูเปอร์แฟน!`));
    conn.on('envelope', d => social('chest', d, n => `🎁 ${n} แจกกล่องสมบัติ!`));
    conn.on('questionNew', d => {
      const q = d && (d.details || d.questionDetails || {});
      social('question', { user: (q && q.user) || d.user }, n => `❓ ${n} ถาม: ${String((q && (q.text || q.content)) || '').slice(0, 80)}`);
    });
    conn.on('linkMicBattle', () => broadcast({ type: 'social', ev: 'pk', text: '⚔️ เริ่ม PK แล้ว!' }));
    let lastViewers = 0;
    conn.on(WebcastEvent.ROOM_USER, d => {
      const n = (d && (d.viewerCount || d.total)) | 0;
      if (!n) return;
      live.viewers = n;
      // ประกาศเมื่อคนดูทะลุหลักใหม่ (10, 20, 50, 100, 200, 500, 1000 ...)
      const steps = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
      const hit = steps.filter(s => n >= s && lastViewers < s).pop();
      if (hit && lastViewers) broadcast({ type: 'social', ev: 'viewers', count: hit, text: `👀 คนดูทะลุ ${hit} คนแล้ว!` });
      lastViewers = Math.max(lastViewers, n);
    });
    conn.on(WebcastEvent.SHARE, data => {
      const v = viewerOf(data.user);
      raceModel.joinIfFollower(data);
      broadcast({ type: 'social', ev: 'share', ...v, text: `📣 ${v.nickname} แชร์ไลฟ์!` });
      console.log(`📣 ${v.nickname} แชร์ไลฟ์`);
    });
    // คนเข้าห้อง (Join) — ถ้าติดตามอยู่แล้วเข้าร่วมแข่งทันที
    conn.on(WebcastEvent.MEMBER, data => {
      const v = viewerOf(data.user);
      if (!v.uniqueId) return;
      const fol = raceModel.joinIfFollower(data);
      broadcast({ type: 'join', ...v, follower: fol || raceModel.race.roster.has(v.uniqueId) });
      console.log(`👋 ${v.nickname} เข้าห้อง${fol ? ' (ติดตามอยู่แล้ว)' : ''}`);
    });
    conn.on(WebcastEvent.STREAM_END, () => {
      if (gen !== tk.gen) return;
      live.status = 'offline';
      console.log('📴 ไลฟ์จบแล้ว — จะลองเชื่อมใหม่');
      broadcast({ type: 'status', live });
      broadcast({ type: 'social', ev: 'end', text: '📴 ไลฟ์จบแล้ว — ขอบคุณทุกคนที่มาเชียร์!' });
      raceModel.donors.clear();
      later(connect, 30000);
    });
    conn.on('disconnected', () => {
      if (gen !== tk.gen) return;
      if (live.status === 'connected') {
        live.status = 'offline';
        console.log('⚠️  หลุดการเชื่อมต่อไลฟ์ — กำลังเชื่อมใหม่');
        broadcast({ type: 'status', live });
        broadcast({ type: 'social', ev: 'lost', text: '⚠️ การเชื่อมไลฟ์หลุด — กำลังเชื่อมใหม่...' });
        later(connect, retry);
      }
    });
  };
  connect();
}

module.exports = { start, stop };
