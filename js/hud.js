/* ============================================================
   hud.js — interface durante a fase
   ============================================================ */
(function () {
  'use strict';
  var S = window.S;
  var HUD = S.HUD = {};

  var EMCOL = ['#3fc34a', '#39b5ff', '#ff5c8a', '#ffd23c', '#b46ef0', '#ff7b2e'];
  HUD.EMCOL = EMCOL;

  function label(ctx, txt, x, y, color) {
    S.text(ctx, txt, x, y, { size: 15, color: color || '#ffd23c', outline: 'rgba(10,14,30,.85)', outlineW: 4, shadow: false });
  }
  function value(ctx, txt, x, y, color) {
    S.text(ctx, txt, x, y, { size: 15, color: color || '#ffffff', outline: 'rgba(10,14,30,.85)', outlineW: 4, shadow: false });
  }

  /* crachá do personagem: foto, coletável e corações das vidas */
  HUD.perfil = function (ctx, o) {
    var Gfx = S.Gfx;
    var lado = o.lado || 32, pad = 6;
    var temItem = o.rings !== undefined;
    var vidas = (o.lives === undefined || o.lives < 0) ? -1 : o.lives;
    var MAXC = 5;
    var nCor = vidas < 0 ? 0 : Math.min(vidas, MAXC);
    var extra = vidas > MAXC ? vidas - MAXC : 0;
    var wItem = temItem ? 68 : 0;
    var wCor = nCor * 16 + (extra ? 26 : 0);
    var w = pad + lado + (wItem ? 8 : 0) + wItem + (wCor ? 6 : 0) + wCor + pad;
    var h = lado + pad * 2;
    var x = o.x, y = o.y, meio = y + h / 2;

    ctx.save();
    ctx.globalAlpha = o.alpha === undefined ? .58 : o.alpha;
    ctx.fillStyle = '#070b1c';
    S.roundRect(ctx, x, y, w, h, 11); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.lineWidth = 1.4;
    S.roundRect(ctx, x + .7, y + .7, w - 1.4, h - 1.4, 10.4); ctx.stroke();
    ctx.restore();

    Gfx.retrato(ctx, o.charId, x + pad, y + pad, lado);

    var cx = x + pad + lado + 8;
    if (temItem) {
      Gfx.pickup(ctx, cx + 11, meio, 0, .62, o.charId);
      var pisca = o.alerta && Math.floor((o.t || 0) / 8) % 2 === 0;
      S.text(ctx, 'x ' + S.pad(o.rings, 3), cx + 25, meio + 6, {
        size: 16, color: pisca ? '#ff5c5c' : '#ffffff',
        outline: 'rgba(8,10,24,.9)', outlineW: 4, shadow: false });
      cx += wItem + 6;
    }
    for (var i = 0; i < nCor; i++) Gfx.coracao(ctx, cx + 8 + i * 16, meio, 1.55);
    if (extra) {
      S.text(ctx, '+' + extra, cx + 16 + nCor * 16, meio + 5, {
        size: 13, color: '#ff9bab', outline: 'rgba(8,10,24,.9)', outlineW: 3, shadow: false });
    }
    return w;
  };

  HUD.draw = function (ctx, g) {
    var p = g.player;

    HUD.perfil(ctx, {
      charId: g.charId, x: 8, y: 8, lado: 32,
      rings: g.rings, lives: g.lives, t: g.frames, alerta: g.rings === 0
    });

    ctx.save();
    ctx.globalAlpha = .4; ctx.fillStyle = '#060a18';
    S.roundRect(ctx, 8, 54, 172, 42, 9); ctx.fill();
    ctx.restore();
    label(ctx, 'PONTOS', 18, 72);
    value(ctx, S.pad(g.score, 6), 98, 72);
    label(ctx, 'TEMPO', 18, 90, g.timeWarn ? '#ff5c5c' : '#ffd23c');
    value(ctx, S.fmtClock(g.time), 98, 90);

    // esmeraldas
    for (var i = 0; i < 6; i++) {
      var ex = S.W - 26 - (5 - i) * 24, ey = 24;
      if (S.Save.data.emeralds[i]) {
        S.Gfx.emerald(ctx, ex, ey, EMCOL[i], g.frames + i * 20, .62);
      } else {
        ctx.save();
        ctx.globalAlpha = .28;
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.4;
        S.poly(ctx, [ex, ey - 7.5, ex + 5.6, ey - 2.5, ex + 3.8, ey + 5.6, ex - 3.8, ey + 5.6, ex - 5.6, ey - 2.5]);
        ctx.stroke(); ctx.restore();
      }
    }

    // temporizadores de itens
    var ty = 112;
    if (p.invincTimer > 0) ty = timerBar(ctx, ty, 'INVENCIVEL', p.invincTimer / 1200, '#ffd23c');
    if (p.shoesTimer > 0) ty = timerBar(ctx, ty, 'TENIS', p.shoesTimer / 1200, '#e03027');
    if (p.superForm) ty = timerBar(ctx, ty, 'SUPER', Math.min(1, g.rings / 50), '#fff3a8');
    if (p.flying) ty = timerBar(ctx, ty, 'VOO', p.flyTimer / 500, '#9fe2ff');

    // chefe
    if (g.boss && g.boss.alive && g.boss.phase !== 'intro') HUD.bossBar(ctx, g.boss);

    // aviso de tempo
    if (g.timeWarn && Math.floor(g.frames / 20) % 2 === 0) {
      S.text(ctx, 'TEMPO ACABANDO!', S.W / 2, 108, {
        size: 18, color: '#ff5c5c', align: 'center', outline: '#2a0000', outlineW: 4, shadow: false });
    }

    S.Input.drawTouch(ctx);
  };

  function timerBar(ctx, y, name, frac, color) {
    ctx.save();
    ctx.globalAlpha = .3; ctx.fillStyle = '#060a18';
    S.roundRect(ctx, 14, y - 10, 120, 14, 4); ctx.fill();
    ctx.restore();
    ctx.fillStyle = color;
    ctx.fillRect(18, y - 6, Math.max(0, 112 * S.clamp(frac, 0, 1)), 6);
    S.text(ctx, name, 18, y - 8, { size: 9, color: '#ffffff', shadow: false, baseline: 'bottom' });
    return y + 22;
  }

  HUD.bossBar = function (ctx, boss) {
    var w = 240, x = (S.W - w) / 2, y = 22;
    ctx.save();
    ctx.globalAlpha = .35; ctx.fillStyle = '#060a18';
    S.roundRect(ctx, x - 6, y - 6, w + 12, 24, 6); ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#2a3150';
    S.roundRect(ctx, x, y, w, 12, 4); ctx.fill();
    var f = Math.max(0, boss.hp / boss.maxHp);
    var gr = ctx.createLinearGradient(x, 0, x + w, 0);
    gr.addColorStop(0, '#ff5c5c'); gr.addColorStop(1, '#ffd23c');
    ctx.fillStyle = gr;
    S.roundRect(ctx, x, y, Math.max(2, w * f), 12, 4); ctx.fill();
    S.text(ctx, 'DANIEL VOCARO', S.W / 2, y - 8, {
      size: 12, color: '#ffffff', align: 'center', outline: 'rgba(0,0,0,.8)', outlineW: 3, shadow: false });
  };
})();
