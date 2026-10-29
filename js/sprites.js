/* ---------- pixel art dos personagens ----------
   Cada personagem tem um PNG recortado (pés no rodapé da imagem).
   O desenho vivo vem de transformações: balanço, inclinação e esmagamento.
   Sem o PNG carregado, gfx.js volta sozinho para a caricatura vetorial. */
(function () {
  'use strict';
  var S = window.S, Gfx = S.Gfx;

  var ALTURA = 52;   // altura desenhada no canvas de 640x360
  var IDS = ['lula', 'bolsonaro', 'alexandre', 'renan', 'trump'];
  var imgs = {};

  IDS.forEach(function (id) {
    var im = new Image();
    im.onload = function () { im.pronto = true; };
    im.src = 'assets/chars/' + id + '.png';
    imgs[id] = im;
  });

  Gfx.SPR_ALT = ALTURA;

  /* cartas ilustradas da tela de seleção */
  var cartas = {};
  Gfx.CARTA_ASPECTO = 391 / 578;
  IDS.forEach(function (id) {
    var im = new Image();
    im.onload = function () { im.pronto = true; };
    im.src = 'assets/cards/' + id + '.webp';
    cartas[id] = im;
  });

  Gfx.cartaDe = function (id) {
    var im = cartas[id];
    return (im && im.pronto && im.naturalWidth) ? im : null;
  };

  Gfx.spriteDe = function (id) {
    var im = imgs[id];
    return (im && im.pronto && im.naturalWidth) ? im : null;
  };

  /* rolando/pulando: o próprio sprite encolhido girando */
  Gfx.spriteBola = function (ctx, im, spin, r, c) {
    var h = r * 2.35, w = im.naturalWidth * h / im.naturalHeight;
    ctx.save();
    ctx.translate(0, -r);

    ctx.save();
    ctx.beginPath(); ctx.arc(0, 0, r - 1, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = c.suit || c.body;
    ctx.fillRect(-r, -r, r * 2, r * 2);
    ctx.rotate(spin);
    ctx.drawImage(im, -w / 2, -h / 2, w, h);
    ctx.restore();

    ctx.strokeStyle = c.suitDark || c.dark;
    ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.arc(0, 0, r - 1.1, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  };

  /* (0,0) = pés do personagem; o chamador já aplicou escala e espelho */
  Gfx.desenhaSprite = function (ctx, im, st, t) {
    var h = ALTURA, w = im.naturalWidth * h / im.naturalHeight;
    var bob = 0, lean = 0, sx = 1, sy = 1;

    if (st === 'walk') {
      bob = Math.abs(Math.sin(t * .32)) * 1.5; lean = .05;
    } else if (st === 'run' || st === 'dash') {
      bob = Math.abs(Math.sin(t * .5)) * 2.3;
      lean = (st === 'dash') ? .2 : .14;
      sy = 1 + Math.sin(t) * .035; sx = 2 - sy;
    } else if (st === 'skid') {
      lean = -.34;
    } else if (st === 'push') {
      lean = .26; bob = Math.sin(t * .2) * .8;
    } else if (st === 'crouch') {
      sy = .66; sx = 1.12;
    } else if (st === 'victory') {
      bob = Math.abs(Math.sin(t * .18)) * 5;
    } else if (st === 'glide') {
      lean = .42; bob = Math.sin(t * .12);
    } else if (st === 'fly') {
      lean = .08; bob = Math.sin(t * .3) * 2.4;
    } else if (st === 'climb') {
      bob = Math.sin(t * .22) * 1.6; lean = .07;
    } else if (st === 'hurt') {
      lean = -.42;
    } else {
      bob = Math.sin(t * .09) * .9;              // idle e parentes
      if (st === 'lookup') lean = -.05;
    }

    ctx.save();
    if (lean) ctx.rotate(lean);
    ctx.translate(0, -bob);
    ctx.drawImage(im, -w * sx / 2, -h * sy, w * sx, h * sy);
    ctx.restore();
  };
})();

/* ---------- retrato de perfil (cabeça e ombros, recortado) ---------- */
(function () {
  'use strict';
  var S = window.S, Gfx = S.Gfx;

  var PADRAO = { x: .5, y: .21, h: .42 };

  /* (x,y) = canto superior esquerdo da moldura quadrada de lado `lado` */
  Gfx.retrato = function (ctx, id, x, y, lado, opts) {
    opts = opts || {};
    var c = Gfx.CHARS[id] || {};
    var cx = x + lado / 2, cy = y + lado / 2;
    var r = opts.raio === undefined ? lado * .26 : opts.raio;

    ctx.save();

    // fundo da moldura, na cor do personagem
    ctx.fillStyle = opts.fundo || S.shade(c.card || c.suit || '#1b2440', -.35);
    S.roundRect(ctx, x, y, lado, lado, r); ctx.fill();

    // recorta e desenha o rosto
    ctx.save();
    ctx.beginPath(); S.roundRect(ctx, x, y, lado, lado, r); ctx.clip();
    var im = Gfx.spriteDe(id);
    if (im) {
      var f = c.face || PADRAO;
      var W = im.naturalWidth, H = im.naturalHeight;
      var k = (lado * .72) / (f.h * H);
      ctx.drawImage(im, cx - f.x * W * k, cy - (f.y + f.h * .17) * H * k, W * k, H * k);
    } else {
      var kk = (lado * .72) / 26;
      Gfx.drawChar(ctx, id, { x: cx, y: cy + 34.5 * kk, state: 'idle', t: 0, facing: 1, scale: kk });
    }
    ctx.restore();

    // borda
    ctx.strokeStyle = opts.borda || 'rgba(255,255,255,.55)';
    ctx.lineWidth = opts.larguraBorda || 1.6;
    S.roundRect(ctx, x + .8, y + .8, lado - 1.6, lado - 1.6, Math.max(1, r - .8)); ctx.stroke();
    ctx.restore();
  };

  /* coração das vidas; `vazio` desenha o slot gasto */
  Gfx.coracao = function (ctx, x, y, s, vazio) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(s, s);
    ctx.beginPath();
    ctx.moveTo(0, 4.4);
    ctx.bezierCurveTo(-5.6, -.6, -4.4, -6.4, 0, -2.5);
    ctx.bezierCurveTo(4.4, -6.4, 5.6, -.6, 0, 4.4);
    ctx.closePath();
    if (vazio) {
      ctx.fillStyle = 'rgba(255,255,255,.14)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.3)'; ctx.lineWidth = 1.1; ctx.stroke();
    } else {
      ctx.fillStyle = '#e03a51'; ctx.fill();
      ctx.strokeStyle = '#3d0a16'; ctx.lineWidth = 1.3; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.5)';
      S.ellipse(ctx, -1.9, -2.2, 1.5, 1, -.5); ctx.fill();
    }
    ctx.restore();
  };
})();
