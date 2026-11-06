// Configurações da feira. Os projetos ficam no Firebase, cadastrados pela Área do Petiano.
window.FEIRA = {
  // Conta da Área do Petiano no Firebase Authentication; recebe o link de nova senha.
  emailPet: "pet.eletrica@cear.ufpb.br",

  // letra e tecla são as usadas pelas urnas: código "5A" = curso A, projeto 5.
  // artes: desenhos usados nos cartões dos projetos do curso
  cursos: [
    { id: "eletrica", nome: "Engenharia Elétrica", curto: "Eng. Elétrica", letra: "A", tecla: 1,
      artes: ["onda", "braco", "bateria", "casa", "raio", "gota"] },
    { id: "renovaveis", nome: "Engenharia de Energias Alternativas e Renováveis", curto: "Eng. Renováveis", letra: "B", tecla: 2,
      artes: ["solar", "turbina", "folha", "gota", "bateria"] },
  ],

  // Sugestões do campo de disciplina; o petiano também pode digitar outra.
  disciplinas: [
    "Circuitos Elétricos",
    "Conversão de Energia",
    "Eletromagnetismo",
    "Eletrônica",
    "Fontes Renováveis de Energia",
    "Instalações Elétricas",
    "Máquinas Elétricas",
    "Microcontroladores",
    "Sistemas de Controle",
    "Sistemas de Potência",
  ],

  // id e ap precisam continuar iguais aos usados pelas urnas no Firebase.
  urnas: [
    { id: "urna01", nome: "Urna 1", ap: "URNA-PET-UFPB-01", arquivo: "URNA01_V19_GLOBAL_AUTONOMA.ino" },
    { id: "urna02", nome: "Urna 2", ap: "URNA-PET-UFPB-02", arquivo: "URNA02_V19_GLOBAL_AUTONOMA.ino" },
  ],

  // Critérios da avaliação dos professores: nota de 0 a 10, peso entra na média.
  criterios: [
    { id: "dominio", nome: "Domínio técnico", dica: "A equipe explica os fundamentos do projeto com segurança?", peso: 3 },
    { id: "inovacao", nome: "Inovação", dica: "A solução traz algo novo ou uma abordagem criativa?", peso: 2 },
    { id: "aplicacao", nome: "Aplicabilidade", dica: "O projeto resolve um problema real e pode ser usado na prática?", peso: 2 },
    { id: "prototipo", nome: "Protótipo", dica: "O que foi construído funciona e está bem executado?", peso: 2 },
    { id: "apresentacao", nome: "Apresentação", dica: "A comunicação foi clara, organizada e dentro do tempo?", peso: 1 },
  ],

  professores: ["Prof. Exemplo 1", "Prof. Exemplo 2", "Prof. Exemplo 3"],
};
