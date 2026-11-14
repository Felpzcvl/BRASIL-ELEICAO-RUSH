/* ============================================================
   api.js — conversa com o banco MySQL, quando ele estiver no ar

   O jogo continua funcionando sozinho: se a API nao responder,
   tudo cai no localStorage, exatamente como antes. Nada aqui
   pode derrubar o laco principal — todo erro e engolido.
   ============================================================ */
(function () {
  'use strict';
  var S = window.S;

  var CHAVE_APELIDO = 'eleicao_rush_apelido';

  var Api = S.Api = {
    base: 'http://localhost:3000',
    ligado: false,
    apelido: null,
    jogador: null,       // { id, apelido, recorde_geral, progresso, esmeraldas }
    ranking: null,       // cache da ultima consulta
    erro: null,

    /* apelido fica guardado no navegador; troque aqui se quiser outro padrao */
    lerApelido: function () {
      var a = null;
      try { a = localStorage.getItem(CHAVE_APELIDO); } catch (e) {}
      return (a && a.length >= 3) ? a : 'fellipe';
    },

    definirApelido: function (a) {
      this.apelido = a;
      try { localStorage.setItem(CHAVE_APELIDO, a); } catch (e) {}
    },

    /* ---------- transporte ---------- */
    pedir: function (caminho, metodo, corpo) {
      var op = { method: metodo || 'GET', headers: { 'Content-Type': 'application/json' } };
      if (corpo) op.body = JSON.stringify(corpo);
      return fetch(this.base + caminho, op).then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok) throw new Error(j.erro || ('HTTP ' + r.status));
          return j;
        });
      });
    },

    /* ---------- abertura ---------- */
    init: function () {
      var self = this;
      self.apelido = self.lerApelido();
      if (typeof fetch !== 'function') return;

      // nao trava a abertura do jogo: se nao responder rapido, segue sem banco
      var desistir = new Promise(function (ok) { setTimeout(function () { ok(null); }, 2500); });

      Promise.race([self.pedir('/api/saude'), desistir])
        .then(function (r) {
          if (!r || !r.ok) return;
          self.ligado = true;
          return self.pedir('/api/jogador', 'POST', {
            apelido: self.apelido,
            personagem: S.Save.data.favChar
          }).then(function (e) {
            self.jogador = e.jogador;
            self.absorver(e);
            console.log('[banco] ligado como "' + self.apelido + '"');
          });
        })
        .catch(function (e) {
          self.ligado = false;
          self.erro = e && e.message;
        });
    },

    /* traz o que esta no banco para o save local, ficando com o melhor dos dois */
    absorver: function (estado) {
      if (!estado || !estado.progresso) return;
      var d = S.Save.data, mudou = false;

      estado.progresso.forEach(function (p) {
        if (p.concluido) {
          if (!d.cleared[p.ato_codigo]) { d.cleared[p.ato_codigo] = true; mudou = true; }
          var t = p.melhor_tempo_frames;
          if (t && (!d.bestTimes[p.ato_codigo] || t < d.bestTimes[p.ato_codigo])) {
            d.bestTimes[p.ato_codigo] = t; mudou = true;
          }
        }
        var s = p.melhor_pontuacao;
        if (s && (!d.bestScores[p.ato_codigo] || s > d.bestScores[p.ato_codigo])) {
          d.bestScores[p.ato_codigo] = s; mudou = true;
        }
      });

      (estado.esmeraldas || []).forEach(function (i) {
        if (!d.emeralds[i]) { d.emeralds[i] = true; mudou = true; }
      });

      var rec = estado.jogador && estado.jogador.recorde_geral;
      if (rec && rec > d.highScore) { d.highScore = rec; mudou = true; }

      if (mudou) S.Save.save();
    },

    /* ---------- escrita ---------- */
    registrarPartida: function (dados) {
      if (!this.ligado) return;
      var self = this;
      this.pedir('/api/partida', 'POST', {
        apelido: this.apelido,
        personagem: dados.personagem,
        ato: dados.ato,
        pontuacao: dados.pontuacao,
        tempo_frames: dados.tempo_frames,
        itens: dados.itens,
        concluida: !!dados.concluida
      }).then(function (e) {
        self.jogador = e.jogador;
        self.ranking = null;              // invalida o cache
      }).catch(function (e) {
        console.warn('[banco] nao gravou a partida:', e.message);
      });
    },

    registrarEsmeralda: function (atoId) {
      if (!this.ligado) return;
      var self = this;
      this.pedir('/api/esmeralda', 'POST', { apelido: this.apelido, ato: atoId })
        .then(function (e) { self.jogador = e.jogador; self.ranking = null; })
        .catch(function (e) { console.warn('[banco] nao gravou a esmeralda:', e.message); });
    },

    /* ---------- leitura ---------- */
    buscarRanking: function () {
      if (!this.ligado) return;
      var self = this;
      if (self.carregandoRanking) return;
      self.carregandoRanking = true;
      this.pedir('/api/ranking')
        .then(function (r) { self.ranking = r.ranking || []; })
        .catch(function () { self.ranking = []; })
        .then(function () { self.carregandoRanking = false; });
    }
  };
})();
