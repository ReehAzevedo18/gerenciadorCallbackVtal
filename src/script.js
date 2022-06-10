const Excel = require('exceljs');
const wb = new Excel.Workbook();
const input = document.getElementById("upload")
const gerar = document.getElementById("gerarCallback");
const baixar = document.getElementById("baixar");
const msgGerarJson = document.getElementById("msgGerarJson");
const jsonNaTela = document.getElementById("jsonTextArea");

//Obtendo as informações da planilha
input.addEventListener("change", function(event) {
    let fileName = event.target.files[0].path;
    
    wb.xlsx.readFile(fileName).then(() => {
    const ws = wb.getWorksheet('Informações Tenants');
    main(ws);

   }).catch(err => {
       alert("Falha ao ler o arquivo. Apenas planilhas de extensão .xlsx são válidas!");
    });
});

function main(ws){
    //Transformando os dados da planilha para o formato de Json
    const result = formatJson(ws);

    let resultEvents = {}
    let resultAmbiente = {}

    //Iniciando o processo para gerar o callback
    gerar.addEventListener("click", function(){
        let tipoCallback = document.querySelector('input[name=tipoCallback]:checked').value == "Sim";
        let tipoAmbiente = document.querySelector('input[name=tipoAmbiente]:checked').value;
        let urlValid = true;
        
        //Construindo o Json de autenticação
        const resultJsonAuth = formatJsonAuth(result);
        
        //Obtendo os dados de acordo com o ambiente selecionado
        resultAmbiente = dadosDoAmbiente(resultJsonAuth,tipoAmbiente);

        //Construindo o callback (Json)
        resultEvents = validacaoGeracaoJson(resultAmbiente, urlValid, tipoCallback);

        //Validando quando o campo grant_type for do tipo PASSWORD pois os campos login e senha são obrigatórios
        const isGrantTypePassword = resultAmbiente["auth"]["grant_type"] == "password" || resultAmbiente["auth"]["grant_type"] == "Password";
        if(isGrantTypePassword){
            if(resultAmbiente["auth"]["login"] == null || resultAmbiente["auth"]["senha"] == null)
                alert("O campo grant_type está preenchido como password, os campos login e senha são obrigatórios.");
                jsonNaTela.value = "";
                return false;
        }else{
            if(urlValid){
                //Mostrando o resultado em tela
                jsonNaTela.value = JSON.stringify(resultEvents, null, 4);
            }else{
                msgGerarJson.style.display = 'block';
            }
        }  
    });

    //Criando e baixando o arquivo de callback
    baixar.addEventListener("click",function(){
        const name = `callback_CP_${result["Genérico"]["Nome curto para cadastro (máx. 15 caracteres):"]}`;
        baixarCallback(name);
    });
}

function validarUrl(url, nameEvent, urlBase){
    const host = new URL(urlBase).host;
    let urlValida =  `${host}/listener/${nameEvent}`;
    return url.indexOf(urlValida) > -1
}

function formatJson(ws){
    let result = {};
    let title = "Genérico";
    ws.eachRow({ 
        includeEmpty: false }, 
        function(row) {
            const valuesFormatado = row.values.filter(item => item);
            if(valuesFormatado[0].includes("Webhook"))
                title = valuesFormatado[1];

            if(!result.hasOwnProperty(title)){
                result[title] = {}
            }
            result[title][valuesFormatado[0]] = valuesFormatado[1];
        });
    return result;
}

function gerarJsonDeAutenticacao(temCredencial, type, urlToken, scope, token, key, secret, grant_type, login, senha){
    const isAuth = temCredencial == "SIM" || temCredencial == 'sim'
    
    if(!isAuth){
        let jsonNone = {
            "type": "None",
            }
        return jsonNone;
    }else if(type == 'Basic'){
        let [keyDescripty, secretDescripty] = atob(token).split(":");
        let jsonBasic = {
                "type": type,
                "key": token ? keyDescripty : key,
                "secret": token ? secretDescripty : secret
                }
        return jsonBasic;
       
    }else if(type == 'Token' || type == 'TokenAPI' || type == 'apiToken' || type == 'TokenApi'){
        let [keyDescriptyToken, secretDescriptyToken] = atob(token).split(":");
            let jsonToken = {
                "type": type,
                "url": urlToken,
                "scope": scope ? scope : " ",
                "key": token ? keyDescriptyToken : key,
                "secret": token ? secretDescriptyToken : secret,
                "grant_type": grant_type,
                "login": login,
                "senha": senha
            }
            return jsonToken;
    }else{
        alert("O tipo de autenticação informado não é válido! Verifique a planilha e tente novamente.");
    }
}

function formatJsonAuth(result){
    const resultJsonAuth = Object.keys(result).map(item => {
        if(result[item]["Requer autenticação?"]){
            const JsonAuth = gerarJsonDeAutenticacao(result[item]["Requer autenticação?"], 
            result[item]["type"], result[item]["url de Token"], result[item]["scope"], result[item]["token"],
            result[item]["key"], result[item]["secret"], result[item]["grant_type"], result[item]["login"], result[item]["senha"]);

           result[item]["auth"] = JsonAuth;
        }
        return result[item]; 
    });
    return resultJsonAuth;
}

function dadosDoAmbiente(resultJsonAuth, tipoAmbiente){
    let dadosAmbiente;
    dadosAmbiente = resultJsonAuth.find(item => {
            return Object.keys(item).includes(`URLs Webhook ${tipoAmbiente}`);
        });
        return dadosAmbiente;
}

function validacaoGeracaoJson(resultAmbiente, urlValid, tipoCallback){
    const resultEvents = Object.keys(resultAmbiente).reduce((acumulador, valorAtual) => {
        //validar CP grande (fora do padrão Vtal) ou pequena 
        if(valorAtual.indexOf("Event") > -1){
            if(!tipoCallback)
                urlValid =  (urlValid) && validarUrl(resultAmbiente[valorAtual]["result"], valorAtual, resultAmbiente["URL Base"]["text"]);
            acumulador.event[valorAtual] = {
                "scope": "fttx",
                "quota": "1",
                "url": resultAmbiente[valorAtual]["result"], 
                "timeout_connection": "2000",
                "timeout_read": "5000",
                "authentication": resultAmbiente["auth"]
            };
        }
        return acumulador;
    }, {event: {
    }});
    return resultEvents;
}

function baixarCallback(name) {
    let data = document.querySelector('#jsonTextArea').value;
    let blob = new Blob([data], { type: 'text/plain;charset=utf-8;' });
    const link= window.document.createElement('a');
    
    link.href = window.URL.createObjectURL(blob);
    link.download = `${name}.json`;
    link.click();
    window.URL.revokeObjectURL(link.href);
}

//Função para copiar texto da textArea
function copy(){
    const text = jsonNaTela.value;
    if (!navigator.clipboard || !text){
        alert("Função não disponível!");
    } else{
        navigator.clipboard.writeText(text).then(
            function(){
                alert("Texto copiado para a área de transferência!");
            })
          .catch(
             function() {
                alert("Não foi possivel copiar o texto!");
          });
    }    
}