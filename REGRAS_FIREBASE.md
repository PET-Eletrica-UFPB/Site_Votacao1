# Regras do Firebase

As regras completas estão em [`firebase_rules.json`](firebase_rules.json). Elas já incluem as das urnas (`controle`, `dispositivos`, `ranking_publico`) e tudo o que o site usa em `urna/multiurna/site`.

## Como publicar

1. Abra o [console do Firebase](https://console.firebase.google.com/) → projeto **fee20261**.
2. **Realtime Database** → aba **Regras**.
3. Copie o texto atual para um bloco de notas (backup), apague tudo, cole o conteúdo de `firebase_rules.json` e clique em **Publicar**.

## O que cada parte garante

A conta do PET (`b2Ejyy4j…`) grava em tudo dentro de `urna`. Além disso:

| Caminho | Quem lê | Quem mais grava |
|---|---|---|
| `site/projetos` | todo mundo | ninguém |
| `site/professores` (nome e projetos de cada professor) | todo mundo (lista do login) | ninguém |
| `site/professores_codigos` (códigos de acesso) | só o PET | ninguém |
| `site/avaliacoes/<professor>` (notas) | o próprio professor e o PET | o próprio professor, só nos projetos atribuídos a ele |
| `site/formularios` (perguntas e se está aberto) | todo mundo (página Inscrições) | ninguém |
| `site/feiras` (edições da página Feiras) | todo mundo | ninguém |
| `site/inscricoes/alunos`, `/professores` e `/escolas` (respostas) | só o PET | qualquer visitante pode **criar** uma resposta nova, só com o formulário aberto e com a data de agora; ninguém de fora edita nem apaga |

Respostas importadas de planilha pela Área dos Petianos mantêm a data original: só a conta do PET pode gravar uma resposta com data diferente da atual.

## Contas dos professores

Cada professor cadastrado na Área dos Petianos ganha uma conta no **Firebase Authentication** (e-mail/senha). O e-mail é interno (`prof-…@professores.feira-pet-ufpb.example.com`) e nunca recebe mensagens; o professor só escolhe o nome e digita o código de acesso. Ao excluir um professor pela Área dos Petianos, a conta dele também é apagada.
