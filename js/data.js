// Configurações da feira. Os projetos e os professores ficam no Firebase, cadastrados pela Área dos Petianos.
window.FEIRA = {
  // Conta da Área dos Petianos no Firebase Authentication; recebe o link de nova senha.
  emailPet: "pet.eletrica@cear.ufpb.br",

  // letra e tecla são as usadas pelas urnas: código "5A" = curso A, projeto 5.
  // artes: desenhos usados nos cartões dos projetos do curso
  cursos: [
    { id: "eletrica", nome: "Engenharia Elétrica", curto: "Eng. Elétrica", letra: "A", tecla: 1,
      artes: ["onda", "braco", "bateria", "casa", "raio", "gota"] },
    { id: "renovaveis", nome: "Engenharia de Energias Alternativas e Renováveis", curto: "Eng. Renováveis", letra: "B", tecla: 2,
      artes: ["solar", "turbina", "folha", "gota", "bateria"] },
  ],

  // Sugestões do campo de disciplina (as que costumam expor na feira); o petiano também pode digitar outra.
  disciplinas: [
    "Introdução à Engenharia Elétrica",
    "Integradora I",
    "Integradora II",
    "Integradora III",
    "Profissional III",
    "Projeto Integrador II",
    "Introdução à Ciência dos Materiais",
    "Introdução às Energias Renováveis",
    "Eletrônica Digital",
    "Controle de Processos",
  ],

  // id e ap precisam continuar iguais aos usados pelas urnas no Firebase.
  urnas: [
    { id: "urna01", nome: "Urna 1", ap: "URNA-PET-UFPB-01", arquivo: "URNA01_V19_GLOBAL_AUTONOMA.ino" },
    { id: "urna02", nome: "Urna 2", ap: "URNA-PET-UFPB-02", arquivo: "URNA02_V19_GLOBAL_AUTONOMA.ino" },
  ],

  // Critérios da avaliação dos professores: o peso entra na média.
  criterios: [
    { id: "dominio", nome: "Domínio técnico", curto: "Domínio", dica: "A equipe explica os fundamentos do projeto com segurança?", peso: 3 },
    { id: "inovacao", nome: "Inovação", curto: "Inovação", dica: "A solução traz algo novo ou uma abordagem criativa?", peso: 2 },
    { id: "aplicacao", nome: "Aplicabilidade", curto: "Aplicab.", dica: "O projeto resolve um problema real e pode ser usado na prática?", peso: 2 },
    { id: "prototipo", nome: "Protótipo", curto: "Protótipo", dica: "O que foi construído funciona e está bem executado?", peso: 2 },
    { id: "apresentacao", nome: "Apresentação", curto: "Apresent.", dica: "A comunicação foi clara, organizada e dentro do tempo?", peso: 1 },
  ],

  // Notas que o professor pode escolher em cada critério (viram botões).
  notas: [0, 2.5, 5, 7.5, 8, 10],

  // Tipos de pergunta dos formulários de inscrição.
  tiposPergunta: [
    { id: "curta", nome: "Resposta curta" },
    { id: "longa", nome: "Parágrafo" },
    { id: "email", nome: "E-mail" },
    { id: "telefone", nome: "Telefone" },
    { id: "numero", nome: "Número" },
    { id: "data", nome: "Data" },
    { id: "unica", nome: "Escolha única", opcoes: true },
    { id: "varias", nome: "Caixas de seleção (várias)", opcoes: true },
    { id: "lista", nome: "Lista suspensa", opcoes: true },
  ],

  // Os três formulários de inscrição e como o site se refere a cada um.
  publicos: {
    alunos: { nome: "alunos", dos: "dos alunos" },
    professores: { nome: "professores", dos: "dos professores" },
    escolas: { nome: "escolas", dos: "das escolas" },
  },

  // Modelo inicial dos formulários. Depois de salvos pela Área dos Petianos, valem os do Firebase.
  formulariosPadrao: {
    // Mesmas perguntas do formulário de mostradores usado no Google Forms (26.2), mais o curso.
    alunos: {
      titulo: "Inscrição de projeto",
      descricao: "Inscreva o projeto da sua equipe para expor na Feira de Engenharia e Energia. Basta um integrante preencher.",
      perguntas: [
        { id: "email", texto: "E-mail", tipo: "email", obrigatoria: true },
        { id: "curso", texto: "Curso", tipo: "unica", obrigatoria: true,
          opcoes: ["Engenharia Elétrica", "Engenharia de Energias Alternativas e Renováveis"] },
        { id: "disciplina", texto: "Disciplina", tipo: "curta", obrigatoria: true },
        { id: "resumo", texto: "Do que se trata o projeto?", tipo: "longa", obrigatoria: true },
        { id: "projeto", texto: "Nome da equipe", tipo: "curta", obrigatoria: true, ajuda: "É o nome que aparece no site, no placar e na urna." },
        { id: "quantidade", texto: "Quantos alunos participantes?", tipo: "numero", obrigatoria: true },
        { id: "equipe", texto: "Quais alunos participantes? (Deve conter o nome de todos os integrantes)", tipo: "longa", obrigatoria: true },
        { id: "estrutura", texto: "Quais materiais serão necessários para a exposição do projeto?", tipo: "varias", obrigatoria: false,
          opcoes: ["Mesa", "Ponto de Energia", "Porta banner"] },
        { id: "telefone", texto: "Telefone para contato do representante do projeto (será criado um grupo de whatsapp para comunicação com os participantes)", tipo: "telefone", obrigatoria: true },
        { id: "imagem", texto: "Autorizo o uso de imagem (fotos e vídeos) para divulgação no Instagram do curso e do grupo PET Elétrica - UFPB.", tipo: "unica", obrigatoria: true,
          opcoes: ["Sim", "Não"] },
      ],
    },
    professores: {
      titulo: "Inscrição para a banca avaliadora",
      descricao: "Professor(a), conte para a organização se pode avaliar os projetos da feira.",
      perguntas: [
        { id: "nome", texto: "Nome completo", tipo: "curta", obrigatoria: true },
        { id: "email", texto: "E-mail", tipo: "email", obrigatoria: true },
        { id: "telefone", texto: "WhatsApp", tipo: "telefone", obrigatoria: false },
        { id: "disciplinas", texto: "Disciplinas que leciona", tipo: "longa", obrigatoria: false },
        { id: "disponibilidade", texto: "Disponibilidade no dia da feira", tipo: "unica", obrigatoria: true,
          opcoes: ["Durante todo o evento", "Só em parte do evento", "Não poderei comparecer"] },
        { id: "avaliar", texto: "Quais disciplinas prefere avaliar?", tipo: "varias", obrigatoria: false,
          opcoes: ["Introdução à Engenharia Elétrica", "Integradora I", "Integradora II", "Integradora III", "Profissional III", "Projeto Integrador II", "Introdução à Ciência dos Materiais"] },
        { id: "observacoes", texto: "Observações", tipo: "longa", obrigatoria: false },
      ],
    },
    escolas: {
      titulo: "Visita de escolas",
      descricao: "Sua escola quer visitar a Feira de Engenharia e Energia? Preencha os dados abaixo para a organização entrar em contato.",
      perguntas: [
        { id: "escola", texto: "Nome da escola", tipo: "curta", obrigatoria: true },
        { id: "responsavel", texto: "Nome do responsável", tipo: "curta", obrigatoria: true },
        { id: "telefone", texto: "Telefone para contato", tipo: "telefone", obrigatoria: true },
        { id: "email", texto: "E-mail para contato", tipo: "email", obrigatoria: true },
        { id: "transporte", texto: "A escola possui transporte próprio para a visita?", tipo: "unica", obrigatoria: true,
          opcoes: ["Sim", "Não"] },
        { id: "alunos", texto: "Quantidade de alunos que irão", tipo: "numero", obrigatoria: true },
        { id: "observacoes", texto: "Observações", tipo: "longa", obrigatoria: false },
      ],
    },
  },
};
