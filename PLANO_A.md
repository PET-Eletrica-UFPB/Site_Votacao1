# [Plano A]: mudanças depois da Feira

Situação: **em discussão, não implementar ainda.** Registrado em 28/11/2026, a partir do relato do PET
sobre o que aconteceu durante a Feira. Este arquivo guarda o relato e as decisões tomadas na conversa;
quando o modelo estiver fechado, ele vira a lista de tarefas da implementação.

## Relato

1. **Função "Vencedores".** A votação é em tempo real e encerrada no local, e o anúncio é feito ali
   mesmo. Falta uma função que anuncie os vencedores um a um, começando pelo 3º lugar, com animações.
2. **Restrição do Modo Pódio.** O formulário de satisfação foi distribuído durante a Feira e, com ele,
   o público teve acesso ao site e ao Modo Pódio, que ficou sem restrição. Nos momentos finais da
   apuração a TV do pódio é desligada, mas o resultado continuava visível pelo site.
3. **Gráficos do PDF do formulário de satisfação.** Melhorar os gráficos: histogramas verticais e/ou
   gráficos de pizza.

## Observações técnicas levantadas na conversa

### 1. Vencedores
- Onde fica: dentro do Modo Pódio (TV), liberado só com a senha do PET, como o Loop.
- Antes do anúncio, uma tela de conferência para o operador: votação encerrada, as duas urnas
  sincronizadas e sem votos pendentes.
- O resultado é congelado no momento em que o anúncio começa: uma urna que sincronize atrasada não
  muda o pódio no meio da revelação.
- **Desempate (inconsistência atual):** a urna desempata pela ordem em que o projeto atingiu o
  total, mas o site desempata pelo nome em ordem alfabética (`tresPrimeiros`, em `js/podio.js`). Com
  duas urnas somadas, a "ordem" de cada urna não é comparável entre elas. É preciso definir a regra
  oficial e mostrar o empate na tela de conferência.

### 2. Restrição do resultado
- Esconder o botão "Modo pódio" não basta. Durante a apuração o resultado também aparece em:
  - `placar.html`: ranking completo, com votos e porcentagem;
  - na página inicial (total de votos);
  - nos dados públicos do Firebase (`/dispositivos/<urna>/projetos` tem leitura pública e pode ser
    aberto direto pelo endereço `.json`).
- Restrição de verdade precisa de um interruptor no `/controle` (por exemplo
  `resultados_publicos`) e de regras do Firebase que liberem a leitura dos votos só quando ele
  estiver ligado ou para a conta do PET. A TV do pódio entraria com a senha do PET.

### 3. Gráficos do PDF de satisfação
- Hoje: barras horizontais dentro da tabela de cada pergunta de escolha.
- Proposta:
  - **pizza** para escolha única sem ordem (ex.: "Você participou da feira como");
  - **colunas verticais** para escalas e opções com ordem (nota de 1 a 5, Ótima → Ruim);
  - **colunas verticais** também nas caixas de seleção (várias respostas por pessoa: as fatias não
    somariam 100%, então pizza não serve);
  - manter a tabela com números e % ao lado do gráfico;
  - na nota de 1 a 5, mostrar também a média.

## Perguntas em aberto
Ver a conversa de 28/11/2026. Respostas serão registradas aqui.
