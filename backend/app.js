// Importação de módulos necessários
const express = require('express');
const bodyParser = require('body-parser');
const sqlstring = require('sqlstring');
const sqlite3 = require('sqlite3').verbose();
const urlencodedParser = bodyParser.urlencoded({ extended: false })

// Caminho do banco de dados SQLite a ser utilizado
const DBPATH = 'data/catalogo_dados.db';

// Definição do hostname e porta do servidor web
const hostname = '127.0.0.1';
const port = 5500;

// Criação de uma instância do objeto "app" do Express
const app = express();

// Configuração do servidor para servir arquivos estáticos do diretório "frontend"
app.use(express.static('frontend/'));

// Configuração do servidor para lidar com requisições JSON
app.use(express.json());


// Configuração do servidor para lidar com requisições codificadas em texto simples
app.use(bodyParser.text({ type: 'text/plain' }));

// Configuração do servidor para lidar com requisições codificadas em URL
app.use(bodyParser.urlencoded({ extended: false }));

/* Definição dos endpoints*/
app.get('/pesquisa', (req, res) => {
    res.statusCode = 200;
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Abre o banco
    var db = new sqlite3.Database(DBPATH);

    // Separação dos termos de pesquisa em um array
    const termosPesquisa = req.query.termo.trim().split(" ");

    // Filtro do conjunto de dados
    const conjuntoDeDadosFiltro = req.query.conjuntoDeDados;
    const dadosSensiveisFiltro = req.query.dadosSensiveis;
    const ownerFiltro = req.query.owner;
    const stewardFiltro = req.query.steward;
    const ordemFiltro = req.query.ordem;

    // Criação de um array de termos com "LIKE" para a consulta SQL
    const termosLike = termosPesquisa.map((termo) => `%${termo}%`);

    // Criação de uma string com os termos de pesquisa para a cláusula "WHERE" da consulta SQL
    const termosParams = termosPesquisa
        .map(() => '(cat_dados_variaveis.campos_variaveis LIKE ? OR cat_dados_tabela.nome_tabela LIKE ? OR cat_dados_tabela.conjunto_de_dados LIKE ? OR cat_dados_tabela.conteudo_tabela LIKE ? OR cat_dados_owner.nome_data_owner LIKE ? COLLATE NOCASE)')
        .join(' OR ');

    let sql = `SELECT 
    cat_dados_tabela.*, cat_dados_owner.*, cat_dados_conexoes.*, REPLACE(cat_dados_variaveis.campos_variaveis, ',', ' ') as campos_variaveis,
    cat_dados_variaveis.campo_estrangeiro, feedback.classificacao_admin, feedback.qtd_like_colaborador
  FROM 
    cat_dados_tabela
    INNER JOIN feedback ON cat_dados_tabela.id_numerico = feedback.id_numerico
    INNER JOIN cat_dados_owner ON cat_dados_tabela.conjunto_de_dados = cat_dados_owner.conjunto_de_dados
    INNER JOIN cat_dados_conexoes ON cat_dados_tabela.id_tabela = cat_dados_conexoes.id_tabela
    INNER JOIN (
      SELECT 
        cat_dados_variaveis.id_tabela, GROUP_CONCAT(nome_tabela || ' ' || nome_campo || ' ' || tipo_campo || ' ' || tipo_pessoa || ' ' || descricao_campo) as campos_variaveis
      FROM 
        cat_dados_variaveis
      GROUP BY 
        cat_dados_variaveis.id_tabela      
    ) AS cat_dados_variaveis ON cat_dados_tabela.id_tabela = cat_dados_variaveis.id_tabela
    LEFT JOIN (
      SELECT 
        cat_dados_variaveis.id_tabela, cat_dados_variaveis.nome_campo AS campo_estrangeiro
      FROM 
        cat_dados_tabela 
        JOIN cat_dados_owner ON cat_dados_tabela.conjunto_de_dados = cat_dados_owner.conjunto_de_dados
        JOIN cat_dados_conexoes ON cat_dados_tabela.id_tabela = cat_dados_conexoes.id_tabela
        LEFT JOIN cat_dados_variaveis ON cat_dados_variaveis.id_tabela = cat_dados_tabela.id_tabela
          AND cat_dados_variaveis.ch_primaria = "S"
    ) AS cat_dados_variaveis ON cat_dados_tabela.id_tabela = cat_dados_variaveis.id_tabela`;

    const params = [...termosLike, ...termosLike, ...termosLike, ...termosLike];

    sql += ' WHERE ' + termosParams;

    if (conjuntoDeDadosFiltro) {
        sql += ` AND cat_dados_tabela.conjunto_de_dados LIKE '%${conjuntoDeDadosFiltro}%'`;
    }

    if (dadosSensiveisFiltro) {
        sql += ` AND cat_dados_tabela.dados_sensiveis_tabela LIKE '%${dadosSensiveisFiltro}%'`;
    }

    if (ownerFiltro) {
        sql += ` AND cat_dados_owner.nome_data_owner LIKE '%${ownerFiltro}%'`;
    }

    if (stewardFiltro) {
        sql += ` AND cat_dados_steward.nome_data_owner LIKE '%${stewardFiltro}%'`;
    }

    if (ordemFiltro){
        sql += `
            ORDER BY 
              feedback.classificacao_admin_feedback DESC, feedback.qtd_like_colaborador_feedback DESC`;
    } else{
        sql += `
            ORDER BY 
              feedback.classificacao_admin_feedback ASC, feedback.qtd_like_colaborador_feedback ASC`;
    }

    db.all(sql, params, (err, rows) => {
        // Fecha o banco
        db.close();
        if (err) {
            console.error(err);
            return res.status(500).send('Erro interno do servidor.');
        }
        res.json(rows);
    });
});

app.get('/resultado', (req, res) => {
    res.statusCode = 200;
    res.setHeader('Access-Control-Allow-Origin', '*');

    const idTabela = req.query.id_tabela;

    const sql = `SELECT 
    cat_dados_tabela.*, 
    cat_dados_owner.*, 
    cat_dados_conexoes.*, 
    cat_dados_variaveis.nome_campo AS campo_estrangeiro
FROM 
    cat_dados_tabela 
    JOIN cat_dados_owner ON cat_dados_tabela.id_owner = cat_dados_owner.id_owner 
    JOIN cat_dados_conexoes ON cat_dados_tabela.id_numero_conexoes = cat_dados_conexoes.id_numero_conexoes
    LEFT JOIN cat_dados_variaveis ON cat_dados_variaveis.id_tabela = cat_dados_tabela.id_tabela
                                   AND cat_dados_variaveis.ch_primaria = "S"
WHERE cat_dados_tabela.id_tabela = ?`;

    var db = new sqlite3.Database(DBPATH); // Abre o banco
    db.all(sql, [idTabela], (err, rows) => {
        if (err) {
            throw err;
        }
        res.json(rows);

        // Fecha o banco
        db.close();
    });
});

app.get('/campos', (req, res) => {
    res.statusCode = 200;
    res.setHeader('Access-Control-Allow-Origin', '*');
    sql = "SELECT cat_dados_variaveis.id_variaveis, cat_dados_variaveis.nome_tabela, cat_dados_variaveis.nome_campo, cat_dados_variaveis.tipo_campo,  cat_dados_variaveis.tipo_pessoa, cat_dados_variaveis.descricao_campo, cat_dados_variaveis.ch_primaria, cat_dados_variaveis.null_campo, cat_dados_variaveis.unq, cat_dados_variaveis.volatil, cat_dados_variaveis.lgpd, cat_dados_variaveis.amostra_campo FROM cat_dados_variaveis JOIN cat_dados_tabela ON cat_dados_variaveis.id_tabela = cat_dados_tabela.id_tabela WHERE id_numerico=" + req.query.id_numerico;
    var db = new sqlite3.Database(DBPATH); // Abre o banco
    db.all(sql, [], (err, rows) => {
        if (err) {
            throw err;
        }
        res.json(rows);
    });
    // Fecha o banco
    db.close();
});

app.get('/tabela/nome', (req, res) => {
    res.statusCode = 200;
    res.setHeader('Access-Control-Allow-Origin', '*');
    var sql = "SELECT nome_tabela FROM cat_dados_tabela WHERE id_numerico=" + req.query.id_numerico;
    var db = new sqlite3.Database(DBPATH); // Abre o banco
    db.all(sql, [], (err, rows) => {
        if (err) {
            throw err;
        }
        res.json(rows);
    });
    // Fecha o banco
    db.close();
});

// Endpoint para solicitação de ticket de alteração de dados
app.post('/ticket/solicitacao', (req, res) => {
    res.statusCode = 200;
    res.setHeader('Access-Control-Allow-Origin', '*');

    // Separa as linhas do corpo da requisição
    const lines = req.body.split('\n');

    // Mapeia os valores a partir das linhas
    const values = lines.reduce((acc, line) => {
        const [key, value] = line.split('|');
        acc[key.trim()] = value.trim();
        return acc;
    }, {});

    // Extrai os valores individuais
    const { nome, email, motivo, id_tabela, update_query, status, resumo} = values;

    // Executa a lógica de atualização no banco de dados
    const sql = `INSERT INTO ticket (nome, email, motivo, id_tabela, update_query, status, resumo) VALUES ('${nome}', '${email}', '${motivo}', '${id_tabela}', '${update_query.replace(/'/g, "''")}', '${status}', '${resumo}')`;

    var db = new sqlite3.Database(DBPATH); // Abre o banco
    db.run(sql, [], function (err) {
        if (err) {
            throw err;
        }

        res.send('Ticket enviado com sucesso');

        // Fecha o banco
        db.close();
    });
});

app.get('/ticket/pendente', (req, res) => {
    res.statusCode = 200;
    res.setHeader('Access-Control-Allow-Origin', '*');
    sql = "SELECT * FROM ticket JOIN cat_dados_tabela ON ticket.id_tabela = cat_dados_tabela.id_tabela WHERE status = 'pendente'";
    var db = new sqlite3.Database(DBPATH); // Abre o banco
    db.all(sql, [], (err, rows) => {
        if (err) {
            throw err;
        }
        res.json(rows);
    });
    // Fecha o banco
    db.close();
});

app.post('/ticket/apagar', urlencodedParser, (req, res) => {
	res.statusCode = 200;
	res.setHeader('Access-Control-Allow-Origin', '*'); 
	var db = new sqlite3.Database(DBPATH); // Abre o banco
	sql = "UPDATE ticket SET status='rejeitado' WHERE id_ticket=" + req.body.id_ticket;
	console.log(sql);
	db.run(sql, [],  err => {
		if (err) {
		    throw err;
		}	
	});
	db.close(); // Fecha o banco
	res.end();
});

app.post('/ticket/aprovar', urlencodedParser, (req, res) => {
	res.statusCode = 200;
	res.setHeader('Access-Control-Allow-Origin', '*'); 
	var db = new sqlite3.Database(DBPATH); // Abre o banco
	sql = "UPDATE ticket SET status='aprovado' WHERE id_ticket=" + req.body.id_ticket;
	console.log(sql);
	db.run(sql, [],  err => {
		if (err) {
		    throw err;
		}	
	});
	db.close(); // Fecha o banco
	res.end();
});


// Inicialização do servidor web na porta e hostname definidos anteriormente
app.listen(port, hostname, () => {
    console.log(`Servidor rodando em http://${hostname}:${port}/`);
});