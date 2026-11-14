/* ============================================================
   api/server.js — ponte entre o jogo e o MySQL

   O navegador nao fala MySQL. Esta API pequena recebe o que o jogo
   manda e chama as procedures do banco; as triggers fazem o resto.

   Subir:  node api/server.js
   Parar:  Ctrl + C
   ============================================================ */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

let mysql;
try {
  mysql = require('mysql2/promise');
} catch (e) {
  console.error('\n  Falta instalar o driver do MySQL. Rode, dentro da pasta api:\n');
  console.error('      npm install\n');
  process.exit(1);
}

/* ---------- configuracao ---------- */
const PADRAO = { host: 'localhost', port: 3306, user: 'root', password: '', database: 'eleicao_rush' };
let cfg = Object.assign({}, PADRAO);
const arqCfg = path.join(__dirname, 'config.json');
if (!fs.existsSync(arqCfg) && fs.existsSync(path.join(__dirname, 'config.exemplo.json'))) {
  console.error('');
  console.error('  Falta o arquivo api/config.json com os dados do seu MySQL.');
  console.error('  Faca uma copia do exemplo e preencha a senha:');
  console.error('');
  console.error('      copy api\config.exemplo.json api\config.json');
  console.error('');
  console.error('  (config.json fica fora do repositorio, a sua senha nao vaza)');
  console.error('');
  process.exit(1);
}
if (fs.existsSync(arqCfg)) {
  try {
    cfg = Object.assign(cfg, JSON.parse(fs.readFileSync(arqCfg, 'utf8')));
  } catch (e) {
    console.error('config.json invalido:', e.message);
    process.exit(1);
  }
}
// variaveis de ambiente tem prioridade (util para testar sem mexer no arquivo)
if (process.env.MYSQL_HOST) cfg.host = process.env.MYSQL_HOST;
if (process.env.MYSQL_PORT) cfg.port = Number(process.env.MYSQL_PORT);
if (process.env.MYSQL_USER) cfg.user = process.env.MYSQL_USER;
if (process.env.MYSQL_PASSWORD) cfg.password = process.env.MYSQL_PASSWORD;
if (process.env.MYSQL_DATABASE) cfg.database = process.env.MYSQL_DATABASE;

const PORTA = Number(process.env.PORT || 3000);
let pool = null;

async function conectar() {
  pool = await mysql.createPool({
    host: cfg.host, port: cfg.port, user: cfg.user,
    password: cfg.password, database: cfg.database,
    waitForConnections: true, connectionLimit: 5, namedPlaceholders: true
  });
  const [r] = await pool.query('select version() as v');
  return r[0].v;
}

/* ---------- utilidades HTTP ---------- */
function json(res, status, corpo) {
  const txt = JSON.stringify(corpo);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(txt),
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Cache-Control': 'no-store'
  });
  res.end(txt);
}

function lerCorpo(req) {
  return new Promise((ok, erro) => {
    let b = '';
    req.on('data', c => {
      b += c;
      if (b.length > 1e5) { req.destroy(); erro(new Error('corpo grande demais')); }
    });
    req.on('end', () => {
      if (!b) return ok({});
      try { ok(JSON.parse(b)); } catch (e) { erro(new Error('JSON invalido')); }
    });
    req.on('error', erro);
  });
}

/* ---------- rotas ---------- */
const rotas = {

  // o jogo chama na abertura para saber se o banco esta disponivel
  'GET /api/saude': async () => {
    const [r] = await pool.query('select count(*) as atos from ato');
    return { ok: true, banco: cfg.database, atos: r[0].atos };
  },

  // cria o jogador se ainda nao existir e devolve o estado dele
  'POST /api/jogador': async (corpo) => {
    const apelido = String(corpo.apelido || '').trim();
    if (apelido.length < 3 || apelido.length > 20) {
      const e = new Error('O apelido precisa ter de 3 a 20 letras.');
      e.status = 400; throw e;
    }
    const [achado] = await pool.query('select id from jogador where apelido = ?', [apelido]);
    if (achado.length === 0) {
      await pool.query(
        'insert into jogador (apelido, email, personagem_favorito) values (?, ?, ?)',
        [apelido, apelido.toLowerCase() + '@eleicaorush.local', corpo.personagem || null]);
    }
    return await estado(apelido);
  },

  // progresso completo do jogador: por ato, esmeraldas e recorde
  'GET /api/jogador': async (_, url) => {
    const apelido = url.searchParams.get('apelido');
    if (!apelido) { const e = new Error('Informe o apelido.'); e.status = 400; throw e; }
    return await estado(apelido);
  },

  // registra uma partida: a PROCEDURE grava e as TRIGGERS atualizam progresso e recorde
  'POST /api/partida': async (corpo) => {
    const faltando = ['apelido', 'personagem', 'ato', 'pontuacao', 'tempo_frames']
      .filter(k => corpo[k] === undefined || corpo[k] === null);
    if (faltando.length) {
      const e = new Error('Faltam campos: ' + faltando.join(', ')); e.status = 400; throw e;
    }
    await pool.query('call sp_registrar_partida(?, ?, ?, ?, ?, ?, ?)', [
      corpo.apelido, corpo.personagem, corpo.ato,
      Number(corpo.pontuacao) || 0, Number(corpo.tempo_frames) || 1,
      Number(corpo.itens) || 0, corpo.concluida ? 1 : 0
    ]);
    return await estado(corpo.apelido);
  },

  // concede a esmeralda do ato: a PROCEDURE evita duplicar e a TRIGGER audita
  'POST /api/esmeralda': async (corpo) => {
    if (!corpo.apelido || !corpo.ato) {
      const e = new Error('Informe apelido e ato.'); e.status = 400; throw e;
    }
    const [j] = await pool.query('select id from jogador where apelido = ?', [corpo.apelido]);
    if (j.length === 0) { const e = new Error('Jogador nao cadastrado.'); e.status = 404; throw e; }
    await pool.query('call sp_conceder_esmeralda(?, ?, ?)', [j[0].id, corpo.ato, null]);
    return await estado(corpo.apelido);
  },

  // o que o localStorage nunca permitiu: comparar jogadores
  'GET /api/ranking': async () => {
    const [linhas] = await pool.query(
      `select j.apelido,
              j.recorde_geral,
              fn_progresso_jogador(j.id)  as progresso,
              fn_total_esmeraldas(j.id)   as esmeraldas,
              (select count(*) from partida p where p.jogador_id = j.id) as partidas
         from jogador j
        order by j.recorde_geral desc, esmeraldas desc
        limit 10`);
    return { ranking: linhas };
  },

  // a trilha que as triggers escreveram sozinhas
  'GET /api/auditoria': async (_, url) => {
    const apelido = url.searchParams.get('apelido');
    const [linhas] = await pool.query(
      `select a.id, a.acao, a.detalhe, a.criado_em
         from auditoria a left join jogador j on j.id = a.jogador_id
        where (? is null or j.apelido = ?)
        order by a.id desc limit 20`, [apelido, apelido]);
    return { auditoria: linhas };
  }
};

async function estado(apelido) {
  const [j] = await pool.query(
    `select id, apelido, recorde_geral,
            fn_progresso_jogador(id) as progresso,
            fn_total_esmeraldas(id)  as esmeraldas
       from jogador where apelido = ?`, [apelido]);
  if (j.length === 0) { const e = new Error('Jogador nao encontrado.'); e.status = 404; throw e; }

  const [prog] = await pool.query(
    `select ato_codigo, melhor_tempo_frames, melhor_pontuacao, concluido, total_partidas
       from progresso where jogador_id = ?`, [j[0].id]);
  const [esm] = await pool.query(
    'select esmeralda_indice from jogador_esmeralda where jogador_id = ?', [j[0].id]);

  return {
    jogador: j[0],
    progresso: prog,
    esmeraldas: esm.map(e => e.esmeralda_indice)
  };
}

/* ---------- servidor ---------- */
const servidor = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS'
    });
    return res.end();
  }

  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  const chave = req.method + ' ' + url.pathname;
  const rota = rotas[chave];

  if (!rota) return json(res, 404, { erro: 'Rota nao encontrada: ' + chave });

  try {
    const corpo = req.method === 'POST' ? await lerCorpo(req) : {};
    const saida = await rota(corpo, url);
    json(res, 200, saida);
  } catch (e) {
    // erro vindo de SIGNAL dentro da procedure chega como ER_SIGNAL_EXCEPTION
    const status = e.status || (e.sqlState === '45000' ? 400 : 500);
    console.error('  [' + chave + ']', e.sqlMessage || e.message);
    json(res, status, { erro: e.sqlMessage || e.message });
  }
});

conectar()
  .then(v => {
    servidor.listen(PORTA, () => {
      console.log('');
      console.log('  API do ELEICAO RUSH no ar');
      console.log('  MySQL ' + v + '  ·  banco "' + cfg.database + '" em ' + cfg.host + ':' + cfg.port);
      console.log('  Escutando em http://localhost:' + PORTA);
      console.log('');
      console.log('  Deixe esta janela aberta enquanto joga.');
      console.log('');
    });
  })
  .catch(e => {
    console.error('');
    console.error('  Nao consegui conectar no MySQL.');
    console.error('  ' + e.message);
    console.error('');
    if (e.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('  Usuario ou senha errados. Abra api/config.json e corrija.');
    } else if (e.code === 'ER_BAD_DB_ERROR') {
      console.error('  O banco "' + cfg.database + '" nao existe.');
      console.error('  Rode antes o script 01-criar-banco-mysql.sql.');
    } else if (e.code === 'ECONNREFUSED') {
      console.error('  O servico do MySQL nao esta rodando, ou a porta esta errada.');
    }
    console.error('');
    process.exit(1);
  });
