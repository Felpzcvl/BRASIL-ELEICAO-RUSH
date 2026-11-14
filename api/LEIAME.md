# API — ponte entre o jogo e o MySQL

O navegador não fala MySQL direto. Esta API pequena fica no meio: o jogo manda o que
aconteceu, ela chama as **procedures** do banco, e as **triggers** fazem o resto.

> **O jogo continua funcionando sem ela.** Se a API não estiver no ar, tudo cai no
> `localStorage`, exatamente como antes — inclusive a versão publicada no Vercel.
> O item RANKING só aparece no menu quando o banco está ligado.

---

## Como ligar (3 passos)

**1. Crie o banco** (uma vez só). Na pasta `TABD - Scripts`:

```
mysql -u root -p < 01-criar-banco-mysql.sql
```

**2. Configure a senha.** Dentro da pasta `api`:

```
copy config.exemplo.json config.json
```

Abra o `config.json` e troque `COLOQUE_AQUI_A_SUA_SENHA_DO_MYSQL` pela sua senha.

> Esse arquivo está no `.gitignore` — a sua senha **não** vai para o GitHub.

**3. Suba a API:**

```
cd api
npm install
node server.js
```

Deve aparecer:

```
  API do ELEICAO RUSH no ar
  MySQL 8.0.x  ·  banco "eleicao_rush" em localhost:3306
  Escutando em http://localhost:3000
```

Deixe essa janela aberta e abra o jogo. No console do navegador (F12) aparece
`[banco] ligado como "fellipe"`.

---

## Trocar o nome do jogador

O apelido fica guardado no navegador. Para mudar, abra o console (F12) e rode:

```js
S.Api.definirApelido('outro_nome');
location.reload();
```

O padrão é `fellipe`, definido em `js/api.js`.

---

## O que cada rota faz

| Rota | O que acontece no banco |
|---|---|
| `GET /api/saude` | confere se o banco responde |
| `POST /api/jogador` | cria o jogador se não existir e devolve o progresso dele |
| `GET /api/jogador?apelido=` | progresso por ato, esmeraldas e recorde |
| `POST /api/partida` | chama `sp_registrar_partida` → as triggers atualizam progresso, recorde e auditoria |
| `POST /api/esmeralda` | chama `sp_conceder_esmeralda` → a trigger registra e detecta as seis |
| `GET /api/ranking` | compara jogadores usando `fn_progresso_jogador` e `fn_total_esmeraldas` |
| `GET /api/auditoria` | as últimas 20 linhas que as triggers escreveram |

---

## Se der erro

| Mensagem | Causa |
|---|---|
| `Falta o arquivo api/config.json` | você pulou o passo 2 |
| `ER_ACCESS_DENIED_ERROR` | senha errada no `config.json` |
| `ER_BAD_DB_ERROR` | o banco não existe: rode o passo 1 |
| `ECONNREFUSED` | o serviço do MySQL não está rodando |
| `Falta instalar o driver` | rode `npm install` dentro da pasta `api` |

---

## Detalhe que vale citar na apresentação

A API **não calcula nada**. Ela só chama a procedure e devolve o que o banco respondeu.
O melhor tempo, a melhor pontuação, o recorde geral e a trilha de auditoria são todos
mantidos pelas triggers, dentro da mesma transação que grava a partida.
