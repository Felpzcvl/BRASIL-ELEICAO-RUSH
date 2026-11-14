/* ============================================================
   ranking.js — a tela que o localStorage nunca permitiu

   Compara jogadores entre si, lendo direto do banco MySQL.
   So aparece no menu quando a API esta no ar.
   ============================================================ */
(function () {
  'use strict';
  var S = window.S, Sc = S.Screens;

  Sc.ranking = {
    enter: function (g) {
      this.t = 0;
      if (S.Api) { S.Api.ranking = null; S.Api.buscarRanking(); }
    },

    update: function (g) {
      this.t++;
      var In = S.Input;
      if (In.pressed('back') || In.pressed('confirm')) {
        S.Audio.sfx('cancel');
        g.go('menu', { sel: 7 });
      }
    },

    draw: function (ctx, g) {
      var t = this.t;
      S.Gfx.drawBackground(ctx, 'congresso', { x: t * .8, y: 70 }, t);
      S.UI.vignette(ctx, .62);

      S.text(ctx, 'RANKING', S.W / 2, 42, {
        size: 24, align: 'center', color: '#ffd23c',
        outline: '#3a1d00', outlineW: 5, shadow: false });
      S.text(ctx, 'lido do banco MySQL — impossivel com o armazenamento local',
        S.W / 2, 62, { size: 11, align: 'center', color: '#9fb0cc', shadow: false });

      S.UI.panel(ctx, 40, 76, S.W - 80, 232);

      var linhas = S.Api && S.Api.ranking;
      if (!linhas) {
        S.text(ctx, 'consultando o banco' + '.'.repeat(1 + Math.floor(t / 20) % 3),
          S.W / 2, 190, { size: 15, align: 'center', color: '#cfd8ff', shadow: false });
        S.UI.hint(ctx, 'ESC voltar');
        return;
      }
      if (linhas.length === 0) {
        S.text(ctx, 'Nenhuma partida registrada ainda.', S.W / 2, 182, {
          size: 15, align: 'center', color: '#cfd8ff', shadow: false });
        S.text(ctx, 'Termine um ato para aparecer aqui.', S.W / 2, 204, {
          size: 12, align: 'center', color: '#9fb0cc', shadow: false });
        S.UI.hint(ctx, 'ESC voltar');
        return;
      }

      var COL = { pos: 66, nome: 100, rec: 320, esm: 420, prog: 520 };
      var cab = { size: 11, color: '#9fb0cc', shadow: false };
      S.text(ctx, '#',          COL.pos,  100, cab);
      S.text(ctx, 'JOGADOR',    COL.nome, 100, cab);
      S.text(ctx, 'RECORDE',    COL.rec,  100, Object.assign({ align: 'right' }, cab));
      S.text(ctx, 'ESMERALDAS', COL.esm,  100, Object.assign({ align: 'right' }, cab));
      S.text(ctx, 'PROGRESSO',  COL.prog, 100, Object.assign({ align: 'right' }, cab));

      ctx.save();
      ctx.globalAlpha = .18; ctx.fillStyle = '#ffffff';
      ctx.fillRect(56, 108, S.W - 112, 1);
      ctx.restore();

      var meu = S.Api && S.Api.apelido;
      for (var i = 0; i < linhas.length && i < 8; i++) {
        var r = linhas[i], y = 132 + i * 21;
        var euMesmo = (r.apelido === meu);
        var cor = euMesmo ? '#ffd23c' : '#ffffff';

        if (euMesmo) {
          ctx.save();
          ctx.globalAlpha = .12; ctx.fillStyle = '#ffd23c';
          S.roundRect(ctx, 56, y - 14, S.W - 112, 19, 4); ctx.fill();
          ctx.restore();
        }

        S.text(ctx, String(i + 1),  COL.pos,  y, { size: 13, color: '#9fb0cc', shadow: false });
        S.text(ctx, r.apelido,      COL.nome, y, { size: 14, color: cor, shadow: false });
        S.text(ctx, S.pad(r.recorde_geral, 6), COL.rec, y,
          { size: 14, color: cor, align: 'right', shadow: false });
        S.text(ctx, r.esmeraldas + ' / 6',     COL.esm, y,
          { size: 13, color: cor, align: 'right', shadow: false });
        S.text(ctx, Number(r.progresso).toFixed(1) + '%', COL.prog, y,
          { size: 13, color: cor, align: 'right', shadow: false });
      }

      S.text(ctx, 'as triggers do banco mantem o recorde e o progresso a cada partida',
        S.W / 2, 296, { size: 10.5, align: 'center', color: '#8fa0bf', shadow: false });

      S.UI.hint(ctx, 'ESC voltar');
    }
  };
})();
