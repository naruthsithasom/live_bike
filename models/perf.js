// Model: ประสิทธิภาพเครื่อง (หน้า /monitor)
// CPU / RAM อ่านจาก Node ทุก 1 วิ · GPU / เน็ต / อุณหภูมิ / โปรแกรม (Chrome, TikTok LIVE Studio) อ่านจาก Windows
// ผ่าน PowerShell — เปิดเฉพาะตอนมีคนเปิดหน้า /monitor อยู่ (ปิดเองหลังไม่มีคนดู 20 วิ) ไม่กินเครื่องตอนไลฟ์ปกติ
const os = require('os');
const hub = require('../lib/hub');
const live = require('./live');
const { race } = require('./race');
const db = require('./index');

const PERF_EV = new Set(['gift', 'like', 'chat', 'join', 'follow', 'social']);
const perf = { cpu: 0, prev: null, nodeCpu: 0, nodePrev: null, sys: null, sysAt: 0, ps: null, wantUntil: 0, pages: new Map(), ev: [] };

// นับเหตุการณ์ที่ส่งไปหน้าเกม (ต่อนาที)
hub.onBroadcast(obj => {
  if (!PERF_EV.has(obj.type)) return;
  perf.ev.push([Date.now(), obj.type]);
  if (perf.ev.length > 5000) perf.ev.splice(0, 1000);
});

function cpuSnap() { let idle = 0, total = 0; for (const c of os.cpus()) { for (const k in c.times) total += c.times[k]; idle += c.times.idle; } return { idle, total }; }
setInterval(() => {
  const s = cpuSnap();
  if (perf.prev) { const dt = s.total - perf.prev.total; perf.cpu = dt > 0 ? Math.round(1000 * (1 - (s.idle - perf.prev.idle) / dt)) / 10 : 0; }
  perf.prev = s;
  const u = process.cpuUsage(), t = Date.now();
  if (perf.nodePrev) perf.nodeCpu = Math.round(((u.user + u.system - perf.nodePrev.u) / 1000) / (t - perf.nodePrev.t) / os.cpus().length * 1000) / 10;
  perf.nodePrev = { u: u.user + u.system, t };
  if (perf.ps && Date.now() > perf.wantUntil) { try { perf.ps.kill(); } catch (e) { /* ignore */ } perf.ps = null; }
}, 1000).unref();

const PS_SAMPLER = [
  "$ErrorActionPreference='SilentlyContinue'",
  '$cores=[Environment]::ProcessorCount',
  "$watch=@('chrome','TikTok LIVE Studio','node','obs64')",
  "$gpuName=((Get-CimInstance Win32_VideoController | Select-Object -ExpandProperty Name) -join ' + ')",
  'while($true){',
  '  if(-not (Get-Process -Id $env:MTB_PARENT)){ exit }',   // เซิร์ฟเวอร์เกมปิดแล้ว → ปิดตัวเองด้วย
  '  $o=@{gpuName=$gpuName}',
  '  $t=Get-CimInstance Win32_PerfFormattedData_Counters_ThermalZoneInformation',
  '  if($t){ $o.tempC=[math]::Round((($t|Measure-Object Temperature -Maximum).Maximum)-273.15,1) }',
  '  $n=Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface',
  '  if($n){ $o.rx=($n|Measure-Object BytesReceivedPersec -Sum).Sum; $o.tx=($n|Measure-Object BytesSentPersec -Sum).Sum; $o.bw=($n|Measure-Object CurrentBandwidth -Maximum).Maximum }',
  '  $pids=@{}; foreach($p in Get-Process -Name $watch){ $pids[[string]$p.Id]=$p.ProcessName }',
  '  $gt=0; $gapp=@{}',
  '  foreach($e in Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine){',
  "    if($e.Name -like '*engtype_3D*'){ $gt+=$e.UtilizationPercentage",
  "      if($e.Name -match '^pid_(\\d+)_'){ $nm=$pids[$Matches[1]]; if($nm){ $gapp[$nm]=[int]$gapp[$nm]+$e.UtilizationPercentage } } } }",
  '  $o.gpu=[math]::Min(100,$gt); $o.gpuApp=$gapp',
  '  $m=Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUAdapterMemory',
  '  if($m){ $o.vram=($m|Measure-Object DedicatedUsage -Sum).Sum; $o.vramShared=($m|Measure-Object SharedUsage -Sum).Sum }',
  '  $apps=@{}',
  "  foreach($p in Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -Filter \"Name like 'chrome%' or Name like 'TikTok LIVE Studio%' or Name like 'node%' or Name like 'obs64%'\"){",
  "    $b=$p.Name -replace '#\\d+$',''",
  '    if(-not $apps[$b]){ $apps[$b]=@{cpu=0;ram=0;n=0} }',
  '    $apps[$b].cpu+=$p.PercentProcessorTime; $apps[$b].ram+=$p.WorkingSetPrivate; $apps[$b].n++ }',
  '  foreach($k in @($apps.Keys)){ $apps[$k].cpu=[math]::Round($apps[$k].cpu/$cores,1) }',
  '  $o.apps=$apps',
  '  [Console]::Out.WriteLine(($o|ConvertTo-Json -Compress -Depth 4))',
  '  Start-Sleep -Milliseconds 2500',
  '}',
].join('\n');
function ensureSampler() {
  perf.wantUntil = Date.now() + 20000;
  if (perf.ps || process.platform !== 'win32') return;
  const { spawn } = require('child_process');
  const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', Buffer.from(PS_SAMPLER, 'utf16le').toString('base64')], { windowsHide: true, env: { ...process.env, MTB_PARENT: String(process.pid) } });
  perf.ps = ps;
  let buf = '';
  ps.stdout.on('data', d => {
    buf += d.toString('utf8');
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (line.startsWith('{')) { try { perf.sys = JSON.parse(line); perf.sysAt = Date.now(); } catch (e) { /* ignore */ } }
    }
  });
  ps.on('exit', () => { if (perf.ps === ps) perf.ps = null; });
  ps.on('error', () => { if (perf.ps === ps) perf.ps = null; });
}
function stopSampler() { if (perf.ps) { try { perf.ps.kill(); } catch (e) { /* ignore */ } perf.ps = null; } }

// ค่าประสิทธิภาพของหน้าเกมแต่ละหน้า (FPS ฯลฯ) ที่ส่งมาพร้อมสถานะแผงผู้ดูแล
function setPage(p) { if (p && typeof p === 'object' && p.id) perf.pages.set(String(p.id).slice(0, 20), { ...p, at: Date.now() }); }

function stats() {
  ensureSampler();
  const now = Date.now(), ev = {};
  perf.ev = perf.ev.filter(e => now - e[0] < 60000);
  for (const [, t] of perf.ev) ev[t] = (ev[t] || 0) + 1;
  const pages = [];
  for (const [id, p] of perf.pages) { if (now - p.at > 15000) perf.pages.delete(id); else pages.push({ ...p, age: now - p.at }); }
  const mu = process.memoryUsage(), total = os.totalmem(), free = os.freemem();
  return {
    now, cpu: perf.cpu, cores: os.cpus().length, cpuModel: (os.cpus()[0] || {}).model || '', ramTotal: total, ramUsed: total - free,
    node: { cpu: perf.nodeCpu, rss: mu.rss, heap: mu.heapUsed, uptime: Math.round(process.uptime()) },
    sys: perf.sys, sysAge: perf.sysAt ? now - perf.sysAt : -1, sampler: !!perf.ps,
    pages, server: { tiktok: live.status, username: live.username, viewers: live.viewers, likes: live.likes, clients: hub.clients.size, roster: race.roster.size, stage: race.stageNo, db: db.state.ok, ev },
  };
}

module.exports = { stats, setPage, stopSampler };
