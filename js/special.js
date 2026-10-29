/* ============================================================
   special.js — fase especial (túnel) para pegar as Esmeraldas
   ============================================================ */
(function () {
  'use strict';
  var S = window.S;
  var SP = S.Special = {};

  SP.HORIZON = 116;
  SP.TUBE_R = 150;
  SP.PASSO = 78;      // distância entre as faixas do túnel
  SP.FAIXA = 20;      // espessura da faixa em unidades de mundo

  /* telões com o cenário de Brasília, pré-renderizados uma vez */
  function preTela(tema) {
    var big = document.createElement('canvas');
    big.width = S.W; big.height = S.H;
    var bc = big.getContext('2d');
    try { S.Gfx.drawBackground(bc, tema, { x: 160, y: 60 }, 0); }
    catch (e) { bc.fillStyle = '#123'; bc.fillRect(0, 0, S.W, S.H); }

    var sm = document.createElement('canvas');
    sm.width = 190; sm.height = 92;
    var sc = sm.getContext('2d');
    sc.drawImage(big, 30, 28, 580, 281, 0, 0, 190, 92);
    sc.globalCompositeOperation = 'lighter';
    sc.globalAlpha = .2;
    sc.drawImage(big, 30, 28, 580, 281, 0, 0, 190, 92);
    sc.globalAlpha = 1;
    sc.globalCompositeOperation = 'source-atop';
    sc.fillStyle = 'rgba(26,96,200,.4)';
    sc.fillRect(0, 0, 190, 92);
    sc.fillStyle = 'rgba(4,10,34,.16)';
    for (var y = 0; y < 92; y += 3) sc.fillRect(0, y, 190, 1);
    sc.globalCompositeOperation = 'source-over';
    return sm;
  }

  SP.start = function (emeraldIndex, charId, onDone) {
    var rng = S.mulberry32(1337 + emeraldIndex * 977);
    var st = SP.state = {
      idx: emeraldIndex, charId: charId, onDone: onDone,
      phi: 0, vphi: 0, t: 0, z: 0, speed: 7,
      rings: 0, target: 40 + emeraldIndex * 8,
      objs: [], telas: [], phase: 'intro', phaseT: 0,
      rng: rng, hop: 0, flash: 0,
      arte: [preTela('congresso'), preTela('stf'), preTela('banco')],
      estrelas: []
    };
    for (var e = 0; e < 70; e++) {
      st.estrelas.push({ x: rng() * S.W, y: rng() * S.H, b: .25 + rng() * .75, f: rng() * 6.28 });
    }
    for (var i = 0; i < 120; i++) SP.addRow(st, 300 + i * 150);
    for (var j = 0; j < 10; j++) SP.addTela(st, 380 + j * 460);
    S.Audio.playMusic('special');
    return st;
  };

  SP.addRow = function (st, z) {
    var r = st.rng();
    var base = st.rng() * Math.PI * 2;
    var kind, n, spread;
    if (r < .34) { kind = 'moeda'; n = 3 + Math.floor(st.rng() * 4); spread = .34; }
    else if (r < .54) { kind = 'ring'; n = 3 + Math.floor(st.rng() * 3); spread = .34; }
    else if (r < .66) { kind = 'moeda'; n = 6; spread = .5; }
    else if (r < .76) { kind = 'ring'; n = 4; spread = .5; }
    else if (r < .93) { kind = 'bomb'; n = 1 + Math.floor(st.rng() * 3); spread = .6; }
    else { kind = 'boost'; n = 1; spread = 0; }
    var fila = (kind === 'ring' || kind === 'moeda');
    for (var i = 0; i < n; i++) {
      st.objs.push({
        kind: kind,
        z: z + i * (fila ? 46 : 0),
        a: base + (fila ? 0 : i * spread),
        dead: false
      });
    }
  };

  SP.addTela = function (st, z) {
    var lado = st.rng() < .5 ? -1 : 1;
    st.telas.push({
      z: z,
      a: lado * (Math.PI / 2) + (st.rng() - .5) * .5,
      arte: Math.floor(st.rng() * 3)
    });
  };

  SP.norm = function (a) {
    while (a > Math.PI) a -= Math.PI * 2;
    while (a < -Math.PI) a += Math.PI * 2;
    return a;
  };

  SP.proj = function (a, dz) {
    var s = 300 / Math.max(26, dz + 70);
    return {
      s: s,
      x: S.W / 2 + Math.sin(a) * SP.TUBE_R * s * 1.05,
      y: SP.HORIZON + Math.cos(a) * SP.TUBE_R * s * .78
    };
  };

  SP.update = function (st) {
    var In = S.Input;
    st.t++;

    if (st.phase === 'intro') {
      st.phaseT++;
      if (st.phaseT > 150) { st.phase = 'run'; st.phaseT = 0; }
      return;
    }
    if (st.phase === 'win' || st.phase === 'lose') {
      st.phaseT++;
      if (st.phaseT > 170 || (st.phaseT > 40 && In.pressed('confirm'))) {
        S.Audio.stopMusic();
        var win = st.phase === 'win';
        SP.state = null;
        st.onDone(win);
      }
      return;
    }

    var ax = In.axisX();
    st.vphi = S.approach(st.vphi, ax * .062, .009);
    st.phi += st.vphi;
    if (In.pressed('jump') && st.hop <= 0) { st.hop = 26; S.Audio.sfx('jump'); }
    if (st.hop > 0) st.hop--;
    if (st.flash > 0) st.flash--;

    st.speed = Math.min(13, st.speed + .0022);
    st.z += st.speed;

    var alive = 0, i;
    for (i = 0; i < st.objs.length; i++) {
      var o = st.objs[i];
      if (o.dead) continue;
      alive++;
      var dz = o.z - st.z;
      if (dz < -60) { o.dead = true; continue; }
      if (dz < 26 && dz > -26) {
        var da = Math.abs(SP.norm(o.a - st.phi));
        if (da < .42 && st.hop <= 0) {
          o.dead = true;
          if (o.kind === 'ring' || o.kind === 'moeda') {
            st.rings++; S.Audio.sfx('ring');
            S.Particles.burst(S.W / 2, S.H - 96, 5, {
              color: o.kind === 'moeda' ? '#ffd23c' : S.Gfx.pickupColor(st.charId),
              maxSpeed: 3, life: 16, size: 3
            });
          } else if (o.kind === 'bomb') {
            st.rings = Math.max(0, st.rings - 8);
            st.flash = 22; st.speed = Math.max(5, st.speed - 2.2);
            S.Audio.sfx('pop'); S.Game.shake(10);
          } else {
            st.speed = Math.min(15, st.speed + 2.4);
            S.Audio.sfx('shoes');
          }
        }
      }
    }
    if (alive < 90) SP.addRow(st, st.z + 1800 + st.rng() * 400);

    for (i = st.telas.length - 1; i >= 0; i--) {
      if (st.telas[i].z - st.z < -120) st.telas.splice(i, 1);
    }
    if (st.telas.length < 10) SP.addTela(st, st.z + 3900 + st.rng() * 500);

    if (st.rings >= st.target) {
      st.phase = 'win'; st.phaseT = 0;
      S.Audio.stopMusic(); S.Audio.sfx('emerald');
    } else if (st.t > 60 * 62) {
      st.phase = 'lose'; st.phaseT = 0;
      S.Audio.stopMusic(); S.Audio.sfx('cancel');
    }
  };
})();

/* ---------------- desenho da fase especial ---------------- */
(function () {
  'use strict';
  var S = window.S, SP = S.Special;

  var SEG = 22;   // segmentos por anel

  function anel(ctx, st, dz, lw) {
    ctx.beginPath();
    for (var a = 0; a <= SEG; a++) {
      var p = SP.proj(a / SEG * Math.PI * 2 - st.phi, dz);
      if (a === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.lineWidth = lw;
    ctx.stroke();
  }

  function emendas(ctx, st, dz, lw, s) {
    var n = 20, meia = lw / 2;
    ctx.strokeStyle = 'rgba(5,22,56,.5)';
    ctx.lineWidth = Math.min(3.4, Math.max(1, 1.5 * s));
    ctx.beginPath();
    for (var i = 0; i < n; i++) {
      var p = SP.proj(i / n * Math.PI * 2 - st.phi, dz);
      var dx = p.x - S.W / 2, dy = p.y - SP.HORIZON;
      var m = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= m; dy /= m;
      ctx.moveTo(p.x - dx * meia, p.y - dy * meia);
      ctx.lineTo(p.x + dx * meia, p.y + dy * meia);
    }
    ctx.stroke();
  }

  SP.drawTunel = function (ctx, st) {
    var passo = SP.PASSO;
    ctx.save();
    ctx.lineJoin = 'round';
    for (var k = 22; k >= 0; k--) {
      var dz = k * passo + 26 - (st.z % passo);
      if (dz < -24) continue;
      var s = 300 / Math.max(26, dz + 70);
      var lw = Math.max(1.1, SP.FAIXA * s);
      var fade = Math.max(.1, Math.min(1, 1.25 - k * .045));

      ctx.globalAlpha = fade * .12;
      ctx.strokeStyle = '#49d4ff';
      anel(ctx, st, dz, lw * 1.45);

      ctx.globalAlpha = fade;
      ctx.strokeStyle = '#06264c';
      anel(ctx, st, dz, lw);
      ctx.strokeStyle = '#1a7ec4';
      anel(ctx, st, dz, lw * .64);
      ctx.strokeStyle = '#7fe2ff';
      anel(ctx, st, dz, Math.max(.8, lw * .24));

      if (lw > 6) { ctx.globalAlpha = fade; emendas(ctx, st, dz, lw, s); }
    }
    ctx.restore();
  };

  SP.drawTelas = function (ctx, st) {
    var lista = st.telas.slice().sort(function (a, b) { return b.z - a.z; });
    for (var i = 0; i < lista.length; i++) {
      var tl = lista[i], dz = tl.z - st.z;
      if (dz < -60 || dz > 2400) continue;
      var p = SP.proj(tl.a - st.phi, dz);
      if (p.s < .08) continue;
      var art = st.arte[tl.arte];
      // inclinação leve para a frente, como painel na parede do túnel
      var tilt = S.clamp((p.x - S.W / 2) / (S.W / 2), -1.4, 1.4) * .26;
      ctx.save();
      ctx.globalAlpha = Math.min(.92, p.s * 2.2);
      ctx.translate(p.x, p.y);
      ctx.rotate(tilt);
      var sc = p.s * 1.3;
      ctx.scale(sc, sc);
      ctx.drawImage(art, -art.width / 2, -art.height / 2);
      ctx.strokeStyle = '#59c9ff';
      ctx.lineWidth = 3;
      ctx.strokeRect(-art.width / 2, -art.height / 2, art.width, art.height);
      ctx.strokeStyle = 'rgba(160,236,255,.5)';
      ctx.lineWidth = 1.4;
      ctx.strokeRect(-art.width / 2 + 4, -art.height / 2 + 4, art.width - 8, art.height - 8);
      ctx.restore();
    }
  };

  SP.drawBomba = function (ctx, t) {
    ctx.globalAlpha = .45;
    ctx.fillStyle = '#ff2f45';
    S.circle(ctx, 0, 0, 13); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0d0f1a'; S.circle(ctx, 0, 0, 9.4); ctx.fill();
    ctx.fillStyle = '#23283a'; S.circle(ctx, -2.4, -2.6, 6.4); ctx.fill();
    ctx.fillStyle = '#ff3b4f'; S.circle(ctx, 2.2, 1.4, 3.4); ctx.fill();
    ctx.fillStyle = '#ffd0d6'; S.circle(ctx, 1.4, .4, 1.3); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.4)';
    S.ellipse(ctx, -3.6, -4.6, 2.6, 1.5, -.6); ctx.fill();
    // faíscas
    ctx.strokeStyle = '#ffdf6b';
    ctx.lineWidth = 1.5; ctx.lineCap = 'round';
    for (var i = 0; i < 3; i++) {
      var a = -Math.PI / 2 + (i - 1) * .55 + Math.sin(t * .3 + i) * .12;
      var r = 10 + Math.abs(Math.sin(t * .4 + i * 2)) * 5;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * 8.6, Math.sin(a) * 8.6);
      ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      ctx.stroke();
    }
  };

  SP.draw = function (ctx, st) {
    var g = ctx.createRadialGradient(S.W / 2, SP.HORIZON, 10, S.W / 2, SP.HORIZON, S.W * .8);
    g.addColorStop(0, '#050a28');
    g.addColorStop(.45, '#101c55');
    g.addColorStop(1, '#070a26');
    ctx.fillStyle = g; ctx.fillRect(0, 0, S.W, S.H);

    var i;
    for (i = 0; i < st.estrelas.length; i++) {
      var e = st.estrelas[i];
      ctx.globalAlpha = e.b * (.5 + .5 * Math.abs(Math.sin(st.t * .03 + e.f)));
      ctx.fillStyle = '#dff1ff';
      ctx.fillRect(e.x, e.y, 2, 2);
    }
    ctx.globalAlpha = 1;

    SP.drawTunel(ctx, st);
    SP.drawTelas(ctx, st);

    var list = [];
    for (i = 0; i < st.objs.length; i++) {
      var o = st.objs[i];
      if (!o.dead && o.z - st.z > -30 && o.z - st.z < 2200) list.push(o);
    }
    list.sort(function (a, b) { return b.z - a.z; });
    for (var j = 0; j < list.length; j++) {
      var ob = list[j];
      var pp = SP.proj(ob.a - st.phi, ob.z - st.z);
      if (pp.s < .06) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(1, pp.s * 3.2);
      if (ob.kind === 'ring') {
        S.Gfx.pickup(ctx, pp.x, pp.y, st.t * 2 + ob.z, pp.s * 1.5, st.charId);
      } else if (ob.kind === 'moeda') {
        S.Gfx.moedaReal(ctx, pp.x, pp.y, st.t * 2 + ob.z, pp.s * 1.5);
      } else if (ob.kind === 'bomb') {
        ctx.translate(pp.x, pp.y); ctx.scale(pp.s * 1.35, pp.s * 1.35);
        SP.drawBomba(ctx, st.t + ob.z);
      } else {
        ctx.translate(pp.x, pp.y); ctx.scale(pp.s * 1.6, pp.s * 1.6);
        ctx.fillStyle = '#42f2c8';
        S.poly(ctx, [-2, -10, 5, -2, 0, -1, 4, 10, -5, 1, 0, 0]); ctx.fill();
      }
      ctx.restore();
    }

    var hopY = st.hop > 0 ? -Math.sin((26 - st.hop) / 26 * Math.PI) * 34 : 0;
    ctx.save();
    ctx.globalAlpha = .34; ctx.fillStyle = '#000';
    S.ellipse(ctx, S.W / 2, S.H - 68, 24 + hopY * .14, 7, 0); ctx.fill();
    ctx.restore();
    S.Gfx.drawChar(ctx, st.charId, {
      x: S.W / 2, y: S.H - 72 + hopY,
      state: st.hop > 0 ? 'roll' : 'run',
      t: st.t * 1.4, spin: st.t * .4, facing: 1, scale: 1.35
    });

    SP.drawHud(ctx, st);
    S.Particles.draw(ctx, { x: 0, y: 0 });

    if (st.flash > 0) {
      ctx.save();
      ctx.globalAlpha = st.flash / 22 * .55;
      ctx.fillStyle = '#ff2b2b'; ctx.fillRect(0, 0, S.W, S.H);
      ctx.restore();
    }

    if (st.phase === 'intro') {
      var n = 3 - Math.floor(st.phaseT / 40);
      S.UI.panel(ctx, S.W / 2 - 200, 100, 400, 140);
      S.text(ctx, 'FASE ESPECIAL', S.W / 2, 142, { size: 26, align: 'center', color: '#ffd23c', outline: '#3a1d00', outlineW: 5, shadow: false });
      S.text(ctx, 'PEGUE ' + st.target + ' ' + S.pickupLabel(st.charId) + ' EM 60s', S.W / 2, 174, { size: 16, align: 'center', color: '#ffffff', shadow: false });
      S.text(ctx, n > 0 ? String(n) : 'JA!', S.W / 2, 218, { size: 30, align: 'center', color: '#9fe2ff', outline: '#0a1b3a', outlineW: 5, shadow: false });
    } else if (st.phase === 'win') {
      S.UI.panel(ctx, S.W / 2 - 200, 84, 400, 176);
      S.Gfx.emerald(ctx, S.W / 2, 146, S.HUD.EMCOL[st.idx], st.t, 2.6);
      S.text(ctx, 'ESMERALDA DO CAOS!', S.W / 2, 212, { size: 22, align: 'center', color: '#ffd23c', outline: '#3a1d00', outlineW: 5, shadow: false });
      S.text(ctx, 'Pressione para continuar', S.W / 2, 242, { size: 12, align: 'center', color: '#cfd8ff', shadow: false });
    } else if (st.phase === 'lose') {
      S.UI.panel(ctx, S.W / 2 - 200, 110, 400, 130);
      S.text(ctx, 'NAO DEU DESSA VEZ', S.W / 2, 158, { size: 22, align: 'center', color: '#ff8a8a', outline: '#3a0000', outlineW: 5, shadow: false });
      S.text(ctx, 'Voce pegou ' + st.rings + ' de ' + st.target, S.W / 2, 190, { size: 14, align: 'center', color: '#ffffff', shadow: false });
      S.text(ctx, 'Pressione para continuar', S.W / 2, 222, { size: 12, align: 'center', color: '#cfd8ff', shadow: false });
    }
  };

  SP.drawHud = function (ctx, st) {
    S.text(ctx, S.pickupLabel(st.charId) + ' ' + st.rings + ' / ' + st.target, S.W / 2, 28, {
      size: 20, align: 'center', color: '#ffd23c', outline: '#20160a', outlineW: 6, shadow: false });

    var bw = 236, bx = S.W / 2 - bw / 2, by = 38;
    ctx.save();
    ctx.fillStyle = 'rgba(8,16,40,.72)';
    S.roundRect(ctx, bx, by, bw, 9, 4.5); ctx.fill();
    var f = S.clamp(st.rings / st.target, 0, 1);
    if (f > 0) {
      var gr = ctx.createLinearGradient(bx, 0, bx + bw, 0);
      gr.addColorStop(0, '#3fe0ff'); gr.addColorStop(1, '#7ff3ff');
      ctx.fillStyle = gr;
      S.roundRect(ctx, bx, by, Math.max(5, bw * f), 9, 4.5); ctx.fill();
    }
    ctx.strokeStyle = 'rgba(190,240,255,.45)'; ctx.lineWidth = 1.2;
    S.roundRect(ctx, bx, by, bw, 9, 4.5); ctx.stroke();
    ctx.restore();

    var left = Math.max(0, 62 - Math.floor(st.t / 60));
    S.text(ctx, left + 's', S.W - 20, 32, {
      size: 20, align: 'right', color: left < 11 ? '#ff5c5c' : '#ffffff',
      outline: '#13172c', outlineW: 5, shadow: false });

    S.Input.drawTouch(ctx);
  };
})();
