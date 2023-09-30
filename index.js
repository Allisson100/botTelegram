require('dotenv').config();

const { MongoClient } = require('mongodb');
const { Telegraf , Markup  } = require('telegraf')

const token = process.env.TOKEN_TELEGRAF
const usuariosAutorizados = process.env.AUTHORIZED_USER;
const url = process.env.MONGODB_URL
const dbName = process.env.DTB_NAME;
const collectionName = process.env.DTB_COLLECTION_NAME;
const groupId = process.env.CHAT_ID_GRUPO_TELEGRAM;

const bot = new Telegraf(token)

let getTiktokLink = '';
let getProfileName = ''
let arrayDeLinksDiario = [];
let userSteps = {};
let autorizacaoDeComando = 0;

// BANCO DE DADOS
//CONEXÃO

    async function connectToMongoDB() {
        const client = new MongoClient(url);

        try {
            // Conecta ao servidor MongoDB
            await client.connect();

            // Seleciona o banco de dados
            const db = client.db(dbName);

            // Seleciona a coleção
            const collection = db.collection(collectionName);

            console.log('Conexão com o MongoDB estabelecida com sucesso!');

            // Retorna a coleção
            return collection;
        } catch (err) {
            console.error('Erro ao conectar ao MongoDB:', err);
            throw err;
        }
    }
    // Exemplo de uso:
    async function main() {
        const collection = await connectToMongoDB();
    }

main();

//FUNÇÕES DB
    //QUEM ENTRAR É ADICIONADO NO DB
    async function saveMember(userId, tiktokLink,profileName, phoneNumber, profileAccessed ) {
        try {
            const collection = await connectToMongoDB();
            const result = await collection.insertOne({ userId, tiktokLink, profileName, phoneNumber, profileAccessed });
            console.log('Novo membro salvo:', userId);
            return result.insertedId ? true : false;
        } catch (error) {
            console.error('Erro ao salvar novo membro:', error);
            return false;
        }
    }

    //SE UM MEMBRO SAIR DO GRUPO ATUALIZAR DB
    async function removeMember(userId) {
        const collection = await connectToMongoDB();
        const result = await collection.deleteOne({ userId });
        console.log('Membro removido:', userId);
    }

    //PEGAR OS MEMBROS NO DB QUANDO O BOT FOR INICIALIZADO
    async function getMemberIds() {
        const collection = await connectToMongoDB();
        const members = await collection.find().toArray();
        return members.map(member => member.userId);
    }

    //VERIFICA SE USUÁRIO JÁ ESTÁ NO BANCO DE DADOS
    async function checkUserExists(userId) {
        const collection = await connectToMongoDB();

        // Realize uma consulta para verificar se um usuário com o userId fornecido já existe
        const existingUser = await collection.findOne({ userId });

        // Retorna true se o usuário existe, false caso contrário
        return !!existingUser;
    }

    // Adiciona uerIds dentro do array profileAccessed no DB
    async function addProfileAccessed(userId, profileUserId) {
        try {
          const collection = await connectToMongoDB();
      
          // Encontre o documento do usuário com base no userId
          const user = await collection.findOne({ userId: userId });
      
          if (user) {
            // Verifique se o profileUserId já existe no array profileAccessed
            if (!user.profileAccessed.includes(profileUserId)) {
              // Adicione o profileUserId ao array profileAccessed
              user.profileAccessed.push(profileUserId);
      
              // Atualize o documento do usuário no MongoDB
              await collection.updateOne({ _id: user._id }, { $set: { profileAccessed: user.profileAccessed } });
      
              console.log(`ProfileUserId ${profileUserId} adicionado ao array profileAccessed do usuário ${userId}`);
            } else {
              console.log(`ProfileUserId ${profileUserId} já existe no array profileAccessed do usuário ${userId}`);
            }
          } else {
            console.log(`Usuário com userId ${userId} não encontrado`);
          }
        } catch (error) {
          console.error('Erro ao conectar ao MongoDB:', error);
        }
    }

    // Remove uerIds dentro do array profileAccessed no DB
    async function removeProfileAccessed(userId, profileUserId) {
        try {
          const collection = await connectToMongoDB();
      
          // Encontre o documento do usuário com base no userId
          const user = await collection.findOne({ userId: userId });
      
          if (user) {
            // Remova o profileUserId do array profileAccessed
            user.profileAccessed = user.profileAccessed.filter(id => id !== profileUserId);
      
            // Atualize o documento do usuário no MongoDB
            await collection.updateOne({ _id: user._id }, { $set: { profileAccessed: user.profileAccessed } });
      
            console.log(`ProfileUserId ${profileUserId} removido do array profileAccessed do usuário ${userId}`);
          } else {
            console.log(`Usuário com userId ${userId} não encontrado`);
          }
        } catch (error) {
          console.error('Erro ao conectar ao MongoDB:', error);
        }
    }

    // Obtem o array profileAccessed no DB
    async function getProfileAccessed(userId) {
        try {
          const collection = await connectToMongoDB();
      
          // Encontre o documento do usuário com base no userId
          const user = await collection.findOne({ userId: userId });
      
          if (user) {
            // Acesse o array profileAccessed e retorne-o
            return user.profileAccessed;
          } else {
            console.log(`Usuário com userId ${userId} não encontrado`);
            return [];
          }
        } catch (error) {
            console.error('Erro ao conectar ao MongoDB:', error);
          return [];
        }
    }

    // Obtem o array nome do perfil do tiktok no DB
    async function getProfileTiktokName(userId) {
        try {
            const collection = await connectToMongoDB();
            // Encontre o documento do usuário com base no userId
            const user = await collection.findOne({ userId: userId });
        
            if (user) {

                // Pega o nome do canal
                const profileLink = user.tiktokLink;
                const regex = /\/@([^?]+)/;
                const match = profileLink.match(regex);

                if (match && match.length > 1) {
                    const profileName = match[1];

                    return `@${profileName}`;

                } else {
                    console.log("Não foi possível encontrar o username na URL.");
                    return null
                }

            } else {
                console.log(`Usuário com userId ${userId} não encontrado`);
                return null
            }

        } catch (error) {
            console.error('Erro ao conectar ao MongoDB:', error);
            return null;
        }
    }

    // Busca informações dos usuarios bloqueados no DB
    async function buscarInfoDeMembrosBloqueadosAposComandos (userId) {
        try {

            let userIdToNumber = 0;

            if(typeof userId === 'string') {
                userIdToNumber = parseInt(userId, 10);
            }else{
                userIdToNumber = userId
            }
            
            const collection = await connectToMongoDB();
            // Encontre o documento do usuário com base no userId
            const user = await collection.findOne({ userId: userIdToNumber });
        
            if (user) {
                const tiktokLink = user.tiktokLink;

                return `UserId: ${userIdToNumber}\nLink: ${tiktokLink}`

            } else {
              console.log(`Usuário com userId ${userIdToNumber} não encontrado`);

              return `Usuário com userId ${userIdToNumber} não encontrado`
            }
        } catch (error) {
            return `Erro ao conectar ao MongoDB:\n${error}`
        }
    }

// FUNÇÕES PARA LÓGICA DO BOT E VERIFICAÇÕES

    // Função para verificar se o link de PERFIL do TikTok é válido
    function isValidTikTokLink(link) {
        //falso cai no erro

        if(link.includes('tiktok.com')) {
            if(!link.includes('vm') && !link.includes('video')) {
                return true
            }else {
                return false
            }
        } else {
            return false
        }
    }

    // Função para verificar se o usuário tem o Bot bloqueado ou não
    async function isUserBlocked(userId) {
        try {
            // Tenta enviar uma ação de chat para o usuário (isso não enviará uma mensagem real)
            await bot.telegram.sendChatAction(userId, 'typing');

            // Se não ocorrer erro, o usuário não bloqueou o bot
            return false;
        } catch (error) {
            console.error(`Erro ao verificar status do usuário ${userId}: ${error}`);
            return true; // O erro indica que o usuário bloqueou o bot
        }
    }

    async function processarListaDeMembros(memberIds) {
        const tiktokLinks = [];

        try {
            const collection = await connectToMongoDB();

            for (const member of memberIds) {
                const memberData = await collection.findOne({ userId: member });

                if (memberData) {
                    const tiktokLink = memberData.tiktokLink;
                    tiktokLinks.push({
                        url: tiktokLink,
                        userId: member,
                    });
                } else {
                    console.log(`O usuário com userId ${member} não existe.`);
                }
            }

            const newLinks = tiktokLinks
            .map((tiktokLinks) => {
                const match = tiktokLinks.url.match(/@([^?]+)/);
                if (match) {
                    return {url:`tiktok\.com/@${match[1]}`, userId: `${tiktokLinks.userId}` }
                }
                return null;
            })
            .filter((link) => link !== null);

            if (newLinks.length === 0) {
                return 'Não há links TikTok para enviar.';
            }

            return newLinks;
        } catch (error) {
            console.error('Erro ao buscar dados do membro no banco de dados:', error);
        }
    }

    // Embaralha array de membros para seguir
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }

    // Função para enviar a lista de vídeos para um usuário
    async function sendMemberListToUser(userId, listadeMembrosFormatada) {
        try {
            // Obtenha o Array profileAccessed do usuário
            const userProfileAccessed = await getProfileAccessed(userId);
            let novoArrayAleatorio = [];
        
            if (userProfileAccessed.length === 0) {
                console.log('O profileAccessed deste usuário está vazio');
            } else {
                // Converte os números do primeiro array para strings
                const numerosFiltrar = userProfileAccessed.map((numero) => numero.toString());
                // Filtra o segundo array para excluir os itens com userIds no primeiro array
                const novoArrayFiltrado = listadeMembrosFormatada.filter((item) => !numerosFiltrar.includes(item.userId));
                // Embaralhe o novoArrayFiltrado
                const arrayEmbaralhado = shuffleArray(novoArrayFiltrado);
                // Pegue os 10 primeiros itens ou menos, dependendo do tamanho do array
                novoArrayAleatorio = arrayEmbaralhado.slice(0, 10);
            }

            // Crie uma nova instância do objeto Date
            let dataAtual = new Date();
    
            // Obtenha o dia, mês e ano atual
            let dia = dataAtual.getDate();
            let mes = dataAtual.getMonth() + 1; // Os meses são indexados a partir de 0, então somamos 1
            let ano = dataAtual.getFullYear();

            dia = dia < 10 ? `0${dia}` : dia
            mes = mes < 10 ? `0${mes}` : mes

            // Formate a data no formato desejado (por exemplo, "dd/mm/aaaa")
            let dataFormatada = dia + '/' + mes + '/' + ano;
        
            if (novoArrayAleatorio.length !== 0) {

                const initialMessage = `🤗 Aqui estão 10 perfis para você seguir hoje e ajudar o grupo!\nData: ${dataFormatada}`
                await bot.telegram.sendMessage(userId, initialMessage)
                
                for (let i = 0; i < novoArrayAleatorio.length; i++) {
                    const linkOriginal = novoArrayAleatorio[i].url;
            
                    const usernameRegex = /@(.+)/;
                    const match = linkOriginal.match(usernameRegex);
            
                    let userPorfile = '';
            
                    if (match) {
                        userPorfile = '@' + match[1];
                    } else {
                        console.log('Nome de usuário não encontrado na URL.');
                    }
            
                    const statusNaoVisto = '🔴 Status: não visto';
                    const statusVisto = '🟢 Status: visto';
            
                    const mensagem = `${userPorfile}\n${statusNaoVisto}\n`;
                    const botaoTexto = `Ver perfil`;
            
                    // Crie um identificador único para a ação de callback
                    const botaoCallback = `${novoArrayAleatorio[i].userId}ML`;
            
                    // Determine o estado atual com base na mensagem inicial
                    const initialState = mensagem.includes(statusNaoVisto) ? 'nao_visto' : 'visto';
            
                    const botoesInline = [
                        Markup.button.url(botaoTexto, linkOriginal),
                        Markup.button.callback(
                        initialState === 'visto' ? '✅' : '⬜',
                        `status_${botaoCallback}_${initialState}`
                        ),
                    ];

                    const message = await bot.telegram.sendMessage(userId, mensagem, {
                        parse_mode: 'HTML',
                        reply_markup: {
                        inline_keyboard: [botoesInline],
                        },
                    });
            
                    const getProfileUserId = novoArrayAleatorio[i].userId;
            
                    // Registre todas as ações de callback possíveis antecipadamente
                    bot.action(`status_${botaoCallback}_nao_visto`, async (ctx) => {
                        await handleStatusClick(ctx, 'visto', getProfileUserId);
                    });
            
                    bot.action(`status_${botaoCallback}_visto`, async (ctx) => {
                        await handleStatusClick(ctx, 'nao_visto', getProfileUserId);
                    });
            
                    async function handleStatusClick(ctx, newState, profileUserId) {
                        const newStatus = newState === 'visto' ? statusVisto : statusNaoVisto;
                        const whoClicked = ctx.update.callback_query.from.id;
            
                        // Atualize o botão de callback para mostrar o emoji correspondente
                        await ctx.editMessageText(`${userPorfile}\n${newStatus}\n `, {
                        parse_mode: 'HTML',
                        });
            
                        await ctx.editMessageReplyMarkup({
                        inline_keyboard: [
                            [
                            Markup.button.url(botaoTexto, linkOriginal),
                            Markup.button.callback(
                                newStatus === statusNaoVisto ? '⬜' : '✅',
                                `status_${botaoCallback}_${newStatus === statusNaoVisto ? 'nao_visto' : 'visto'}`
                            ),
                            ],
                        ],
                        });
            
                        if (newStatus === '🟢 Status: visto') {
                            await addProfileAccessed(whoClicked, profileUserId);
                        }
            
                        if (newStatus === '🔴 Status: não visto') {
                            await removeProfileAccessed(whoClicked, profileUserId);
                        }
                    }
                }
            } else {
                const novaMensagem =
                '🥂 Parabéns, você já seguiu todos os membros do grupo\n💪Continue assim para a comunidade continuar forte';
                await bot.telegram.sendMessage(userId, novaMensagem);
            }
        } catch (error) {
            console.error(`Erro ao enviar a lista para o usuário ${userId}: ${error}`);
        }
    }

    // Filtra membros bloqueados usando Promise.all
    async function filterBlockedMembers(memberIds) {
        const promises = memberIds.map(memberId => isUserBlocked(memberId));
        const results = await Promise.all(promises);
        
        const nonBlockedMembers = [];
        for (let i = 0; i < memberIds.length; i++) {
            if (!results[i]) {
                nonBlockedMembers.push(memberIds[i]);
            }
        }
        
        return nonBlockedMembers;
    }
  
    // Envia mensagens para os membros pegando o link do dia
    async function enviarMensagemParaObterLinks(userId) {
        try {
            await bot.telegram.sendMessage(userId, '🔗 Por favor, envie o link do seu vídeo de hoje para que a comunidade possa assistir ele:');
            userSteps[userId] = 3;
        } catch (error) {
            console.error(`Erro ao enviar a lista para o usuário ${userId}: ${error}`);
        }
    }

    // Função para enviar mensagem para caso o usuário esquecer de colocar o link do vídeo
    async function enviarMensagemDeBloqueio(userId) {
        try {
            await bot.telegram.sendMessage(userId, '⚠️ Você se esqueceu de enviar o link do vídeo hoje, mas amanhã poderá enviar novamente.\n\n🥰 Não se esqueça de ajudar a comunidade');
            userSteps[userId] = 10;
        } catch (error) {
            console.error(`Erro ao enviar a lista para o usuário ${userId}: ${error}`);
        }
    }

    // Valida o link do vídeo do usuário
    function validarLinkDoVideo(userMessage) {
        // Verifica se a mensagem do usuário é um link de vídeo do tiktok
        if(userMessage.includes('tiktok.com')) {
            if (userMessage.includes('vm.') || userMessage.includes('/video/')) {

                const ocorrencias = (userMessage.match(/tiktok\.com/g) || []).length;

                if (ocorrencias > 1) {
                    return false
                } else {
                    return true
                }
            } else {
                return false
            }
        } else {
            return false
        }
    }

    // Função para enviar a lista de vídeos para um usuário
    async function sendVideoListToUser(userId, arrayDeLinksDiario, dataFormatada) {
        try {
            if (arrayDeLinksDiario.length !== 0) {

                for (let i = 0; i < arrayDeLinksDiario.length; i++) {
                    const linkOriginal = arrayDeLinksDiario[i].link;

                    const statusNaoVisto = '🔴 Status: não visto';
                    const statusVisto = '🟢 Status: visto';
                    const title = `🎦 Assita o vídeo do perfil: ${arrayDeLinksDiario[i].profileName}\n👇 Clique em ver vídeo`;
                    const mensagem = `${statusNaoVisto}\n\n${title}`;
                    const botaoTexto = `Ver Vídeo`;
                    const botaoCallback = `${arrayDeLinksDiario[i].userId}MV`;
                    const initialState = mensagem.includes(statusNaoVisto) ? 'nao_visto' : 'visto';
            
                    const botoesInline = [
                        Markup.button.url(botaoTexto, linkOriginal),
                        Markup.button.callback(initialState === 'visto' ? '✅' : '⬜', `status_${botaoCallback}_${initialState}`)
                    ];
            
                    const message = await bot.telegram.sendMessage(userId, mensagem, {
                        parse_mode: 'HTML',
                        reply_markup: {
                            inline_keyboard: [botoesInline],
                        },
                    });
            
                    // Registre todas as ações de callback possíveis antecipadamente
                    bot.action(`status_${botaoCallback}_nao_visto`, async (ctx) => {
                        await handleWhoClicked(ctx, 'visto');
                    });
            
                    bot.action(`status_${botaoCallback}_visto`, async (ctx) => {
                        await handleWhoClicked(ctx, 'nao_visto');
                    });
            
                    async function handleWhoClicked(ctx, newState) {
                        const newStatus = newState === 'visto' ? statusVisto : statusNaoVisto;
                        // Atualize o botão de callback para mostrar o emoji correspondente
                        await ctx.editMessageText(`${newStatus}\n\n${title}`, {
                            parse_mode: 'HTML',
                        });
            
                        await ctx.editMessageReplyMarkup({
                            inline_keyboard: [
                                [
                                    Markup.button.url(botaoTexto, linkOriginal),
                                    Markup.button.callback(newStatus === statusNaoVisto ? '⬜' : '✅', `status_${botaoCallback}_${newStatus === statusNaoVisto ? 'nao_visto' : 'visto'}`)
                                ]
                            ]
                        });
                    }
                }
            } else {
                await bot.telegram.sendMessage(userId, 'A lista está vazia');
            }
        } catch (error) {
            console.error(`Erro ao enviar a lista para o usuário ${userId}: ${error}`);
        }
    }

    // Apenas cria um array com os usuários que estão bloqueados
    function idsNaoPresentes(array1, array2) {
        // Use o método filter para criar um novo array com os IDs que não estão em array2
        const idsFaltantes = array1.filter(id => !array2.includes(id));
        return idsFaltantes;
    }

    // Transforma o array original do vídeos na lógica de subarrays
    function tranformarArrayDeVideosEmSubarrays (membrosBloqueados, linksEnviados) {

        let linksEnviadosFiltrados = linksEnviados.filter((link) => !membrosBloqueados.includes(link.userId));
    
        const quantosLinksEuTenho = linksEnviadosFiltrados.length;
        const qualQuantidadeDeVideosCadaUsuarioDeveReceber = 35;
    
        let numeroDivisor = 1;
        let resultadoDivisao = quantosLinksEuTenho / numeroDivisor;
    
        while (resultadoDivisao > qualQuantidadeDeVideosCadaUsuarioDeveReceber) {
            numeroDivisor++;
            resultadoDivisao = quantosLinksEuTenho / numeroDivisor;
        }
    
        const resultadoInteiro = Math.floor(resultadoDivisao);
    
        let quantosLinksPelaConta = resultadoInteiro * numeroDivisor
        let linksQueEstaoDeSobra = quantosLinksEuTenho - quantosLinksPelaConta
    
        const arrayOriginal = linksEnviadosFiltrados; // Adicione mais itens conforme necessário
        const numeroSubarraysDesejado = numeroDivisor; // Número desejado de subarrays
        
        function dividirArrayEmSubarrays(arrayOriginal, numeroSubarraysDesejado) {
            const totalItens = arrayOriginal.length;
            const tamanhoIdealSubarray = Math.ceil(totalItens / numeroSubarraysDesejado);
            const subarraysVideos = [];
            const comprimentosSubarraysVideos = [];
    
            let inicio = 0;
    
            for (let i = 0; i < numeroSubarraysDesejado; i++) {
                const tamanhoSubarray = Math.min(tamanhoIdealSubarray, totalItens - inicio);
                const subarrays = arrayOriginal.slice(inicio, inicio + tamanhoSubarray);
                subarraysVideos.push(subarrays);
                comprimentosSubarraysVideos.push(subarrays.length);
                inicio += tamanhoSubarray;
            }
    
            return { subarraysVideos, comprimentosSubarraysVideos };
        }
    
        const { subarraysVideos, comprimentosSubarraysVideos } = dividirArrayEmSubarrays(arrayOriginal, numeroSubarraysDesejado);
    
        return { subarraysVideos, comprimentosSubarraysVideos }
    }
    
    // Transforma o array original do usuários que podem receber mensagem na lógica de subarrays 
    function tranformarArrayDeUsuariosEmSubarrays (usuariosQuePodemReceberMensagem) {
        
        const quantosLinksEuTenho = usuariosQuePodemReceberMensagem.length;
        const qualQuantidadeDeVideosCadaUsuarioDeveReceber = 35;
    
        let numeroDivisor = 1;
        let resultadoDivisao = quantosLinksEuTenho / numeroDivisor;
    
        while (resultadoDivisao > qualQuantidadeDeVideosCadaUsuarioDeveReceber) {
            numeroDivisor++;
            resultadoDivisao = quantosLinksEuTenho / numeroDivisor;
        }
    
        const resultadoInteiro = Math.floor(resultadoDivisao);
    
        let quantosLinksPelaConta = resultadoInteiro * numeroDivisor
        let linksQueEstaoDeSobra = quantosLinksEuTenho - quantosLinksPelaConta
    
        const arrayOriginal = usuariosQuePodemReceberMensagem; // Adicione mais itens conforme necessário
        const numeroSubarraysDesejado = numeroDivisor; // Número desejado de subarrays
        const { subarraysUsuario, comprimentosSubarraysUsuario } = dividirArrayEmSubarrays(arrayOriginal, numeroSubarraysDesejado);
    
        function dividirArrayEmSubarrays(arrayOriginal, numeroSubarraysDesejado) {
            const totalItens = arrayOriginal.length;
            const tamanhoIdealSubarray = Math.ceil(totalItens / numeroSubarraysDesejado);
            const subarraysUsuario = [];
            const comprimentosSubarraysUsuario = [];
    
            let inicio = 0;
    
            for (let i = 0; i < numeroSubarraysDesejado; i++) {
                const tamanhoSubarray = Math.min(tamanhoIdealSubarray, totalItens - inicio);
                const subarray = arrayOriginal.slice(inicio, inicio + tamanhoSubarray);
                subarraysUsuario.push(subarray);
                comprimentosSubarraysUsuario.push(subarray.length);
                inicio += tamanhoSubarray;
            }
    
            return { subarraysUsuario, comprimentosSubarraysUsuario };
        }
    
        // console.log("Usuário quantosLinksEuTenho: ", quantosLinksEuTenho);
        // console.log("Usuário quantosLinksPelaConta: ",quantosLinksPelaConta);
        // console.log("Usuário linksQueEstaoDeSobra: ",linksQueEstaoDeSobra);
        // console.log("Usuário resultadoInteiro: ", resultadoInteiro);
        // console.log("Usuário numeroDivisor", numeroDivisor);
    
        // console.log("Usuário Subarrays:", subarrays);
        // console.log("Usuário Comprimentos dos Subarrays:", comprimentosSubarrays);
    
        return { subarraysUsuario, comprimentosSubarraysUsuario }
    }
    
    // Cria a lógica de subarrays com 35 itens cada subarray para mais que 35 pessoas no grupo
    function redistribuirItens(subarraysVideos) {
    
        const novoSubarrays = subarraysVideos
    
        const metaComprimento = 35;
        const quantidadeDeSubArrays = novoSubarrays.length
    
        for(let i = 0; i < quantidadeDeSubArrays; i++) {
    
            const tamanhoDoSubArrayAtual = novoSubarrays[i].length;
            const quantosFaltaPAraCompletarAMetaDeComprimento = metaComprimento - tamanhoDoSubArrayAtual
    
            if(i === 0) {
    
                const pegarItensParaCompletarDoArrayAnterior = novoSubarrays[quantidadeDeSubArrays - 1].slice(0,quantosFaltaPAraCompletarAMetaDeComprimento)
    
                pegarItensParaCompletarDoArrayAnterior.map((e) => {
                    novoSubarrays[i].push(e)
                })
    
            } else {
    
                const pegarItensParaCompletarDoArrayAnterior = novoSubarrays[i - 1].slice(0,quantosFaltaPAraCompletarAMetaDeComprimento)
    
                pegarItensParaCompletarDoArrayAnterior.map((e) => {
                    novoSubarrays[i].push(e)
                })
            }
        }
    
        return novoSubarrays    
    }

    //Verifica número de celular
    function isValidPhoneNumber(phoneNumber) {
        // Etapa 1: Verificar se o número contém apenas dígitos
        if (!/^\d+$/.test(phoneNumber)) {
            return false; // Contém caracteres não numéricos
        }
    
        // Etapa 2: Verificar se o número tem pelo menos dez dígitos
        if (phoneNumber.length < 10) {
            return false; // Não tem pelo menos dez dígitos
        }
    
        // Se passou pelas duas etapas de validação, é um número válido
        return true;
    }

    // Verifica quem são os userIds do DB que também estão no grupo
    async function getListaDeMembrosDoGrupo () {
        // Busca todos os userId no banco de dados
        const memberIds = await getMemberIds();

        const membersInGroup = [];

        // Cria um array de Promises para verificar cada userId
        const promises = memberIds.map(async (userIdMembro) => {
            try {
                const member = await bot.telegram.getChatMember(groupId, userIdMembro);
                // Se não houver erro, adiciona o userId à lista
                membersInGroup.push(userIdMembro);
            } catch (error) {
                console.log(error);
                // Se ocorrer um erro, o userId não está no grupo e é ignorado
            }
        });

        // Espera que todas as Promises sejam resolvidas
        await Promise.all(promises);

        return membersInGroup
    }

//COMANDOS DO BOT
    bot.command('start', async (ctx) => {
        const userId = ctx.message.from.id;
        userSteps[userId] = 0;

        const userExists = await checkUserExists(userId);

        if (userExists) {
            // Se o usuário já existe, envie uma mensagem de boas-vindas padrão
            ctx.reply('🎈 Bem-vindo de volta ao bot! 🎈');
            userSteps[userId] = 10;
        } else {
            ctx.reply('🎈 Bem-vindo ao bot! 🎈\n\n⚠️ Apenas mensagens de textos são interpretadas ⚠️\n\n📺 Para entrar no nosso grupo, por favor, digite o link do seu PERFIL do TikTok:\n\n😊 Isso é importante para que todos do grupo possam te seguir!\n\n💡 Exemplo:\ntiktok.com/@nome_do_seu_perfil');

            userSteps[userId] = 2; // Inicialize a etapa da conversa
        }
    });

    // COMANDO: /enviarlistademembrosatualizada
    bot.command('enviarlistademembrosatualizada', async (ctx) => {
        const userId = ctx.message.from.id;
    
        if (usuariosAutorizados.includes(userId)) {
            try {

                const memberIds = await getListaDeMembrosDoGrupo()
                console.log("AMOE", memberIds);
    
                if (memberIds.length === 0) {
                    ctx.reply('Não há membros no banco de dados para enviar a lista atualizada.');
                    return;
                }
    
                // Formata a lista como você deseja
                const listadeMembrosFormatada = await processarListaDeMembros(memberIds);
    
                // Pega somente o Array com usuarios que não estão com o bot bloqueado
                const nonBlockedMembers = await filterBlockedMembers(memberIds);
    
                // Use Promise.all para enviar mensagens para todos os membros não bloqueados simultaneamente
                await Promise.all(
                    nonBlockedMembers.map(async (memberId) => {
                        await sendMemberListToUser(memberId, listadeMembrosFormatada);
                    })
                );

                ctx.reply('Mensagem enviada para todos com o Bot desbloqueado!')
    
            } catch (error) {
                console.error('Erro ao enviar lista atualizada:', error);
                ctx.reply('Ocorreu um erro ao enviar a lista atualizada. Por favor, tente novamente mais tarde.');
            }
        } else {
            ctx.reply('🚨 Você não está autorizado a interagir com este bot.');
        }
    });

    bot.command('obterlinksdosvideos', async (ctx) => {

        const userId = ctx.message.from.id;

        if (usuariosAutorizados.includes(userId)) {

            autorizacaoDeComando = 1

            arrayDeLinksDiario = []

            const memberIds = await getListaDeMembrosDoGrupo()
            
            // Pega somente o Array com usuarios que não estão com o bot bloqueado
            const nonBlockedMembers = await filterBlockedMembers(memberIds);

            await Promise.all(nonBlockedMembers.map((memberId) => enviarMensagemParaObterLinks(memberId)));

        } else {
            ctx.reply('🚨 Você não está autorizado a interagir com este bot.');
        }

    });

    bot.command('bloquearenviodelinks', async (ctx) => {

        const userId = ctx.message.from.id;

        if (usuariosAutorizados.includes(userId)) {

            if (autorizacaoDeComando === 1) {
                const idsComValorTres = [];

                for (const userId in userSteps) {
                    if (userSteps.hasOwnProperty(userId)) {
                        // Verifique se o estado atual é igual a 3 antes de atualizar para 4
                        if (userSteps[userId] === 3) {
                            idsComValorTres.push(userId);
                        }
                    }
                }

                const nonBlockedMembers = await filterBlockedMembers(idsComValorTres);
                await Promise.all(nonBlockedMembers.map((memberId) => enviarMensagemDeBloqueio(memberId)));

                ctx.reply(`Vídeos cadastrados`);

                autorizacaoDeComando = 2
            } else {
                ctx.reply(`Você esqueceu de usar o comando /obterlinksdosvideos antes`)
            }

        } else {
            ctx.reply('🚨 Você não está autorizado a interagir com este bot.');
        }
    });

    bot.command('enviarvideosparaosmembros', async (ctx) => {

        const userId = ctx.message.from.id;

        if (usuariosAutorizados.includes(userId)) {
            if (autorizacaoDeComando === 2) {

                if (arrayDeLinksDiario.length > 0) {
                    // Busca todos os userId no banco de dados
                    const memberIds = await getListaDeMembrosDoGrupo()
    
                    // Crie uma nova instância do objeto Date
                    let dataAtual = new Date();
    
                    // Obtenha o dia, mês e ano atual
                    let dia = dataAtual.getDate();
                    let mes = dataAtual.getMonth() + 1; // Os meses são indexados a partir de 0, então somamos 1
                    let ano = dataAtual.getFullYear();
    
                    dia = dia < 10 ? `0${dia}` : dia
                    mes = mes < 10 ? `0${mes}` : mes
    
                    // Formate a data no formato desejado (por exemplo, "dd/mm/aaaa")
                    let dataFormatada = dia + '/' + mes + '/' + ano;
    
                    // Pega somente o Array com usuarios que não estão com o bot bloqueado
                    const nonBlockedMembers = await filterBlockedMembers(memberIds);
    
                    //Array com lista de usuario que estão bloqueados
                    const membersBlockedArray = idsNaoPresentes(memberIds , nonBlockedMembers);
    
                    //Array de vídeos diários
                    let linksEnviados = arrayDeLinksDiario;
    
                    const { subarraysVideos } = tranformarArrayDeVideosEmSubarrays (membersBlockedArray, linksEnviados)
    
                    const { subarraysUsuario } = tranformarArrayDeUsuariosEmSubarrays (nonBlockedMembers)
    
                    let subarraysAtualizados = subarraysVideos
    
                    if(subarraysVideos.length !== 1) {
                        subarraysAtualizados = redistribuirItens(subarraysVideos);
                    }
    
                    let inicioArrayDeVideo = 0;
    
                    for (let i = 0; i < subarraysUsuario.length; i++) {
    
                        let ateQueNumeroPodeIrOArrayDeVideo = subarraysAtualizados.length - 1;
    
                        let getRightVideoSubarray = subarraysAtualizados[inicioArrayDeVideo]
                        let getOneSubArrayUsuario = subarraysUsuario[i]
    
                        const sendChatActionPromises = getOneSubArrayUsuario.map(async (userId) => {
    
                            await bot.telegram.sendMessage(userId, `🗓️ Aqui está a lista de vídeos do dia - ${dataFormatada}\n\nVamos se ajudar. Lembre-se:\n\n👉 Siga a página do vídeo\n👉 Assista o vídeo até o final\n👉 Curta o vídeo\n👉 Faça um comentário\n👉 Salve nos favoritos\n👉 Compartilhe o vídeo (ou apenas salve o link de compartilhamento).\n\n❣️ Lembre-se que alguém está com o seu vídeo e te ajudará também!`);
        
                            await sendVideoListToUser(userId, getRightVideoSubarray, dataFormatada);
                        });
                    
                        await Promise.all(sendChatActionPromises);
    
                        if(inicioArrayDeVideo === ateQueNumeroPodeIrOArrayDeVideo) {
                            inicioArrayDeVideo = 0
                        } else {
                            inicioArrayDeVideo++
                        }
                    }
    
                    autorizacaoDeComando = 0
    
                    ctx.reply(`Mensagens enviadas para quem não tem o Bot bloqueado.`);
    
                } else {
                    ctx.reply('O array de links diários está vazio');
                }
                
            } else {
                ctx.reply(`Você esqueceu de usar o comando /bloquearenviodelinks antes`)
            }
            
        } else {
            ctx.reply('🚨 Você não está autorizado a interagir com este bot.');
        }
    });

    bot.command('tamanhodalistadevideos', async (ctx) => {

        const userId = ctx.message.from.id;

        if (usuariosAutorizados.includes(userId)) {

            ctx.reply(`O tamanho da lista de vídeo atualmente é:\n${arrayDeLinksDiario.length}`);
            
        } else {
            ctx.reply('🚨 Você não está autorizado a interagir com este bot.');
        }
    });

    bot.command('apagarlistadevideos', async (ctx) => {

        const userId = ctx.message.from.id;

        if (usuariosAutorizados.includes(userId)) {

            arrayDeLinksDiario = []
            ctx.reply(`A lista de vídeos foi apagada`);

        } else {
            ctx.reply('🚨 Você não está autorizado a interagir com este bot.');
        }

    });

    bot.command('verquemestacomobotbloqueado', async (ctx) => {

        const userId = ctx.message.from.id;

        if (usuariosAutorizados.includes(userId)) {

            try {

                const collection = await connectToMongoDB();
                const memberIds = await getListaDeMembrosDoGrupo() // Obtenha os IDs dos membros do seu banco de dados

                // Pega somente o Array com usuarios que não estão com o bot bloqueado
                const nonBlockedMembers = await filterBlockedMembers(memberIds);

                //Array com lista de usuario que estão bloqueados
                const membersBlockedArray = idsNaoPresentes(memberIds , nonBlockedMembers)
                
                const mensagensPromises = membersBlockedArray.map(async (userId) => {
                    try {
                        const userIdToNumber = parseInt(userId, 10);
                        const user = await collection.findOne({ userId: userIdToNumber });
                    
                        if (user) {
                            let phoneNumber = user.phoneNumber;
                            let tiktokLink = user.tiktokLink
                        
                            return `UserId: ${userIdToNumber}\nCelular: ${phoneNumber}\nTikTok: ${tiktokLink}`;

                        } else {
                                console.log(`Usuário com userId ${userIdToNumber} não encontrado`);
                                return `Usuário com userId ${userIdToNumber} não encontrado`;
                        }
                    } catch (error) {
                        console.error(`Erro ao buscar informações: ${error}`);
                        return `Erro ao buscar informações: ${error}`;
                    }
                });
                
                const mensagensResolvidas = await Promise.all(mensagensPromises);
                
                // Define o tamanho máximo de cada mensagem (o limite é de 4096 caracteres)
                const tamanhoMaximo = 4000;
                
                // Divide a mensagem em partes menores
                const partesDaMensagem = [];
                let mensagemParcial = "";
                
                for (const linha of mensagensResolvidas.join("\n\n").split("\n")) {
                    if (mensagemParcial.length + linha.length + 1 <= tamanhoMaximo) {
                        mensagemParcial += linha + "\n";
                    } else {
                        partesDaMensagem.push(mensagemParcial);
                        mensagemParcial = linha + "\n";
                    }
                }
                
                // Adiciona a última parte
                partesDaMensagem.push(mensagemParcial);
                
                // Envia as partes da mensagem separadamente
                for (const parte of partesDaMensagem) {
                    await ctx.reply(parte);
                }
            
            } catch (error) {
                return `Erro ao conectar ao MongoDB:\n${error}`
            }

        } else {
            ctx.reply('🚨 Você não está autorizado a interagir com este bot.');
        }
    });

    bot.command('alterarpermissaoparaenviarlistadevideos', async (ctx) => {

        const userId = ctx.message.from.id;

        if (usuariosAutorizados.includes(userId)) {

            autorizacaoDeComando = 2

            ctx.reply('Permissão alterada.');
           
        } else {
            ctx.reply('🚨 Você não está autorizado a interagir com este bot.');
        }

    });

//EVENTOS
    bot.on('left_chat_member', async (ctx) => {
        const userId = ctx.message.left_chat_member.id;
        await removeMember(userId);
        console.log('Membro removido:', userId); // Usar userId em vez de memberId
    });

    bot.on('contact', async (ctx) => {
        const userId = ctx.message.from.id;
        const phoneNumber = ctx.message.contact.phone_number;
        const step = userSteps[userId] || 0;
        
        if (step === 5) {
            // Se o usuário clicou no botão e enviou o contato, armazene o número
            // Aqui você pode aplicar validações ou formatações se necessário

            const isCorrectNumber = isValidPhoneNumber(phoneNumber)

            if(isCorrectNumber) {

                console.log('Número de celular: ',phoneNumber);

                // Array para saber quais são os links acessados
                const profileAccessed = [`${userId}`]

                // Salve as informações do usuário no banco de dados
                const saveResult = await saveMember(userId, getTiktokLink, getProfileName, phoneNumber, profileAccessed);

                if (saveResult) {
                    // Se o salvamento foi bem-sucedido, envie o link para entrar no grupo
                    const groupLink = 'https://t.me/+hRGhBj3FAtRkYTZh'; // Substitua pelo link do seu grupo

                    const keyboard = {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Entrar no Grupo', url: groupLink }]
                            ]
                        }
                    };

                    ctx.reply('🤗 Obrigado por fornecer suas informações!\n\nVocê pode entrar no grupo clicando no botão abaixo:', keyboard);

                    userSteps[userId] = 10;
                } else {
                    ctx.reply('🚨 Houve um erro ao salvar suas informações. Por favor, tente novamente mais tarde ou entre em contato com o ADM do grupo');
                }

            } else {
                ctx.reply('🚨 Número de celular incorreto, por favor digite o número novamente.\n\n🎯 Lembre-se que você deve digitar somente os números.\n\n💡 Exemplo: 11977778888');
            }
        } else if (step === 10) {

            ctx.reply('😴 O bot está dormindo no momento! 💤');
            userSteps[userId] = 10;

        }
    });

    // Evento de texto para ambos /start e /criarlista
    bot.on('text', async (ctx) => {

        const userId = ctx.message.from.id;
        const messageText = ctx.message.text;
        const step = userSteps[userId] || 0;

        if (step === 2) {
            const tiktokLink = messageText;

            // Verifique se o formato do link do TikTok é válido
            if (!isValidTikTokLink(tiktokLink)) {
                ctx.reply('⚠️ O link do PERFIL TikTok que você forneceu não é válido. Por favor, forneça um PERFIL válido do TikTok. ⚠️');
                return;
            }

            // Armazene o link do TikTok
            getTiktokLink = tiktokLink;

            // Sinalize que estamos processando
            isProcessing = true;

            const usernameRegex = /\/@([^?]+)/;
            const match = getTiktokLink.match(usernameRegex);
    
            let profileName = '';
    
            if (match) {
                profileName = '@' + match[1];
            } else {
                profileName = ''
                console.log('Nome de usuário não encontrado na URL.');
            }

            getProfileName = profileName

            ctx.reply('📞 Por favor, forneça seu número de celular para te colocarmos dentro do grupo do Telegram!\n\n⌨️ Digite seu número no formato: DDD número do celular!\n\n💡 Exemplo: 11977778888\n\n👇 Ou clique no botão abaixo se estiver no celular.', Markup.keyboard([
                Markup.button.contactRequest('Fornecer Número de Celular'),
            ]).resize().oneTime());

            userSteps[userId] = 5;
            
            
        } else if (step === 3) {
            // Verifique se o link é válido (você pode adicionar sua lógica de validação aqui)
            const linkValido = validarLinkDoVideo(messageText);
            
            if (linkValido) {
                const profileTiktokName = await getProfileTiktokName(userId);
                const profilename = (profileTiktokName !== null) ? profileTiktokName : '';

                arrayDeLinksDiario.push({
                    link: messageText,
                    userId: userId,
                    profileName: profilename,
                });

                ctx.reply('😀 Link válido. Obrigado!');
                userSteps[userId] = 10;
            } else {
                ctx.reply('🚨 Link incorreto. Por favor, envie outro link. Apenas vídeos do TikTok são aceitos');
            }
        } else if (step === 4) {

            ctx.reply('🚩 Nesse momento não é permitido enviar o link do seu vídeo! Espere o ADM autorizar para você enviar seu link');
            userSteps[userId] = 10;

        }  else if (step === 10) {

            ctx.reply('😴 O bot está dormindo no momento! 💤');
            userSteps[userId] = 10;

        } else if (step === 5) {

            const phoneNumber = messageText;
            const isCorrectNumber = isValidPhoneNumber(phoneNumber)

            if(isCorrectNumber) {

                console.log("salve salve: ",phoneNumber);

                // Array para saber quais são os links acessados
                const profileAccessed = [`${userId}`]

                // Salve as informações do usuário no banco de dados
                const saveResult = await saveMember(userId, getTiktokLink, getProfileName, phoneNumber, profileAccessed);

                if (saveResult) {
                    // Se o salvamento foi bem-sucedido, envie o link para entrar no grupo
                    const groupLink = 'https://t.me/+O2Mw1liQ9gA5ZTBh'; // Substitua pelo link do seu grupo

                    const keyboard = {
                        reply_markup: {
                            inline_keyboard: [
                                [{ text: 'Entrar no Grupo', url: groupLink }]
                            ]
                        }
                    };

                    ctx.reply('🤗 Obrigado por fornecer suas informações!\n\nVocê pode entrar no grupo clicando no botão abaixo:', keyboard);

                    userSteps[userId] = 10;
                } else {
                    ctx.reply('🚨 Houve um erro ao salvar suas informações. Por favor, tente novamente mais tarde ou entre em contato com o ADM do grupo');
                }

                userSteps[userId] = 10;

            } else {
                ctx.reply('🚨 Número de celular incorreto, por favor digite o número novamente.\n\n🎯 Lembre-se que você deve digitar somente os números.\n\n💡 Exemplo: 11977778888');
            }

        }
    });

